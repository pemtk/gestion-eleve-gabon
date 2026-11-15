import { Inject } from '@nestjs/common';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { DB, type Db } from '../../db/db.module.js';
import { students, taskCompletions, tasks } from '../../db/schema.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TeacherRosterService {
  constructor(@Inject(DB) private readonly db: Db) {}

  roster(schoolId: string, classId: string) {
    return this.db
      .select()
      .from(students)
      .where(
        and(eq(students.schoolId, schoolId), eq(students.classId, classId)),
      )
      .orderBy(asc(students.firstName), asc(students.lastName));
  }

  /** Part des tâches faites dans une classe : tâches terminées / (tâches × élèves). */
  async completionRate(
    schoolId: string,
    classId: string,
    studentCount: number,
  ) {
    const taskIds = (
      await this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.schoolId, schoolId), eq(tasks.classId, classId)))
    ).map((t) => t.id);
    if (!taskIds.length || !studentCount) return 0;
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(taskCompletions)
      .where(
        and(
          inArray(taskCompletions.taskId, taskIds),
          eq(taskCompletions.status, 'done'),
        ),
      );
    return Math.round((n / (taskIds.length * studentCount)) * 100);
  }
}
