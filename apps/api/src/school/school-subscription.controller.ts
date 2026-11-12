import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { PLAN_ORDER, PLANS, planFeatureList, planHas, planLevel, planPrice, type Plan } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

/** §10.2 côté établissement : voir sa formule et demander un changement (validé par l'administrateur). */
@Roles('etablissement')
@Controller('school/subscription')
export class SchoolSubscriptionController {
  constructor(private readonly store: StoreService) {}

  @Get()
  get() {
    const { plan, suspended, requestedPlan } = this.store.subscription;
    return {
      plan, suspended, requestedPlan, features: planHas(plan), ...planFeatureList(plan),
      price: planPrice(plan), dueDate: suspended ? 'facture impayée depuis le 1er nov.' : '31/12/2026',
      plans: PLAN_ORDER.map((p) => ({ plan: p, price: planPrice(p), current: p === plan, requested: p === requestedPlan, upgrade: planLevel(p) > planLevel(plan) })),
    };
  }

  @Post('request')
  request(@Body({ schema: z.object({ plan: z.enum(PLANS) }) }) body: { plan: Plan }) {
    this.store.subscription.requestedPlan = body.plan === this.store.subscription.plan ? null : body.plan;
    return this.get();
  }

  @Delete('request')
  cancel() {
    this.store.subscription.requestedPlan = null;
    return this.get();
  }
}
