import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ALERT_PREFS, DEMO_USERS, KID_STATS, KIDS, PARENT_ALERTS, WEEK_MINUTES, linkChildSchema, rewardSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { alertPrefs, classes, linkRequests, rewards, studentParents, students, subjectGrades } from '../db/schema.js';
import { getLearner } from './learner.js';

const prefsSchema = z.array(z.object({ id: z.string(), on: z.boolean() }));
/** L'enfant « Aïcha » du jeu de démonstration correspond au compte élève de démonstration. */
const CHILD_USER_ID = DEMO_USERS.eleve.id;

@Roles('parent')
@Controller('me/parent')
export class ParentController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('children')
  children() {
    return KIDS;
  }

  @Get('children/:id')
  async child(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const kid = KIDS.find((k) => k.id === id);
    if (!kid) throw new NotFoundException('Enfant introuvable.');
    const { points } = await getLearner(this.db, CHILD_USER_ID);
    const next = (await this.db.select().from(rewards).where(eq(rewards.ownerId, user.sub))).filter((r) => r.threshold > points).sort((a, b) => a.threshold - b.threshold)[0];
    const grades = await this.db.select().from(subjectGrades).where(eq(subjectGrades.userId, CHILD_USER_ID)).orderBy(subjectGrades.id).limit(2);
    return {
      kid, stats: KID_STATS, week: WEEK_MINUTES, weekTotalLabel: '5 h 40',
      reward: next ? { label: next.label, threshold: next.threshold, points, left: next.threshold - points } : null,
      lastGrades: grades.map((s) => ({ subject: s.subject, value: s.notes.at(-1)!.value })),
    };
  }

  /** Préférences d'alerte du parent ; créées avec les valeurs par défaut à la première lecture. */
  private async prefs(userId: string) {
    await this.db.insert(alertPrefs).values(ALERT_PREFS.map((a) => ({ ...a, userId }))).onConflictDoNothing();
    return this.db.select().from(alertPrefs).where(eq(alertPrefs.userId, userId)).orderBy(alertPrefs.id);
  }

  @Get('alerts')
  async alerts(@CurrentUser() user: AuthUser) {
    return { alerts: PARENT_ALERTS, prefs: (await this.prefs(user.sub)).map(({ userId: _u, ...p }) => p) };
  }

  @Put('alert-prefs')
  async setPrefs(@CurrentUser() user: AuthUser, @Body({ schema: prefsSchema }) body: z.infer<typeof prefsSchema>) {
    await this.prefs(user.sub);
    await this.db.transaction(async (tx) => {
      for (const p of body) await tx.update(alertPrefs).set({ on: p.on }).where(and(eq(alertPrefs.userId, user.sub), eq(alertPrefs.id, p.id)));
    });
    return (await this.prefs(user.sub)).map(({ userId: _u, ...p }) => p);
  }

  /**
   * §5.1 — rattachement par code à 6 chiffres ou QR code. Un code valide rattache tout de suite ;
   * un code déjà utilisé deux fois attend la validation de l'école (jamais de rattachement automatique).
   */
  @Post('children/link')
  async link(@CurrentUser() user: AuthUser, @Body({ schema: linkChildSchema }) body: z.infer<typeof linkChildSchema>) {
    if (!body.code) throw new BadRequestException('Saisissez le code à 6 chiffres.');
    const [row] = await this.db.select({ s: students, className: classes.name }).from(students).innerJoin(classes, eq(classes.id, students.classId)).where(eq(students.code, body.code));
    if (!row) throw new NotFoundException('Ce code ne correspond à aucun élève. Vérifiez la fiche remise par l’école.');
    const child = `${row.s.firstName} ${row.s.lastName}`;
    const existing = await this.db.select().from(studentParents).where(eq(studentParents.studentId, row.s.id));
    if (existing.length >= 2) {
      await this.db.insert(linkRequests).values({ id: randomUUID(), schoolId: row.s.schoolId, parent: user.name, relation: body.relation, child, meta: 'Code déjà utilisé deux fois · à l’instant' });
      return { status: 'pending' as const, child: { name: child, className: row.className }, note: 'L’école doit valider votre demande.' };
    }
    await this.db.insert(studentParents).values({ studentId: row.s.id, name: user.name, relation: body.relation });
    return { status: 'active' as const, child: { name: child, className: row.className }, note: 'Le rattachement est actif.' };
  }

  @Get('rewards')
  async rewards(@CurrentUser() user: AuthUser) {
    const { points } = await getLearner(this.db, CHILD_USER_ID);
    const rows = await this.db.select().from(rewards).where(eq(rewards.ownerId, user.sub)).orderBy(rewards.id);
    return { points, rewards: rows.map((r) => ({ ...r, reached: points >= r.threshold, left: Math.max(0, r.threshold - points) })) };
  }

  @Post('rewards')
  async addReward(@CurrentUser() user: AuthUser, @Body({ schema: rewardSchema }) body: z.infer<typeof rewardSchema>) {
    const [reward] = await this.db.insert(rewards).values({ id: randomUUID(), ownerId: user.sub, label: body.label, threshold: body.threshold }).returning();
    return reward;
  }
}
