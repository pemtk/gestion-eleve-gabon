import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { KID_STATS, KIDS, PARENT_ALERTS, WEEK_MINUTES, linkChildSchema, rewardSchema } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

const prefsSchema = z.array(z.object({ id: z.string(), on: z.boolean() }));

@Roles('parent')
@Controller('me/parent')
export class ParentController {
  constructor(private readonly store: StoreService) {}

  @Get('children')
  children() {
    return KIDS;
  }

  @Get('children/:id')
  child(@Param('id') id: string) {
    const kid = KIDS.find((k) => k.id === id);
    if (!kid) throw new NotFoundException('Enfant introuvable.');
    const { points } = this.store.learner;
    const next = this.store.rewards.filter((r) => r.threshold > points).sort((a, b) => a.threshold - b.threshold)[0];
    return {
      kid, stats: KID_STATS, week: WEEK_MINUTES, weekTotalLabel: '5 h 40',
      reward: next ? { label: next.label, threshold: next.threshold, points, left: next.threshold - points } : null,
      lastGrades: this.store.subjectGrades.slice(0, 2).map((s) => ({ subject: s.subject, value: s.notes.at(-1)!.value })),
    };
  }

  @Get('alerts')
  alerts() {
    return { alerts: PARENT_ALERTS, prefs: this.store.alertPrefs };
  }

  @Put('alert-prefs')
  setPrefs(@Body({ schema: prefsSchema }) body: z.infer<typeof prefsSchema>) {
    for (const p of body) {
      const target = this.store.alertPrefs.find((x) => x.id === p.id);
      if (target) target.on = p.on;
    }
    return this.store.alertPrefs;
  }

  /**
   * §5.1 — rattachement par code à 6 chiffres ou QR code. Un code valide rattache tout de suite ;
   * un code déjà utilisé deux fois attend la validation de l'école (jamais de rattachement automatique).
   */
  @Post('children/link')
  link(@Body({ schema: linkChildSchema }) body: z.infer<typeof linkChildSchema>) {
    if (!body.code) throw new BadRequestException('Saisissez le code à 6 chiffres.');
    const student = this.store.students.find((s) => s.code === body.code);
    if (!student) throw new NotFoundException('Ce code ne correspond à aucun élève. Vérifiez la fiche remise par l’école.');
    const className = this.store.classes.find((c) => c.id === student.classId)?.name ?? '';
    if (student.parents.length >= 2) {
      this.store.linkRequests.push({ id: `r${this.store.linkRequests.length + 1}`, parent: 'Christelle Ondo', relation: body.relation, child: `${student.firstName} ${student.lastName}`, meta: 'Code déjà utilisé deux fois · à l’instant', decision: null });
      return { status: 'pending' as const, child: { name: `${student.firstName} ${student.lastName}`, className }, note: 'L’école doit valider votre demande.' };
    }
    student.parents.push({ name: 'Christelle Ondo', relation: body.relation });
    return { status: 'active' as const, child: { name: `${student.firstName} ${student.lastName}`, className }, note: 'Le rattachement est actif.' };
  }

  @Get('rewards')
  rewards() {
    const { points } = this.store.learner;
    return { points, rewards: this.store.rewards.map((r) => ({ ...r, reached: points >= r.threshold, left: Math.max(0, r.threshold - points) })) };
  }

  @Post('rewards')
  addReward(@Body({ schema: rewardSchema }) body: z.infer<typeof rewardSchema>) {
    const reward = { id: `rw${this.store.rewards.length + 1}`, label: body.label, threshold: body.threshold };
    this.store.rewards.push(reward);
    return reward;
  }
}
