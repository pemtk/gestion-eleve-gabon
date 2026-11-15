/** Une affectation de l'enseignant : une classe pour une matière. */
export interface TeacherClass {
  id: string;
  name: string;
  subject: string;
  principal: boolean;
  students: number;
  /** Part des tâches terminées par la classe (null tant qu'aucune tâche n'est publiée). */
  pct: number | null;
}

export interface TeacherTaskRow {
  id: string;
  title: string;
  className: string;
  due: string;
  done: number;
  total: number;
}

export interface ClassStudent {
  id: string;
  name: string;
  initials: string;
}

export interface ParentCodeRow {
  studentId: string;
  name: string;
  initials: string;
  code: string;
  linked: number;
  validUntil: string;
}

export interface FollowUpRow {
  studentId: string;
  name: string;
  initials: string;
  status: 'none' | 'doing' | 'done' | 'redo';
  time: string;
  evaluation: string;
  proof: boolean;
  proofFileId: string | null;
}

export interface AttendanceLine {
  studentId: string;
  name: string;
  initials: string;
  status: 'P' | 'A' | 'R';
  justification: string | null;
}
