import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { BADGES, OVERALL_AVERAGE, POINTS_HISTORY, selfEvaluationSchema } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

const POINTS_PER_TASK = 20;
/** Seuil sous lequel une complétion est signalée à l'enseignant (§4.3 : peut être invalidée). */
const MIN_SECONDS = 60;
const completeSchema = selfEvaluationSchema.omit({ taskId: true });

@Roles('eleve')
@Controller('me/student')
export class StudentController {
  constructor(private readonly store: StoreService) {}

  @Get('home')
  home() {
    const l = this.store.learner;
    return {
      points: l.points, streak: l.streak, doneToday: l.doneToday, dailyGoal: 4,
      todayTasks: this.store.tasks.filter((t) => t.due.startsWith('Aujourd’hui')).slice(0, 3),
      lastGrades: this.store.subjectGrades.slice(0, 2).map((s) => ({ subject: s.subject, value: s.notes.at(-1)!.value, comment: s.notes.at(-1)!.comment })),
    };
  }

  @Get('tasks')
  tasks(@Query('status') status?: string) {
    const all = this.store.tasks;
    return {
      counts: { todo: all.filter((t) => t.status === 'todo').length, doing: all.filter((t) => t.status === 'doing').length, done: all.filter((t) => t.status === 'done').length },
      tasks: status ? all.filter((t) => t.status === status) : all,
    };
  }

  @Get('tasks/:id')
  task(@Param('id') id: string) {
    const t = this.store.tasks.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Tâche introuvable.');
    return { ...t, teacher: 'M. Ndong', instructions: 'Simplifie chaque fraction, puis range-les de la plus petite à la plus grande. Écris le détail de tes calculs dans ton cahier.', resources: [{ kind: 'pdf', label: 'Fiche fractions.pdf', meta: 'PDF · 240 Ko · disponible hors ligne' }, { kind: 'video', label: 'Rappel : simplifier une fraction', meta: 'Vidéo · 4 min' }] };
  }

  /** §4.3 — « Marquer comme terminée » + auto-évaluation + preuve facultative. */
  @Post('tasks/:id/complete')
  complete(@Param('id') id: string, @Body({ schema: completeSchema }) body: z.infer<typeof completeSchema>) {
    const t = this.store.tasks.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Tâche introuvable.');
    if (t.status === 'done') throw new BadRequestException('Cette tâche est déjà terminée.');
    t.status = 'done';
    const l = this.store.learner;
    l.points += POINTS_PER_TASK;
    l.doneToday += 1;
    if (l.doneToday === 1) l.streak += 1;
    l.history.unshift({ label: t.title, when: 'Aujourd’hui', points: `+${POINTS_PER_TASK}` });
    return {
      gained: POINTS_PER_TASK, points: l.points, streak: l.streak,
      flaggedForReview: body.seconds < MIN_SECONDS,
      message: body.evaluation === 'doubt' ? 'Ton enseignant verra que tu as des doutes : il pourra t’aider.' : 'Continue comme ça !',
    };
  }

  @Get('results')
  results(@Query('trimester') trimester = 'T1') {
    if (trimester !== 'T1') return { trimester, average: null, subjects: [] };
    return { trimester, average: OVERALL_AVERAGE, subjects: this.store.subjectGrades };
  }

  @Get('trophies')
  trophies() {
    const l = this.store.learner;
    return { points: l.points, streak: l.streak, badges: BADGES, history: [...l.history, ...POINTS_HISTORY] };
  }
}
