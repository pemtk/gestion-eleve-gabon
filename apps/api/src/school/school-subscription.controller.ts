import { Body, Controller, Delete, Get, Inject, Post } from '@nestjs/common';
import { PLAN_ORDER, PLANS, planFeatureList, planHas, planLevel, planPrice, type Plan } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { getSetting, setSetting } from '../db/settings.js';

/** §10.2 côté établissement : voir sa formule et demander un changement (validé par l'administrateur). */
@Roles('etablissement')
@Controller('school/subscription')
export class SchoolSubscriptionController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async get() {
    const { plan, suspended, requestedPlan } = await getSetting(this.db, 'subscription');
    return {
      plan, suspended, requestedPlan, features: planHas(plan), ...planFeatureList(plan),
      price: planPrice(plan), dueDate: suspended ? 'facture impayée depuis le 1er nov.' : '31/12/2026',
      plans: PLAN_ORDER.map((p) => ({ plan: p, price: planPrice(p), current: p === plan, requested: p === requestedPlan, upgrade: planLevel(p) > planLevel(plan) })),
    };
  }

  @Post('request')
  async request(@Body({ schema: z.object({ plan: z.enum(PLANS) }) }) body: { plan: Plan }) {
    const s = await getSetting(this.db, 'subscription');
    await setSetting(this.db, 'subscription', { ...s, requestedPlan: body.plan === s.plan ? null : body.plan });
    return this.get();
  }

  @Delete('request')
  async cancel() {
    const s = await getSetting(this.db, 'subscription');
    await setSetting(this.db, 'subscription', { ...s, requestedPlan: null });
    return this.get();
  }
}
