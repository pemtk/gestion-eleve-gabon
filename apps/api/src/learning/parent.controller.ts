import { BadRequestException, Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { ALERT_PREFS, PARENT_ALERTS, linkChildSchema, rewardSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { alertPrefs, attendanceRecords, classes, linkRequests, organizations, rewards, studentParents, students, taskCompletions, tasks, workSessions } from '../db/schema.js';
import { getLearner } from './learner.js';
import { dateLabel, recentGrades, subjectResults } from './results.js';

const prefsSchema = z.array(z.object({ id: z.string(), on: z.boolean() }));
const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const hoursLabel = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;

@Roles('parent')
@Controller('me/parent')
export class ParentController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Enfants rattachés à CE parent (ses liens `student_parents`), quelle que soit leur école. */
  private async kids(userId: string) {
    return this.db
      .select({ s: students, className: classes.name, school: organizations.name })
      .from(studentParents)
      .innerJoin(students, eq(students.id, studentParents.studentId))
      .innerJoin(classes, eq(classes.id, students.classId))
      .innerJoin(organizations, eq(organizations.id, students.schoolId))
      .where(eq(studentParents.parentUserId, userId))
      .orderBy(studentParents.id);
  }

  private async kid(userId: string, id: string) {
    const row = (await this.kids(userId)).find((k) => k.s.id === id);
    if (!row) throw new NotFoundException('Enfant introuvable.');
    return row;
  }

  /** Accueil : une phrase d'état par enfant (« Tout va bien… » ou l'absence non justifiée). */
  @Get('children')
  async children(@CurrentUser() user: AuthUser) {
    const rows = await this.kids(user.sub);
    const ids = rows.map((r) => r.s.id);
    const unjustified = ids.length ? await this.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.status, 'A'), isNull(attendanceRecords.justification), inArray(attendanceRecords.studentId, ids))).orderBy(desc(attendanceRecords.date)) : [];
    return Promise.all(rows.map(async ({ s, className, school }) => {
      const absence = unjustified.find((a) => a.studentId === s.id);
      let status = 'Aucune activité enregistrée pour l’instant.';
      if (absence) status = `Absent le ${dateLabel(absence.date).replace(/\.$/, '')}. Justifiez ou écrivez à l’école.`;
      else if (s.userId) {
        const l = await getLearner(this.db, s.userId);
        status = `Tout va bien. ${l.doneToday} tâche${l.doneToday > 1 ? 's' : ''} faite${l.doneToday > 1 ? 's' : ''} aujourd’hui.`;
      }
      return { id: s.id, name: s.firstName, initials: `${s.firstName[0]}${s.lastName[0]}`.toUpperCase(), className, school, alert: !!absence, status, icon: absence ? 'user-x' : 'circle-check' };
    }));
  }

  @Get('children/:id')
  async child(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { s, className, school } = await this.kid(user.sub, id);
    const l = s.userId ? await getLearner(this.db, s.userId) : { points: 0, streak: 0, doneToday: 0 };
    const classTasks = await this.db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.schoolId, s.schoolId), eq(tasks.classId, s.classId)));
    const doneIds = new Set((await this.db.select({ id: taskCompletions.taskId }).from(taskCompletions).where(and(eq(taskCompletions.studentId, s.id), eq(taskCompletions.status, 'done')))).map((c) => c.id));
    const todo = classTasks.filter((t) => !doneIds.has(t.id)).length;

    // Temps de travail des 7 derniers jours, jour par jour (séances enregistrées à la fin de chaque tâche).
    const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 6);
    const sessions = s.userId ? await this.db.select().from(workSessions).where(and(eq(workSessions.userId, s.userId), gte(workSessions.at, since))) : [];
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since); d.setDate(since.getDate() + i);
      const minutes = Math.round(sessions.filter((w) => w.at.toDateString() === d.toDateString()).reduce((n, w) => n + w.seconds, 0) / 60);
      return { day: DAY_LABELS[d.getDay()]!, minutes };
    });

    const mine = (await this.db.select().from(rewards).where(eq(rewards.ownerId, user.sub))).filter((r) => r.threshold > l.points).sort((a, b) => a.threshold - b.threshold)[0];
    const grades = recentGrades(await subjectResults(this.db, s.schoolId, s.id, 'T1'));
    return {
      kid: { id: s.id, name: s.firstName, initials: `${s.firstName[0]}${s.lastName[0]}`.toUpperCase(), className, school },
      stats: [
        { icon: 'list-checks', value: `${l.doneToday}`, label: 'tâches faites aujourd’hui' },
        { icon: 'clipboard-list', value: `${todo}`, label: 'tâches à faire' },
        { icon: 'flame', value: `${l.streak} j`, label: 'de série' },
        { icon: 'award', value: `${l.points}`, label: 'points' },
      ],
      week, weekTotalLabel: hoursLabel(week.reduce((n, w) => n + w.minutes, 0)),
      reward: mine ? { label: mine.label, threshold: mine.threshold, points: l.points, left: mine.threshold - l.points } : null,
      lastGrades: grades.map((g) => ({ subject: g.subject, value: g.value })),
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
    if (existing.some((p) => p.parentUserId === user.sub)) throw new ConflictException('Cet enfant est déjà rattaché à votre compte.');
    if (existing.length >= 2) {
      await this.db.insert(linkRequests).values({ id: randomUUID(), schoolId: row.s.schoolId, parent: user.name, relation: body.relation, child, studentId: row.s.id, parentUserId: user.sub, meta: 'Code déjà utilisé deux fois · à l’instant' });
      return { status: 'pending' as const, child: { name: child, className: row.className }, note: 'L’école doit valider votre demande.' };
    }
    await this.db.insert(studentParents).values({ studentId: row.s.id, name: user.name, relation: body.relation, parentUserId: user.sub });
    return { status: 'active' as const, child: { name: child, className: row.className }, note: 'Le rattachement est actif.' };
  }

  /** Récompenses du parent ; les points sont ceux de l'enfant choisi (`?child=`), par défaut le premier. */
  @Get('rewards')
  async rewards(@CurrentUser() user: AuthUser) {
    return this.rewardsFor(user, undefined);
  }

  @Get('rewards/:childId')
  async rewardsOf(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.rewardsFor(user, childId);
  }

  private async rewardsFor(user: AuthUser, childId?: string) {
    const kids = await this.kids(user.sub);
    const kid = childId ? kids.find((k) => k.s.id === childId) : kids[0];
    if (childId && !kid) throw new NotFoundException('Enfant introuvable.');
    const points = kid?.s.userId ? (await getLearner(this.db, kid.s.userId)).points : 0;
    const rows = await this.db.select().from(rewards).where(eq(rewards.ownerId, user.sub)).orderBy(rewards.id);
    return { child: kid ? kid.s.firstName : null, points, rewards: rows.map((r) => ({ ...r, reached: points >= r.threshold, left: Math.max(0, r.threshold - points) })) };
  }

  @Post('rewards')
  async addReward(@CurrentUser() user: AuthUser, @Body({ schema: rewardSchema }) body: z.infer<typeof rewardSchema>) {
    const [reward] = await this.db.insert(rewards).values({ id: randomUUID(), ownerId: user.sub, label: body.label, threshold: body.threshold }).returning();
    return reward;
  }
}
