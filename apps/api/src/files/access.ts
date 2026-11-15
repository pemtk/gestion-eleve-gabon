import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../common/auth.js';
import type { Db } from '../db/db.module.js';
import { getSetting } from '../db/settings.js';
import { announcements, assignments, files, studentParents, students, tasks, teachers, users, visitReports } from '../db/schema.js';

type FileRow = typeof files.$inferSelect;

/** Le lecteur a-t-il un enfant dans cet établissement (et, si `classId`, dans cette classe) ? */
async function parentHasChild(db: Db, parentId: string, schoolId: string, classId?: string | null): Promise<boolean> {
  const rows = await db.select({ id: students.id }).from(studentParents).innerJoin(students, eq(students.id, studentParents.studentId))
    .where(and(eq(studentParents.parentUserId, parentId), eq(students.schoolId, schoolId), classId ? eq(students.classId, classId) : undefined)).limit(1);
  return rows.length > 0;
}

/** L'enseignant connecté a-t-il cette classe dans ses affectations ? */
async function teachesClass(db: Db, userId: string, schoolId: string, classId: string): Promise<boolean> {
  const rows = await db.select({ id: assignments.id }).from(assignments).innerJoin(teachers, eq(teachers.id, assignments.teacherId))
    .where(and(eq(teachers.userId, userId), eq(teachers.schoolId, schoolId), eq(assignments.schoolId, schoolId), eq(assignments.classId, classId))).limit(1);
  return rows.length > 0;
}

async function studentClass(db: Db, userId: string, schoolId: string): Promise<string | null> {
  const [s] = await db.select({ classId: students.classId }).from(students).where(and(eq(students.userId, userId), eq(students.schoolId, schoolId)));
  return s?.classId ?? null;
}

/** Deux comptes se côtoient-ils : même établissement, ou parent d'un élève de l'établissement de l'autre ? */
async function sameCommunity(db: Db, viewer: AuthUser, owner: { id: string; schoolId: string | null }): Promise<boolean> {
  if (owner.schoolId && viewer.schoolId) return owner.schoolId === viewer.schoolId;
  if (owner.schoolId && viewer.role === 'parent') return parentHasChild(db, viewer.sub, owner.schoolId);
  if (!owner.schoolId && viewer.schoolId) return parentHasChild(db, owner.id, viewer.schoolId);
  return false;
}

/**
 * Qui peut lire un fichier, d'après l'objet auquel il est rattaché. Le propriétaire lit toujours le sien ; tout le reste
 * dépend de l'usage et se vérifie en base à chaque lecture (un fichier qui n'est rattaché à rien n'est lisible que de son propriétaire).
 */
export async function canRead(db: Db, user: AuthUser, f: FileRow): Promise<boolean> {
  if (f.ownerId === user.sub) return true;
  if (f.status !== 'attached' || !f.refId) return false;
  switch (f.kind) {
    case 'proof': {
      // Photo de preuve : l'enseignant de la classe ; le parent de l'élève seulement si l'école l'a autorisé. Pas la direction.
      const [taskId, studentId] = f.refId.split(':');
      const [task] = taskId ? await db.select().from(tasks).where(eq(tasks.id, taskId)) : [];
      if (!task || !studentId || !user.schoolId && user.role !== 'parent') return false;
      if (user.role === 'enseignant') return !!user.schoolId && user.schoolId === task.schoolId && teachesClass(db, user.sub, task.schoolId, task.classId);
      if (user.role === 'parent') {
        if (!(await getSetting(db, task.schoolId, 'photos')).proofVisibleToParents) return false;
        const rows = await db.select({ id: studentParents.id }).from(studentParents).where(and(eq(studentParents.studentId, studentId), eq(studentParents.parentUserId, user.sub))).limit(1);
        return rows.length > 0;
      }
      return false;
    }
    case 'avatar': {
      const [owner] = await db.select({ id: users.id, schoolId: users.schoolId, visibility: users.photoVisibility }).from(users).where(eq(users.id, f.ownerId));
      if (!owner || owner.visibility === 'private') return false;
      if (!(await sameCommunity(db, user, owner))) return false;
      return owner.visibility === 'school' || user.role === 'enseignant';
    }
    case 'attachment': {
      const [a] = await db.select().from(announcements).where(eq(announcements.id, f.refId));
      if (!a) return false;
      if (user.role === 'etablissement') return user.schoolId === a.schoolId;
      const audience = a.audience;
      if (user.role === 'enseignant') return user.schoolId === a.schoolId && (!a.classId || a.authorId === user.sub || (await teachesClass(db, user.sub, a.schoolId, a.classId)));
      if (audience === 'teachers') return false;
      if (user.role === 'eleve') {
        if (audience === 'parents' || user.schoolId !== a.schoolId) return false;
        const classId = await studentClass(db, user.sub, a.schoolId);
        return !!classId && (!a.classId || a.classId === classId);
      }
      if (user.role === 'parent') return parentHasChild(db, user.sub, a.schoolId, a.classId);
      return false;
    }
    case 'report': {
      if (user.role === 'admin') return true;
      const [r] = await db.select().from(visitReports).where(eq(visitReports.id, Number(f.refId)));
      return !!r && user.role === 'etablissement' && r.visibleToSchool && user.schoolId === r.schoolId;
    }
    default:
      return false; // « message » : droits définis par la messagerie
  }
}
