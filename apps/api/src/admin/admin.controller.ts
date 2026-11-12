import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { inviteSchema, organizationSchema, subscriptionSchema, type Plan } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { incidents, institutionalUsers, organizations, orgSubscriptions } from '../db/schema.js';

const adminInvite = inviteSchema.extend({ role: z.enum(['agent', 'partenaire']), scopes: z.array(z.string()).min(1, 'Choisissez au moins un périmètre.') });

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('organizations')
  organizations() {
    return this.db.select().from(organizations).orderBy(organizations.id);
  }

  /** §10.1 — école, diocèse ou réseau ; une école peut être rattachée à un diocèse ou un réseau. */
  @Post('organizations')
  async createOrganization(@Body({ schema: organizationSchema }) body: z.infer<typeof organizationSchema>) {
    if (body.parentId) {
      const [parent] = await this.db.select().from(organizations).where(eq(organizations.id, body.parentId));
      if (!parent || parent.type === 'École') throw new BadRequestException('Une école ne peut être rattachée qu’à un diocèse ou un réseau.');
    }
    return this.db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({ id: randomUUID(), name: body.name, type: body.type, plan: 'Essentiel', status: 'Essai · 30 j', due: '', parentId: body.parentId ?? null }).returning();
      await tx.insert(orgSubscriptions).values({ orgId: org!.id, plan: 'Essentiel', period: 'annuelle', active: true });
      return org;
    });
  }

  /** §10.2 — abonnements et demandes de changement de formule venant des établissements. */
  @Get('subscriptions')
  async subscriptions() {
    const rows = await this.db.select({ o: organizations, s: orgSubscriptions }).from(organizations).innerJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id)).orderBy(organizations.id);
    return {
      rows: rows.map(({ o, s }) => ({ ...o, plan: s.plan, period: s.period, active: s.active })),
      requests: rows.filter(({ s }) => s.requestedPlan).map(({ o, s }) => ({ organizationId: o.id, organization: o.name, from: s.plan as Plan, to: s.requestedPlan as Plan })),
    };
  }

  @Put('subscriptions/:orgId')
  async updateSubscription(@Param('orgId') orgId: string, @Body({ schema: subscriptionSchema }) body: z.infer<typeof subscriptionSchema>) {
    return this.db.transaction(async (tx) => {
      const [o] = await tx.update(organizations).set({ plan: body.plan, status: body.active ? 'Actif' : 'Suspendu' }).where(eq(organizations.id, orgId)).returning();
      if (!o) throw new NotFoundException('Organisation introuvable.');
      await tx.update(orgSubscriptions).set({ plan: body.plan, period: body.period, active: body.active }).where(eq(orgSubscriptions.orgId, orgId));
      return o;
    });
  }

  /** Accepter ou refuser la demande de formule d'un établissement précis. */
  @Post('subscriptions/:orgId/request/:decision')
  async decide(@Param('orgId') orgId: string, @Param('decision') decision: string) {
    if (!['apply', 'refuse'].includes(decision)) throw new NotFoundException();
    return this.db.transaction(async (tx) => {
      const [sub] = await tx.select().from(orgSubscriptions).where(and(eq(orgSubscriptions.orgId, orgId), isNotNull(orgSubscriptions.requestedPlan))).for('update');
      if (!sub) throw new NotFoundException('Aucune demande en attente.');
      const plan = decision === 'apply' ? (sub.requestedPlan as Plan) : (sub.plan as Plan);
      if (decision === 'apply') await tx.update(organizations).set({ plan }).where(eq(organizations.id, orgId));
      await tx.update(orgSubscriptions).set({ plan, requestedPlan: null }).where(eq(orgSubscriptions.orgId, orgId));
      return { plan };
    });
  }

  @Get('users')
  users() {
    return this.db.select().from(institutionalUsers).orderBy(institutionalUsers.id);
  }

  /** §10.3 — agents (écoles assignées) et partenaires (régions autorisées, données agrégées). */
  @Post('users/invite')
  async invite(@Body({ schema: adminInvite }) body: z.infer<typeof adminInvite>) {
    const [user] = await this.db.insert(institutionalUsers).values({ name: body.name, role: body.role === 'agent' ? 'Agent' : 'Partenaire', scope: body.scopes.join(', '), status: 'Invitation envoyée' }).returning();
    return user;
  }

  @Get('incidents')
  incidents() {
    return this.db.select().from(incidents).orderBy(incidents.id);
  }

  @Post('incidents/:id/resolve')
  async resolve(@Param('id') id: string) {
    const [incident] = await this.db.update(incidents).set({ status: 'Résolu', tone: 'hi' }).where(eq(incidents.id, id)).returning();
    if (!incident) throw new NotFoundException();
    return incident;
  }
}
