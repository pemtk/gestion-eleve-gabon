import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { rewardSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { rewards } from '../../db/schema.js';
import { GamificationService } from '../gamification.service.js';
import { ParentChildrenService } from './parent-children.service.js';

/** Récompenses fixées par le parent, avec le seuil de points (§5.6). */
@Roles('parent')
@Controller('me/parent')
export class ParentRewardsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly family: ParentChildrenService,
    private readonly gamification: GamificationService,
  ) {}

  /** Récompenses du parent ; les points sont ceux de l'enfant choisi (`?child=`), par défaut le premier. */
  @Get('rewards')
  async rewards(@CurrentUser() user: AuthUser) {
    return this.rewardsFor(user, undefined);
  }

  @Get('rewards/:childId')
  async rewardsOf(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
  ) {
    return this.rewardsFor(user, childId);
  }

  private async rewardsFor(user: AuthUser, childId?: string) {
    const kids = await this.family.kids(user.sub);
    const kid = childId ? kids.find((k) => k.s.id === childId) : kids[0];
    if (childId && !kid) throw new NotFoundException('Enfant introuvable.');
    const points = kid ? (await this.gamification.stats(kid.s.id)).points : 0;
    const rows = await this.db
      .select()
      .from(rewards)
      .where(eq(rewards.ownerId, user.sub))
      .orderBy(rewards.id);
    return {
      child: kid ? kid.s.firstName : null,
      points,
      rewards: rows.map((r) => ({
        ...r,
        reached: points >= r.threshold,
        left: Math.max(0, r.threshold - points),
      })),
    };
  }

  @Post('rewards')
  async addReward(
    @CurrentUser() user: AuthUser,
    @Body({ schema: rewardSchema }) body: z.infer<typeof rewardSchema>,
  ) {
    const [reward] = await this.db
      .insert(rewards)
      .values({
        id: randomUUID(),
        ownerId: user.sub,
        label: body.label,
        threshold: body.threshold,
      })
      .returning();
    return reward;
  }
}
