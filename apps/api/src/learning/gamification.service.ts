import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  BADGE_RULES,
  DAILY_GOAL,
  badgesReached,
  statsOf,
  whenLabel,
  type Badge,
  type CompletionFact,
  type LearnerStats,
} from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { badgeAwards, taskCompletions, tasks } from '../db/schema.js';

/** Exécuteur de requêtes : la base, ou une transaction en cours. */
type Executor = Pick<Db, 'select' | 'insert'>;

export interface LearnerSummary extends LearnerStats {
  dailyGoal: number;
  badges: Badge[];
  /** Tâches terminées, de la plus récente à la plus ancienne. */
  history: { label: string; when: string; points: string }[];
}

/** Points, série et badges d'un élève, calculés à partir de ses tâches terminées (jamais stockés en double). */
@Injectable()
export class GamificationService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Tâches terminées de l'élève ; une tâche invalidée par l'enseignant n'y figure plus, donc ses points disparaissent. */
  private async completions(db: Executor, studentId: string) {
    const rows = await db
      .select({
        title: tasks.title,
        type: tasks.type,
        points: taskCompletions.points,
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .innerJoin(tasks, eq(tasks.id, taskCompletions.taskId))
      .where(
        and(
          eq(taskCompletions.studentId, studentId),
          eq(taskCompletions.status, 'done'),
        ),
      )
      .orderBy(desc(taskCompletions.completedAt));
    return rows.filter((r): r is CompletionFact => r.completedAt !== null);
  }

  /** Statistiques seules (accueil, espace parent). */
  async stats(studentId: string, now = new Date()): Promise<LearnerStats> {
    return statsOf(await this.completions(this.db, studentId), now);
  }

  /** Points, série, badges et historique ; les badges atteints mais pas encore enregistrés le sont au passage. */
  async summary(
    schoolId: string,
    studentId: string,
    now = new Date(),
  ): Promise<LearnerSummary> {
    const facts = await this.completions(this.db, studentId);
    const stats = statsOf(facts, now);
    await this.award(this.db, schoolId, studentId, stats, now);
    const awards = await this.db
      .select()
      .from(badgeAwards)
      .where(eq(badgeAwards.studentId, studentId));
    const earnedAt = new Map(awards.map((a) => [a.badgeId, a.earnedAt]));
    return {
      ...stats,
      dailyGoal: DAILY_GOAL,
      badges: BADGE_RULES.map((rule) => {
        const at = earnedAt.get(rule.id);
        return {
          id: rule.id,
          icon: rule.icon,
          label: rule.label,
          description: rule.description,
          earned: !!at,
          earnedAt: at?.toISOString(),
          progress: rule.progress(stats),
        };
      }),
      history: facts.slice(0, 30).map((c) => ({
        label: c.title,
        when: whenLabel(c.completedAt, now),
        points: `+${c.points}`,
      })),
    };
  }

  /**
   * Enregistre les badges dont les conditions sont remplies et renvoie ceux obtenus à l'instant.
   * Idempotent : un badge déjà obtenu n'est jamais ré-attribué (clé primaire élève + badge).
   */
  async award(
    db: Executor,
    schoolId: string,
    studentId: string,
    stats: LearnerStats,
    now = new Date(),
  ) {
    const reached = badgesReached(stats);
    if (!reached.length) return [];
    const created = await db
      .insert(badgeAwards)
      .values(
        reached.map((badgeId) => ({
          studentId,
          schoolId,
          badgeId,
          earnedAt: now,
        })),
      )
      .onConflictDoNothing()
      .returning({ badgeId: badgeAwards.badgeId });
    return BADGE_RULES.filter((r) => created.some((c) => c.badgeId === r.id));
  }

  /** Après une validation : recalcule les statistiques dans la transaction et attribue les nouveaux badges. */
  async afterCompletion(
    db: Executor,
    schoolId: string,
    studentId: string,
    now = new Date(),
  ) {
    const stats = statsOf(await this.completions(db, studentId), now);
    const newBadges = await this.award(db, schoolId, studentId, stats, now);
    return { stats, newBadges };
  }
}
