import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { inviteSchema, organizationSchema, subscriptionSchema, type Plan } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { incidents, institutionalUsers, organizations, orgSubscriptions } from '../db/schema.js';
import { getSetting, setSetting } from '../db/settings.js';

const SCHOOL_ORG_ID = 'o2'; // Lycée Léon Mba : l'établissement de démonstration
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
    const { plan, requestedPlan } = await getSetting(this.db, 'subscription');
    return {
      rows: rows.map(({ o, s }) => ({ ...o, plan: s.plan, period: s.period, active: s.active })),
      requests: requestedPlan ? [{ organizationId: SCHOOL_ORG_ID, organization: 'Lycée Léon Mba', from: plan, to: requestedPlan }] : [],
    };
  }

  @Put('subscriptions/:orgId')
  async updateSubscription(@Param('orgId') orgId: string, @Body({ schema: subscriptionSchema }) body: z.infer<typeof subscriptionSchema>) {
    const org = await this.db.transaction(async (tx) => {
      const [o] = await tx.update(organizations).set({ plan: body.plan, status: body.active ? 'Actif' : 'Suspendu' }).where(eq(organizations.id, orgId)).returning();
      if (!o) throw new NotFoundException('Organisation introuvable.');
      await tx.update(orgSubscriptions).set({ plan: body.plan, period: body.period, active: body.active }).where(eq(orgSubscriptions.orgId, orgId));
      return o;
    });
    if (orgId === SCHOOL_ORG_ID) {
      const current = await getSetting(this.db, 'subscription');
      await setSetting(this.db, 'subscription', { ...current, plan: body.plan, suspended: !body.active });
    }
    return org;
  }

  @Post('subscriptions/requests/:decision')
  async decide(@Param('decision') decision: string) {
    const sub = await getSetting(this.db, 'subscription');
    if (!sub.requestedPlan || !['apply', 'refuse'].includes(decision)) throw new NotFoundException('Aucune demande en attente.');
    const plan: Plan = decision === 'apply' ? sub.requestedPlan : sub.plan;
    if (decision === 'apply') {
      await this.db.update(organizations).set({ plan }).where(eq(organizations.id, SCHOOL_ORG_ID));
      await this.db.update(orgSubscriptions).set({ plan }).where(eq(orgSubscriptions.orgId, SCHOOL_ORG_ID));
    }
    await setSetting(this.db, 'subscription', { ...sub, plan, requestedPlan: null });
    return { plan };
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
