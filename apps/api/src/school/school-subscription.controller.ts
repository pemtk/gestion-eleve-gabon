import { Body, Controller, Delete, Get, Inject } from '@nestjs/common';
import { Post } from '@nestjs/common';
import {
  PLAN_ORDER,
  PLANS,
  planFeatureList,
  planHas,
  planLevel,
  planPrice,
  type Plan,
} from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import {
  getSubscription,
  schoolName,
  setRequestedPlan,
} from '../db/subscription.js';

import { schoolBadges } from './badges.js';

/** §10.2 côté établissement : voir sa formule et demander un changement (validé par l'administrateur). */
@Roles('etablissement')
@Controller('school')
export class SchoolSubscriptionController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Identité de l'établissement connecté (nom, rattachement) : affichée dans l'en-tête de l'espace. */
  @Get('profile')
  async profile(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    return {
      id: sid,
      name: await schoolName(this.db, sid),
      badges: await schoolBadges(this.db, sid),
    };
  }

  @Get('subscription')
  async get(@CurrentUser() user: AuthUser) {
    const { plan, suspended, requestedPlan } = await getSubscription(
      this.db,
      schoolOf(user),
    );
    return {
      plan,
      suspended,
      requestedPlan,
      features: planHas(plan),
      ...planFeatureList(plan),
      price: planPrice(plan),
      dueDate: suspended ? 'facture impayée depuis le 1er nov.' : '31/12/2026',
      plans: PLAN_ORDER.map((p) => ({
        plan: p,
        price: planPrice(p),
        current: p === plan,
        requested: p === requestedPlan,
        upgrade: planLevel(p) > planLevel(plan),
      })),
    };
  }

  @Post('subscription/request')
  async request(
    @CurrentUser() user: AuthUser,
    @Body({ schema: z.object({ plan: z.enum(PLANS) }) }) body: { plan: Plan },
  ) {
    const sid = schoolOf(user);
    const s = await getSubscription(this.db, sid);
    await setRequestedPlan(
      this.db,
      sid,
      body.plan === s.plan ? null : body.plan,
    );
    return this.get(user);
  }

  @Delete('subscription/request')
  async cancel(@CurrentUser() user: AuthUser) {
    await setRequestedPlan(this.db, schoolOf(user), null);
    return this.get(user);
  }
}
