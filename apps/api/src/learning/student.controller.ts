import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import { BADGES, POINTS_HISTORY, selfEvaluationSchema } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { learner, taskCompletions, tasks, workSessions } from '../db/schema.js';
import { completionsOf, studentOf, taskStatusOf, tasksOfClass } from './context.js';
import { getLearner } from './learner.js';
import { overallAverage, recentGrades, subjectResults } from './results.js';

const POINTS_PER_TASK = 20;
/** Seuil sous lequel une complétion est signalée à l'enseignant (§4.3 : peut être invalidée). */
const MIN_SECONDS = 60;
const completeSchema = selfEvaluationSchema.omit({ taskId: true });

/** Espace élève : tâches de SA classe, avancement et notes propres à CET élève. */
@Roles('eleve')
@Controller('me/student')
export class StudentController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Tâches de la classe de l'élève, chacune avec son statut personnel. */
  private async myTasks(user: AuthUser) {
    const me = await studentOf(this.db, user);
    if (!me) return [];
    const [list, done] = await Promise.all([tasksOfClass(this.db, me.schoolId, me.classId), completionsOf(this.db, me.id)]);
    return list.map((t) => {
      const c = done.find((x) => x.taskId === t.id);
      return { id: t.id, title: t.title, subject: t.subject, type: t.type, due: t.due, estimate: t.estimate, status: taskStatusOf(c), redo: c?.status === 'redo' };
    });
  }

  @Get('home')
  async home(@CurrentUser() user: AuthUser) {
    const l = await getLearner(this.db, user.sub);
    const me = await studentOf(this.db, user);
    const subjects = me ? await subjectResults(this.db, me.schoolId, me.id, 'T1') : [];
    return {
      points: l.points, streak: l.streak, doneToday: l.doneToday, dailyGoal: 4,
      todayTasks: (await this.myTasks(user)).filter((t) => t.due.startsWith('Aujourd’hui')).slice(0, 3),
      lastGrades: recentGrades(subjects),
    };
  }

  @Get('tasks')
  async tasks(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    const all = await this.myTasks(user);
    return {
      counts: { todo: all.filter((t) => t.status === 'todo').length, doing: all.filter((t) => t.status === 'doing').length, done: all.filter((t) => t.status === 'done').length },
      tasks: status ? all.filter((t) => t.status === status) : all,
    };
  }

  @Get('tasks/:id')
  async task(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const t = (await this.myTasks(user)).find((x) => x.id === id);
    if (!t) throw new NotFoundException('Tâche introuvable.');
    const [row] = await this.db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, schoolOf(user))));
    return { ...t, teacher: 'Votre enseignant', instructions: row?.description || 'Consigne à lire en classe.', resources: [] as { kind: string; label: string; meta: string }[] };
  }

  /**
   * §4.3 — « Marquer comme terminée » + auto-évaluation + preuve facultative.
   * Une seule validation par élève et par tâche : l'insertion conditionnelle ne réussit qu'une fois, même en parallèle.
   */
  @Post('tasks/:id/complete')
  async complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: completeSchema }) body: z.infer<typeof completeSchema>) {
    const me = await studentOf(this.db, user);
    const [t] = me ? await this.db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, me.schoolId), eq(tasks.classId, me.classId))) : [];
    if (!me || !t) throw new NotFoundException('Tâche introuvable.');
    await getLearner(this.db, user.sub);
    return this.db.transaction(async (tx) => {
      const [c] = await tx.insert(taskCompletions).values({ taskId: id, studentId: me.id, status: 'done', seconds: body.seconds, evaluation: body.evaluation, proof: body.proof, points: POINTS_PER_TASK, completedAt: new Date() })
        .onConflictDoUpdate({ target: [taskCompletions.taskId, taskCompletions.studentId], set: { status: 'done', seconds: body.seconds, evaluation: body.evaluation, proof: body.proof, points: POINTS_PER_TASK, completedAt: new Date(), invalidatedAt: null }, setWhere: ne(taskCompletions.status, 'done') })
        .returning();
      if (!c) throw new BadRequestException('Cette tâche est déjà terminée.');
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
    const me = await studentOf(this.db, user);
    const subjects = me ? await subjectResults(this.db, me.schoolId, me.id, trimester) : [];
    return { trimester, average: overallAverage(subjects), subjects };
  }

  @Get('trophies')
  async trophies(@CurrentUser() user: AuthUser) {
    const l = await getLearner(this.db, user.sub);
    return { points: l.points, streak: l.streak, badges: BADGES, history: [...l.history, ...POINTS_HISTORY] };
  }
}
