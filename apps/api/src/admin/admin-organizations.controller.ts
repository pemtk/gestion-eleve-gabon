import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { organizationSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { organizations, orgSubscriptions } from '../db/schema.js';
import { AccountsService } from '../accounts/accounts.service.js';

const localisation = organizationSchema.pick({ province: true, level: true });

/** Organisations : écoles, diocèses et réseaux, avec le compte de direction à la création (§10.1). */
@Roles('admin')
@Controller('admin')
export class AdminOrganizationsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly accounts: AccountsService,
  ) {}

  @Get('organizations')
  organizations() {
    return this.db.select().from(organizations).orderBy(organizations.id);
  }

  /** §10.1 — école, diocèse ou réseau ; une école peut être rattachée à un diocèse ou un réseau. */
  @Post('organizations')
  async createOrganization(
    @Body({ schema: organizationSchema })
    body: z.infer<typeof organizationSchema>,
  ) {
    if (body.parentId) {
      const [parent] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, body.parentId));
      if (!parent || parent.type === 'École')
        throw new BadRequestException(
          'Une école ne peut être rattachée qu’à un diocèse ou un réseau.',
        );
    }
    if (body.director && body.type !== 'École')
      throw new BadRequestException(
        'Seule une école a un compte de direction.',
      );
    const id = randomUUID();
    const result = await this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          id,
          name: body.name,
          type: body.type,
          plan: 'Essentiel',
          status: 'Essai · 30 j',
          due: '',
          parentId: body.parentId ?? null,
          province: body.type === 'École' ? (body.province ?? null) : null,
          level: body.type === 'École' ? (body.level ?? null) : null,
        })
        .returning();
      await tx.insert(orgSubscriptions).values({
        orgId: id,
        plan: 'Essentiel',
        period: 'annuelle',
        active: true,
      });
      // Compte de direction (rôle « établissement ») : rattaché à l'école par `school_id`, à activer par code SMS.
      const director = body.director
        ? await this.accounts.create(
            {
              role: 'etablissement',
              name: body.director.name,
              phone: body.director.phone,
              schoolId: id,
              title: 'Direction',
              organization: body.name,
            },
            tx,
          )
        : null;
      return { org: org!, director };
    });
    if (result.director) this.accounts.invite(result.director, body.name);
    return {
      ...result.org,
      director: result.director
        ? {
            id: result.director.id,
            name: result.director.name,
            phone: result.director.phone,
          }
        : null,
    };
  }

  /** Province et niveau d'une école existante (indicateurs par région du partenaire). */
  @Patch('organizations/:id')
  async locate(
    @Param('id') id: string,
    @Body({ schema: localisation }) body: z.infer<typeof localisation>,
  ) {
    const [org] = await this.db
      .update(organizations)
      .set({ province: body.province ?? null, level: body.level ?? null })
      .where(and(eq(organizations.id, id), eq(organizations.type, 'École')))
      .returning();
    if (!org) throw new NotFoundException('École introuvable.');
    return org;
  }
}
