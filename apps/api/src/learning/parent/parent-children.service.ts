import { Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../../db/db.module.js';
import {
  classes,
  organizations,
  studentParents,
  students,
} from '../../db/schema.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ParentChildrenService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Enfants rattachés à CE parent (ses liens `student_parents`), quelle que soit leur école. */
  async kids(userId: string) {
    return this.db
      .select({
        s: students,
        className: classes.name,
        school: organizations.name,
      })
      .from(studentParents)
      .innerJoin(students, eq(students.id, studentParents.studentId))
      .innerJoin(classes, eq(classes.id, students.classId))
      .innerJoin(organizations, eq(organizations.id, students.schoolId))
      .where(eq(studentParents.parentUserId, userId))
      .orderBy(studentParents.id);
  }

  async kid(userId: string, id: string) {
    const row = (await this.kids(userId)).find((k) => k.s.id === id);
    if (!row) throw new NotFoundException('Enfant introuvable.');
    return row;
  }
}
