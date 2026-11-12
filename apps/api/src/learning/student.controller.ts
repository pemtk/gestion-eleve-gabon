import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { BADGES, OVERALL_AVERAGE, POINTS_HISTORY, selfEvaluationSchema } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { learner, subjectGrades, tasks, workSessions } from '../db/schema.js';
import { getLearner } from './learner.js';

const POINTS_PER_TASK = 20;
/** Seuil sous lequel une complétion est signalée à l'enseignant (§4.3 : peut être invalidée). */
const MIN_SECONDS = 60;
const completeSchema = selfEvaluationSchema.omit({ taskId: true });

@Roles('eleve')
@Controller('me/student')
export class StudentController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Tâches de l'établissement de l'élève uniquement. */
  private allTasks(user: AuthUser) {
    return this.db.select().from(tasks).where(eq(tasks.schoolId, schoolOf(user))).orderBy(asc(tasks.position));
  }

  private grades(user: AuthUser) {
    return this.db.select().from(subjectGrades).where(eq(subjectGrades.userId, user.sub)).orderBy(subjectGrades.id);
  }

  @Get('home')
  async home(@CurrentUser() user: AuthUser) {
    const l = await getLearner(this.db, user.sub);
    const grades = (await this.grades(user)).slice(0, 2);
    return {
      points: l.points, streak: l.streak, doneToday: l.doneToday, dailyGoal: 4,
      todayTasks: (await this.allTasks(user)).filter((t) => t.due.startsWith('Aujourd’hui')).slice(0, 3),
      lastGrades: grades.map((s) => ({ subject: s.subject, value: s.notes.at(-1)!.value, comment: s.notes.at(-1)!.comment })),
    };
  }

  @Get('tasks')
  async tasks(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    const all = await this.allTasks(user);
    return {
      counts: { todo: all.filter((t) => t.status === 'todo').length, doing: all.filter((t) => t.status === 'doing').length, done: all.filter((t) => t.status === 'done').length },
      tasks: status ? all.filter((t) => t.status === status) : all,
    };
  }

  @Get('tasks/:id')
  async task(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const [t] = await this.db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, schoolOf(user))));
    if (!t) throw new NotFoundException('Tâche introuvable.');
    return { ...t, teacher: 'M. Ndong', instructions: 'Simplifie chaque fraction, puis range-les de la plus petite à la plus grande. Écris le détail de tes calculs dans ton cahier.', resources: [{ kind: 'pdf', label: 'Fiche fractions.pdf', meta: 'PDF · 240 Ko · disponible hors ligne' }, { kind: 'video', label: 'Rappel : simplifier une fraction', meta: 'Vidéo · 4 min' }] };
  }

  /** §4.3 — « Marquer comme terminée » + auto-évaluation + preuve facultative. Une seule validation par tâche. */
  @Post('tasks/:id/complete')
  async complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: completeSchema }) body: z.infer<typeof completeSchema>) {
    const sid = schoolOf(user);
    const [exists] = await this.db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, sid)));
    if (!exists) throw new NotFoundException('Tâche introuvable.');
    await getLearner(this.db, user.sub);
    return this.db.transaction(async (tx) => {
      const [t] = await tx.update(tasks).set({ status: 'done' }).where(and(eq(tasks.id, id), eq(tasks.schoolId, sid), ne(tasks.status, 'done'))).returning();
      if (!t) throw new BadRequestException('Cette tâche est déjà terminée.');
      await tx.insert(workSessions).values({ userId: user.sub, seconds: body.seconds });
      const entry = JSON.stringify([{ label: t.title, when: 'Aujourd’hui', points: `+${POINTS_PER_TASK}` }]);
      const [l] = await tx.update(learner).set({
        points: sql`${learner.points} + ${POINTS_PER_TASK}`,
        streak: sql`case when ${learner.doneToday} = 0 then ${learner.streak} + 1 else ${learner.streak} end`,
        doneToday: sql`${learner.doneToday} + 1`,
        history: sql`${entry}::jsonb || ${learner.history}`,
      }).where(eq(learner.userId, user.sub)).returning();
      return {
        gained: POINTS_PER_TASK, points: l!.points, streak: l!.streak,
        flaggedForReview: body.seconds < MIN_SECONDS,
        message: body.evaluation === 'doubt' ? 'Ton enseignant verra que tu as des doutes : il pourra t’aider.' : 'Continue comme ça !',
      };
    });
  }

  @Get('results')
  async results(@CurrentUser() user: AuthUser, @Query('trimester') trimester = 'T1') {
    const subjects = trimester === 'T1' ? await this.grades(user) : [];
    return { trimester, average: subjects.length ? OVERALL_AVERAGE : null, subjects };
  }

  @Get('trophies')
  async trophies(@CurrentUser() user: AuthUser) {
    const l = await getLearner(this.db, user.sub);
    return { points: l.points, streak: l.streak, badges: BADGES, history: [...l.history, ...POINTS_HISTORY] };
  }
}
