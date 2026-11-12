import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { inviteSchema, organizationSchema, subscriptionSchema, type Plan } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

const SCHOOL_ORG_ID = 'o2'; // Lycée Léon Mba : l'établissement de démonstration
const adminInvite = inviteSchema.extend({ role: z.enum(['agent', 'partenaire']), scopes: z.array(z.string()).min(1, 'Choisissez au moins un périmètre.') });

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly store: StoreService) {}

  @Get('organizations')
  organizations() {
    return this.store.organizations;
  }

  /** §10.1 — école, diocèse ou réseau ; une école peut être rattachée à un diocèse ou un réseau. */
  @Post('organizations')
  createOrganization(@Body({ schema: organizationSchema }) body: z.infer<typeof organizationSchema>) {
    if (body.parentId) {
      const parent = this.store.organizations.find((o) => o.id === body.parentId);
      if (!parent || parent.type === 'École') throw new BadRequestException('Une école ne peut être rattachée qu’à un diocèse ou un réseau.');
    }
    const org = { id: `o${this.store.organizations.length + 1}`, name: body.name, type: body.type, plan: 'Essentiel' as Plan, status: 'Essai · 30 j', due: '', parentId: body.parentId };
    this.store.organizations.push(org);
    this.store.subscriptions.set(org.id, { plan: org.plan, period: 'annuelle', active: true });
    return org;
  }

  /** §10.2 — abonnements et demandes de changement de formule venant des établissements. */
  @Get('subscriptions')
  subscriptions() {
    const { plan, requestedPlan } = this.store.subscription;
    return {
      rows: this.store.organizations.map((o) => ({ ...o, ...this.store.subscriptions.get(o.id)! })),
      requests: requestedPlan ? [{ organizationId: SCHOOL_ORG_ID, organization: 'Lycée Léon Mba', from: plan, to: requestedPlan }] : [],
    };
  }

  @Put('subscriptions/:orgId')
  updateSubscription(@Param('orgId') orgId: string, @Body({ schema: subscriptionSchema }) body: z.infer<typeof subscriptionSchema>) {
    const org = this.store.organizations.find((o) => o.id === orgId);
    if (!org) throw new NotFoundException('Organisation introuvable.');
    this.store.subscriptions.set(orgId, { plan: body.plan, period: body.period, active: body.active });
    org.plan = body.plan;
    org.status = body.active ? 'Actif' : 'Suspendu';
    if (orgId === SCHOOL_ORG_ID) {
      this.store.subscription.plan = body.plan;
      this.store.subscription.suspended = !body.active;
    }
    return org;
  }

  @Post('subscriptions/requests/:decision')
  decide(@Param('decision') decision: string) {
    const sub = this.store.subscription;
    if (!sub.requestedPlan || !['apply', 'refuse'].includes(decision)) throw new NotFoundException('Aucune demande en attente.');
    if (decision === 'apply') {
      sub.plan = sub.requestedPlan;
      const org = this.store.organizations.find((o) => o.id === SCHOOL_ORG_ID)!;
      org.plan = sub.plan;
      this.store.subscriptions.get(SCHOOL_ORG_ID)!.plan = sub.plan;
    }
    sub.requestedPlan = null;
    return { plan: sub.plan };
  }

  @Get('users')
  users() {
    return this.store.agentUsers;
  }

  /** §10.3 — agents (écoles assignées) et partenaires (régions autorisées, données agrégées). */
  @Post('users/invite')
  invite(@Body({ schema: adminInvite }) body: z.infer<typeof adminInvite>) {
    const user = { name: body.name, role: body.role === 'agent' ? 'Agent' : 'Partenaire', scope: body.scopes.join(', '), status: 'Invitation envoyée' };
    this.store.agentUsers.push(user);
    return user;
  }

  @Get('incidents')
  incidents() {
    return this.store.incidents;
  }

  @Post('incidents/:id/resolve')
  resolve(@Param('id') id: string) {
    const incident = this.store.incidents.find((i) => i.id === id);
    if (!incident) throw new NotFoundException();
    incident.status = 'Résolu';
    incident.tone = 'hi';
    return incident;
  }
}
