import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { inviteSchema } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { institutionalUsers, organizations, userScopes } from '../db/schema.js';
import { AccountsService } from '../accounts/accounts.service.js';

const adminInvite = inviteSchema.extend({
  role: z.enum(['agent', 'partenaire']),
  scopes: z.array(z.string()).min(1, 'Choisissez au moins un périmètre.'),
});

/** Agents et partenaires : invitation, comptes et périmètres (§10.3). */
@Roles('admin')
@Controller('admin')
export class AdminUsersController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly accounts: AccountsService,
  ) {}

  @Get('users')
  users() {
    return this.db
      .select()
      .from(institutionalUsers)
      .orderBy(institutionalUsers.id);
  }

  /** §10.3 — agents (écoles assignées) et partenaires (régions autorisées, données agrégées). */
  @Post('users/invite')
  async invite(
    @Body({ schema: adminInvite }) body: z.infer<typeof adminInvite>,
  ) {
    const role = body.role;
    const result = await this.db.transaction(async (tx) => {
      const account = await this.accounts.create(
        {
          role,
          name: body.name,
          phone: body.phone,
          title: role === 'agent' ? 'Agent' : 'Partenaire',
        },
        tx,
      );
      // Un agent n'accède qu'aux écoles de son périmètre (les noms choisis dans l'interface sont rapprochés des établissements).
      if (role === 'agent') {
        const orgs = await tx
          .select({ id: organizations.id })
          .from(organizations)
          .where(
            and(
              eq(organizations.type, 'École'),
              inArray(organizations.name, body.scopes),
            ),
          );
        if (orgs.length)
          await tx
            .insert(userScopes)
            .values(orgs.map((o) => ({ userId: account.id, orgId: o.id })));
      }
      const [row] = await tx
        .insert(institutionalUsers)
        .values({
          userId: account.id,
          name: body.name,
          role: role === 'agent' ? 'Agent' : 'Partenaire',
          scope: body.scopes.join(', '),
          status: 'Invitation envoyée',
        })
        .returning();
      return { row: row!, account };
    });
    this.accounts.invite(result.account);
    return result.row;
  }
}
