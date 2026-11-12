import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { DEMO_SCHOOL_ID } from '@sge/shared';
import { settings, students } from '../src/db/schema.js';
import { client, createApp, createUser, dbOf, reset } from './helpers.js';

type Row = { studentId: string; name: string; status: string; time?: string; evaluation?: string; justification?: string | null };

/** Espace enseignant : classes, tâches par classe et par élève, appel ↔ absences, notes, signalements, annonces. */
describe('Espace enseignant (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let prof: string;
  let direction: string;
  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(async () => { await reset(app); prof = await c.token('enseignant'); direction = await c.token('etablissement'); });
  const get = (path: string, t: string) => c.api().get(path).set(c.as(t));
  const post = (path: string, t: string, body?: object) => c.api().post(path).set(c.as(t)).send(body);
  /** Relie un compte élève à une fiche d'élève existante et retourne son jeton. */
  const studentAccount = async (studentId: string, phone: string) => {
    const t = await createUser(app, { id: `u-${studentId}`, phone, role: 'eleve', schoolId: DEMO_SCHOOL_ID });
    await dbOf(app).update(students).set({ userId: `u-${studentId}` }).where(eq(students.id, studentId));
    return t;
  };

  it('l’enseignant ne voit que les classes de ses affectations', async () => {
    const classes = (await get('/me/teacher/classes', prof).expect(200)).body as { id: string; name: string; students: number; subject: string }[];
    expect(classes.map((x) => [x.name, x.students])).toEqual([['3ème B', 8], ['4ème A', 2], ['6ème C', 1]]);
    expect(classes.every((x) => x.subject === 'Mathématiques')).toBe(true);
    const roster = (await get('/me/teacher/classes/3b/students', prof).expect(200)).body.map((s: { name: string }) => s.name);
    expect(roster).toEqual(['Aïcha Ondo', 'Cyrielle Mba', 'Daniel Obiang', 'Lionel Bekale', 'Mariam Ondimba', 'Nathan Ekomi', 'Océane Ndzengue', 'Patrick Obame']);
    await get('/me/teacher/classes/5b/students', prof).expect(404); // classe de l'école, mais pas la sienne
    await get('/me/teacher/classes/b6a/students', prof).expect(404); // classe d'une autre école
  });

  describe('tâches par classe et par élève (#16)', () => {
    it('une tâche n’est visible que des élèves de sa classe', async () => {
      const aicha = await c.token('eleve'); // 3ème B
      const brice = await studentAccount('s2', '06000002'); // 4ème A
      const created = await post('/me/teacher/tasks', prof, { classId: '4a', subject: 'Mathématiques', type: 'Exercice', title: 'Équations', description: 'Exercices 1 à 5', due: 'Demain' }).expect(201);
      expect(created.body.notified).toEqual({ students: 2, parents: 2 });
      const ids = async (t: string) => (await get('/me/student/tasks', t).expect(200)).body.tasks.map((x: { id: string }) => x.id);
      expect(await ids(brice)).toEqual([created.body.task.id]); // 4ème A : seulement sa tâche
      expect(await ids(aicha)).not.toContain(created.body.task.id);
      await get(`/me/student/tasks/${created.body.task.id}`, aicha).expect(404);
      await post(`/me/student/tasks/${created.body.task.id}/complete`, aicha, { evaluation: 'ok', seconds: 300 }).expect(404);
    });

    it('l’enseignant ne publie que dans ses classes', async () => {
      const body = { subject: 'Mathématiques', type: 'Cours', title: 'Hors classe', description: '', due: 'Demain' };
      await post('/me/teacher/tasks', prof, { ...body, classId: '5b' }).expect(404); // pas sa classe
      await post('/me/teacher/tasks', prof, { ...body, classId: 'b6a' }).expect(404); // autre école
      await post('/me/teacher/tasks', prof, { ...body, classId: '3b' }).expect(201);
    });

    it('l’avancement est propre à chaque élève', async () => {
      const aicha = await c.token('eleve');
      const oceane = await studentAccount('s12', '06000012'); // k1 : pas commencée
      const status = async (t: string) => (await get('/me/student/tasks/k1', t).expect(200)).body.status;
      expect(await status(aicha)).toBe('todo');
      expect(await status(oceane)).toBe('todo');
      await post('/me/student/tasks/k1/complete', oceane, { evaluation: 'doubt', seconds: 900 }).expect(201);
      expect(await status(oceane)).toBe('done');
      expect(await status(aicha)).toBe('todo'); // inchangé pour Aïcha
      await post('/me/student/tasks/k1/complete', oceane, { evaluation: 'ok', seconds: 900 }).expect(400); // une seule validation
    });

    it('le suivi montre l’état réel de chaque élève de la classe', async () => {
      const { body } = await get('/me/teacher/tasks/k1/follow-up', prof).expect(200);
      const by = Object.fromEntries((body.rows as Row[]).map((r) => [r.name, r.status]));
      expect(by).toMatchObject({ 'Aïcha Ondo': 'none', 'Cyrielle Mba': 'done', 'Mariam Ondimba': 'doing', 'Océane Ndzengue': 'none', 'Patrick Obame': 'done' });
      expect(body.rows).toHaveLength(8);
      expect(body.doubts).toBe(2);
      const oceane = await studentAccount('s12', '06000012');
      await post('/me/student/tasks/k1/complete', oceane, { evaluation: 'doubt', seconds: 900 }).expect(201);
      const after = (await get('/me/teacher/tasks/k1/follow-up', prof)).body;
      expect(after.rows.find((r: Row) => r.name === 'Océane Ndzengue')).toMatchObject({ status: 'done', evaluation: 'doubt', time: '15 min' });
      expect(after.doubts).toBe(3);
    });

    it('invalider renvoie la tâche à l’élève et annule ses points', async () => {
      const oceane = await studentAccount('s12', '06000012');
      await post('/me/student/tasks/k1/complete', oceane, { evaluation: 'ok', seconds: 900 }).expect(201);
      expect((await get('/me/student/trophies', oceane)).body.points).toBe(20);
      await post('/me/teacher/tasks/k1/invalidate/s12', prof).expect(201);
      expect((await get('/me/student/trophies', oceane)).body.points).toBe(0);
      expect((await get('/me/student/tasks/k1', oceane)).body).toMatchObject({ status: 'todo', redo: true });
      const row = (await get('/me/teacher/tasks/k1/follow-up', prof)).body.rows.find((r: Row) => r.studentId === 's12');
      expect(row).toMatchObject({ status: 'redo', time: 'points annulés' });
      await post('/me/teacher/tasks/k1/invalidate/s12', prof).expect(400); // déjà invalidée
      await post('/me/student/tasks/k1/complete', oceane, { evaluation: 'ok', seconds: 600 }).expect(201); // l'élève peut la refaire
      await post('/me/teacher/tasks/k1/invalidate/s7', prof).expect(404); // Grâce n'a pas commencé et n'est pas en 3ème B
    });
  });

  describe('appel et absences (#18)', () => {
    const day = '2026-11-11';
    const roll = async (t: string) => (await get(`/me/teacher/attendance?classId=3b&date=${day}`, t).expect(200)).body as Row[];
    const absences = async () => (await get('/school/absences', direction).expect(200)).body as { id: string; student: string; className: string; dateLabel: string; status: string; justification: string | null }[];

    it('l’appel de l’enseignant alimente la page Absences de l’école (source unique)', async () => {
      expect((await roll(prof)).every((r) => r.status === 'P')).toBe(true);
      const entries = [{ studentId: 's9', status: 'A' }, { studentId: 's10', status: 'R', justification: 'Maladie' }, { studentId: 's11', status: 'P' }];
      const saved = await post('/me/teacher/attendance', prof, { classId: '3b', date: day, entries }).expect(201);
      expect(saved.body).toEqual({ saved: 3, parentsNotified: 2 });

      const list = await absences();
      expect(list.find((a) => a.student === 'Lionel Bekale')).toMatchObject({ className: '3ème B', dateLabel: '11 nov.', status: 'A', justification: null });
      expect(list.find((a) => a.student === 'Mariam Ondimba')).toMatchObject({ status: 'R', justification: 'Maladie' });
      expect(list.find((a) => a.student === 'Nathan Ekomi')).toBeUndefined(); // présent : pas une absence
      expect((await get('/school/profile', direction)).body.badges.absences).toBe(2); // Hervé (5b) + Lionel
    });

    it('une modification de l’école se voit dans l’appel, et un appel rejoué ne duplique rien', async () => {
      await post('/me/teacher/attendance', prof, { classId: '3b', date: day, entries: [{ studentId: 's9', status: 'A' }] }).expect(201);
      await post('/me/teacher/attendance', prof, { classId: '3b', date: day, entries: [{ studentId: 's9', status: 'A' }] }).expect(201);
      const lionel = (await absences()).filter((a) => a.student === 'Lionel Bekale');
      expect(lionel).toHaveLength(1);

      await c.api().patch(`/school/absences/${lionel[0]!.id}`).set(c.as(direction)).send({ status: 'A', justification: 'Transport' }).expect(200);
      expect((await roll(prof)).find((r) => r.studentId === 's9')).toMatchObject({ status: 'A', justification: 'Transport' });

      await post('/me/teacher/attendance', prof, { classId: '3b', date: day, entries: [{ studentId: 's9', status: 'P' }] }).expect(201);
      expect((await absences()).some((a) => a.student === 'Lionel Bekale')).toBe(false); // corrigé : plus d'absence
    });

    it('refuse un élève hors classe, une classe qui n’est pas la sienne ou une date invalide', async () => {
      await post('/me/teacher/attendance', prof, { classId: '3b', date: day, entries: [{ studentId: 's7', status: 'A' }] }).expect(400); // Grâce est en 4ème A
      await post('/me/teacher/attendance', prof, { classId: '5b', date: day, entries: [] }).expect(404);
      await post('/me/teacher/attendance', prof, { classId: '3b', date: 'hier', entries: [] }).expect(400);
      await get('/me/teacher/attendance?classId=5b', prof).expect(404);
    });

    it('les absences d’une école ne sont pas vues par une autre', async () => {
      await post('/me/teacher/attendance', prof, { classId: '3b', date: day, entries: [{ studentId: 's9', status: 'A' }] }).expect(201);
      const other = await createUser(app, { id: 'u-dir-b', phone: '07000099', role: 'etablissement', schoolId: 'o6' });
      const seen = (await get('/school/absences', other).expect(200)).body as { student: string }[];
      expect(seen.some((a) => a.student === 'Lionel Bekale')).toBe(false);
    });
  });

  describe('notes, signalements et annonces (#17)', () => {
    it('les notes publiées par l’enseignant sont vues par l’élève, le parent et l’école', async () => {
      const aicha = await c.token('eleve');
      const parent = await c.token('parent');
      const entries = [{ studentId: 's1', value: 18, comment: 'Excellent' }, { studentId: 's3', value: 14 }, { studentId: 's9', value: 8 }];
      const pub = await post('/me/teacher/grades', prof, { classId: '3b', subject: 'Mathématiques', trimester: 'T1', label: 'Interrogation n°2', coefficient: 2, entries }).expect(201);
      expect(pub.body).toMatchObject({ published: 3, alreadyPublished: 0 });

      const maths = (await get('/me/student/results?trimester=T1', aicha)).body.subjects.find((s: { subject: string }) => s.subject === 'Mathématiques');
      expect(maths.notes.map((n: { label: string }) => n.label)).toContain('Interrogation n°2');
      expect(maths.notes.find((n: { label: string }) => n.label === 'Interrogation n°2')).toMatchObject({ value: 18, comment: 'Excellent' });
      // moyenne pondérée : (14×1 + 15,5×2 + 18×2) / 5 = 16,2
      expect(maths.average).toBe(16.2);
      const child = (await get('/me/parent/children/s1', parent)).body;
      expect(child.lastGrades[0]).toMatchObject({ subject: 'Mathématiques', value: 18 });

      const results = (await get(`/school/results?evaluation=${pub.body.evaluationId}`, direction)).body;
      expect(results).toMatchObject({ evaluation: 'Interrogation n°2', className: '3ème B', subject: 'Mathématiques' });
      expect(results.rows.find((r: { student: string }) => r.student === 'Lionel Bekale').value).toBe(8);
      expect(results.rows.find((r: { student: string }) => r.student === 'Daniel Obiang').published).toBe(false);
    });

    it('republier la même évaluation n’écrase aucune note et complète les manquantes', async () => {
      const base = { classId: '3b', subject: 'Mathématiques', trimester: 'T1', label: 'Interrogation n°3', coefficient: 1 };
      await post('/me/teacher/grades', prof, { ...base, entries: [{ studentId: 's1', value: 10 }] }).expect(201);
      const again = await post('/me/teacher/grades', prof, { ...base, entries: [{ studentId: 's1', value: 20 }, { studentId: 's3', value: 12 }] }).expect(201);
      expect(again.body).toMatchObject({ published: 1, alreadyPublished: 1 });
      const aicha = await c.token('eleve');
      const note = (await get('/me/student/results', aicha)).body.subjects.find((s: { subject: string }) => s.subject === 'Mathématiques').notes.find((n: { label: string }) => n.label === 'Interrogation n°3');
      expect(note.value).toBe(10);
    });

    it('refuse une matière non enseignée, un élève hors classe et des notes invalides', async () => {
      const base = { classId: '3b', trimester: 'T1', label: 'X', coefficient: 1 };
      await post('/me/teacher/grades', prof, { ...base, subject: 'Français', entries: [{ studentId: 's1', value: 10 }] }).expect(404); // enseigne les maths
      await post('/me/teacher/grades', prof, { ...base, subject: 'Mathématiques', entries: [{ studentId: 's7', value: 10 }] }).expect(400);
      await post('/me/teacher/grades', prof, { ...base, subject: 'Mathématiques', entries: [{ studentId: 's1', value: 21 }] }).expect(400);
      await post('/me/teacher/grades', prof, { ...base, subject: 'Mathématiques', entries: [] }).expect(400);
    });

    it('un signalement confidentiel crée un dossier pour le référent ; « conduite » reste visible de l’école', async () => {
      const conf = await post('/me/teacher/reports', prof, { studentId: 's2', kind: 'confidentiel', description: 'Brice est très isolé.' }).expect(201);
      const conduct = await post('/me/teacher/reports', prof, { studentId: 's3', kind: 'conduite', description: 'Bavardages répétés.' }).expect(201);
      expect(conf.body).toMatchObject({ caseId: 'SC-0300', referentNotified: true, detailShared: false });
      expect(conduct.body).toMatchObject({ caseId: 'SC-0301', referentNotified: false, detailShared: true });

      const ref = (await get('/school/referent', direction)).body;
      expect(ref.cases.map((x: { id: string }) => x.id)).toContain('SC-0300');
      expect(ref.cases.map((x: { id: string }) => x.id)).not.toContain('SC-0301');
      expect(ref.conduct.map((x: { id: string }) => x.id)).toEqual(['SC-0301']);
      const detail = (await get('/school/cases/SC-0300', direction).expect(200)).body;
      expect(detail.info).toMatchObject({ student: 'Brice Nzé', className: '4ème A', reporter: 'Enseignant · Serge Ndong' });
      expect(detail.state).toMatchObject({ step: 1 });
      await get('/school/cases/SC-0301', direction).expect(404); // pas de processus de référent pour la conduite
      expect((await get('/school/profile', direction)).body.badges.cases).toBe(4); // 3 existants + le nouveau
    });

    it('le confidentiel exige un référent confirmé ; l’élève doit être dans une classe de l’enseignant', async () => {
      await dbOf(app).delete(settings).where(eq(settings.schoolId, DEMO_SCHOOL_ID));
      await post('/me/teacher/reports', prof, { studentId: 's2', kind: 'confidentiel', description: 'x' }).expect(400);
      await post('/me/teacher/reports', prof, { studentId: 's2', kind: 'conduite', description: 'x' }).expect(201);
      await post('/me/teacher/reports', prof, { studentId: 's8', kind: 'conduite', description: 'x' }).expect(404); // Hervé : 5ème B
      await post('/me/teacher/reports', prof, { studentId: 'bs1', kind: 'conduite', description: 'x' }).expect(404); // autre école
    });

    it('l’annonce de classe est conservée avec ses vrais destinataires', async () => {
      const sent = await post('/me/teacher/announcements', prof, { classId: '3b', message: 'Évaluation demain, chapitre 3.' }).expect(201);
      expect(sent.body.recipients).toEqual({ students: 8, parents: 4 }); // 3ème B : Aïcha (2 parents) et Cyrielle (2)
      const list = (await get('/school/announcements', direction)).body as { message: string; target: string; audience: string }[];
      expect(list[0]).toMatchObject({ message: 'Évaluation demain, chapitre 3.', target: '3ème B', audience: 'class' });
      await post('/me/teacher/announcements', prof, { classId: '5b', message: 'Hors classe' }).expect(404);
      await post('/me/teacher/announcements', prof, { classId: '3b', message: '   ' }).expect(400);
    });

    it('liste les codes parents réels de la classe', async () => {
      const codes = (await get('/me/teacher/parent-codes?classId=3b', prof).expect(200)).body as { name: string; code: string; linked: number }[];
      expect(codes).toHaveLength(8);
      expect(codes.find((x) => x.name === 'Daniel Obiang')).toMatchObject({ code: '219 530', linked: 0 });
      expect(codes.find((x) => x.name === 'Aïcha Ondo')).toMatchObject({ code: '482 917', linked: 2 });
      await get('/me/teacher/parent-codes?classId=5b', prof).expect(404);
    });

    it('un autre établissement ne voit ni ces évaluations ni ces signalements', async () => {
      await post('/me/teacher/grades', prof, { classId: '3b', subject: 'Mathématiques', trimester: 'T1', label: 'Secrète', coefficient: 1, entries: [{ studentId: 's1', value: 11 }] }).expect(201);
      await post('/me/teacher/reports', prof, { studentId: 's2', kind: 'confidentiel', description: 'x' }).expect(201);
      const other = await createUser(app, { id: 'u-dir-b2', phone: '07000098', role: 'etablissement', schoolId: 'o6' });
      const r = (await get('/school/results', other)).body;
      expect(r).toMatchObject({ evaluations: [], rows: [] });
      expect((await get('/school/referent', other)).body.cases.map((x: { id: string }) => x.id)).not.toContain('SC-0300');
      await get('/school/cases/SC-0300', other).expect(404);
    });
  });
});
