import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { subscriptionSchema, type Plan } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { organizations, orgSubscriptions } from '../db/schema.js';

/** Abonnements et demandes de changement de formule des établissements (§10.2). */
@Roles('admin')
@Controller('admin')
export class AdminSubscriptionsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** §10.2 — abonnements et demandes de changement de formule venant des établissements. */
  @Get('subscriptions')
  async subscriptions() {
    const rows = await this.db
      .select({ o: organizations, s: orgSubscriptions })
      .from(organizations)
      .innerJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
      .orderBy(organizations.id);
    return {
      rows: rows.map(({ o, s }) => ({
        ...o,
        plan: s.plan,
        period: s.period,
        active: s.active,
      })),
      requests: rows
        .filter(({ s }) => s.requestedPlan)
        .map(({ o, s }) => ({
          organizationId: o.id,
          organization: o.name,
          from: s.plan as Plan,
          to: s.requestedPlan as Plan,
        })),
    };
  }

  @Put('subscriptions/:orgId')
  async updateSubscription(
    @Param('orgId') orgId: string,
    @Body({ schema: subscriptionSchema })
    body: z.infer<typeof subscriptionSchema>,
  ) {
    return this.db.transaction(async (tx) => {
      const [o] = await tx
        .update(organizations)
        .set({ plan: body.plan, status: body.active ? 'Actif' : 'Suspendu' })
        .where(eq(organizations.id, orgId))
        .returning();
      if (!o) throw new NotFoundException('Organisation introuvable.');
      await tx
        .update(orgSubscriptions)
        .set({ plan: body.plan, period: body.period, active: body.active })
        .where(eq(orgSubscriptions.orgId, orgId));
      return o;
    });
  }

  /** Accepter ou refuser la demande de formule d'un établissement précis. */
  @Post('subscriptions/:orgId/request/:decision')
  async decide(
    @Param('orgId') orgId: string,
    @Param('decision') decision: string,
  ) {
    if (!['apply', 'refuse'].includes(decision)) throw new NotFoundException();
    return this.db.transaction(async (tx) => {
      const [sub] = await tx
        .select()
        .from(orgSubscriptions)
        .where(
          and(
            eq(orgSubscriptions.orgId, orgId),
            isNotNull(orgSubscriptions.requestedPlan),
          ),
        )
        .for('update');
      if (!sub) throw new NotFoundException('Aucune demande en attente.');
      const plan =
        decision === 'apply' ? (sub.requestedPlan as Plan) : (sub.plan as Plan);
      if (decision === 'apply')
        await tx
          .update(organizations)
          .set({ plan })
          .where(eq(organizations.id, orgId));
      await tx
        .update(orgSubscriptions)
        .set({ plan, requestedPlan: null })
        .where(eq(orgSubscriptions.orgId, orgId));
      return { plan };
    });
  }
}
