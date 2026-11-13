import type { INestApplication } from '@nestjs/common';
import { eq, notInArray } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { DEMO_SCHOOL_ID, DEMO_USERS, PRIVACY_THRESHOLD } from '@sge/shared';
import { classes, evaluations, organizations, studentParents, students, userScopes } from '../src/db/schema.js';
import { client, createApp, createUser, dbOf, reset } from './helpers.js';

interface Dash { head: { kicker: string }; kpis: { label: string; value: string; unit: string; sub: string }[]; chart: { rows: { label: string; pct: number; display?: string }[] }; side: { items: { title: string }[] }; table: { rows: string[][] }; nav: { label: string; badge?: string }[] }

/** Ticket #24 — les indicateurs viennent des données : ils changent avec elles et respectent le cloisonnement et le seuil de 10. */
describe('Indicateurs calculés (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  const today = new Date().toISOString().slice(0, 10);
  const get = (path: string, t: string) => c.api().get(path).set(c.as(t));
  const dash = async (space: string, t: string) => (await get(`/dashboard/${space}`, t).expect(200)).body as Dash;
  const kpi = (d: Dash, label: string) => d.kpis.find((k) => k.label === label)!;
  const badge = (d: Dash, label: string) => d.nav.find((n) => n.label === label)?.badge;
  const activate = async (phone: string) => {
    await c.api().post('/auth/otp/request').send({ phone }).expect(201);
    return (await c.api().post('/auth/otp/verify').send({ phone, code: '123456' }).expect(201)).body.accessToken as string;
  };
  let ecole: string;

  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(async () => { await reset(app); ecole = await c.token('etablissement'); });

  describe('tableau de bord de l’école', () => {
    it('reprend les effectifs réels : classes, comptes activés, enseignants', async () => {
      const d = await dash('ecole', ecole);
      const rows = d.table.rows;
      const students = (await get('/school/students', ecole).expect(200)).body as { activated: boolean }[];
      expect(kpi(d, 'Élèves actifs').unit).toBe(` / ${students.length}`);
      expect(rows.map((r) => r[0]).sort()).toEqual(['3ème B', '4ème A', '5ème B', '6ème C', 'Première C']);
      const teachers = (await get('/school/teachers', ecole).expect(200)).body as { status: string }[];
      expect(kpi(d, 'Enseignants').value).toBe(String(teachers.filter((t) => t.status === 'Activé').length));
      expect(kpi(d, 'Enseignants').unit).toBe(` / ${teachers.length}`);
    });

    it('la complétion augmente quand un élève termine une tâche', async () => {
      const before = Number(kpi(await dash('ecole', ecole), 'Complétion des tâches').value);
      const eleve = await c.token('eleve');
      await c.api().post('/me/student/tasks/k1/complete').set(c.as(eleve)).send({ evaluation: 'ok', proof: false, seconds: 30 }).expect(201);
      const after = Number(kpi(await dash('ecole', ecole), 'Complétion des tâches').value);
      expect(after).toBeGreaterThan(before);
    });

    it('les élèves actifs augmentent à l’activation d’un compte créé par l’école', async () => {
      const before = await dash('ecole', ecole);
      const [num, den] = [Number(kpi(before, 'Élèves actifs').value), Number(kpi(before, 'Élèves actifs').unit.replace(/\D/g, ''))];
      await c.api().post('/school/students').set(c.as(ecole)).send({ firstName: 'Nina', lastName: 'Obame', phone: '07 31 00 01', classId: '3b' }).expect(201);
      const created = await dash('ecole', ecole);
      expect([Number(kpi(created, 'Élèves actifs').value), Number(kpi(created, 'Élèves actifs').unit.replace(/\D/g, ''))]).toEqual([num, den + 1]); // créé, pas encore activé
      await activate('07 31 00 01');
      const activated = await dash('ecole', ecole);
      expect(Number(kpi(activated, 'Élèves actifs').value)).toBe(num + 1);
    });

    it('les parents rattachés, les notes saisies et l’appel suivent les données', async () => {
      const before = await dash('ecole', ecole);
      const row = (d: Dash, name: string) => d.table.rows.find((r) => r[0] === name)!;
      // un élève de l'école sans aucun parent rattaché
      const withParent = (await dbOf(app).select({ id: studentParents.studentId }).from(studentParents)).map((p) => p.id);
      const [kid] = await dbOf(app).select().from(students).where(withParent.length ? notInArray(students.id, withParent) : undefined).then((r) => r.filter((s) => s.schoolId === DEMO_SCHOOL_ID));
      const [cls] = await dbOf(app).select().from(classes).where(eq(classes.id, kid!.classId));
      const parentsOf = (d: Dash) => Number(row(d, cls!.name)[2]!.split(' / ')[0]);
      await dbOf(app).insert(studentParents).values({ studentId: kid!.id, name: 'Tuteur', relation: 'père', parentUserId: DEMO_USERS.parent.id });
      const after = await dash('ecole', ecole);
      expect(parentsOf(after)).toBe(parentsOf(before) + 1);
      expect(Number(kpi(after, 'Parents rattachés').value)).toBeGreaterThan(Number(kpi(before, 'Parents rattachés').value));
      // une évaluation sans aucune note fait baisser la saisie des notes de la classe
      const entry = (d: Dash) => Number(row(d, '3ème B')[3]!.replace(/\D/g, ''));
      const entered = entry(after);
      await dbOf(app).insert(evaluations).values({ id: 'ev-vide', schoolId: DEMO_SCHOOL_ID, classId: '3b', subject: 'Français', trimester: 'T1', label: 'Dictée', heldOn: today });
      expect(entry(await dash('ecole', ecole))).toBeLessThan(entered);
      // appel du jour saisi : « À jour »
      await c.api().post('/me/teacher/attendance').set(c.as(await c.token('enseignant'))).send({ classId: '3b', date: today, entries: [{ studentId: 's9', status: 'P' }] }).expect(201);
      expect(row(await dash('ecole', ecole), '3ème B')[4]).toBe('À jour');
    });

    it('les pastilles de navigation comptent les vraies absences et signalements', async () => {
      const before = await dash('ecole', ecole);
      const absences = Number(badge(before, 'Absences') ?? 0);
      await c.api().post('/me/teacher/attendance').set(c.as(await c.token('enseignant'))).send({ classId: '3b', date: today, entries: [{ studentId: 's9', status: 'A' }] }).expect(201);
      expect(Number(badge(await dash('ecole', ecole), 'Absences'))).toBe(absences + 1);
      expect(badge(before, 'Vie scolaire')).toBe('3'); // 3 signalements confidentiels à accuser
      await c.api().post('/school/cases/SC-0142/acknowledge').set(c.as(ecole)).expect(201);
      expect(badge(await dash('ecole', ecole), 'Vie scolaire')).toBe('2');
    });

    it('une classe en engagement faible est signalée dans « À traiter »', async () => {
      const d = await dash('ecole', ecole);
      expect(d.side.items.some((i) => /engagement faible/.test(i.title))).toBe(true);
      expect(d.chart.rows.find((r) => r.label === '3ème B')?.pct).toBeLessThan(45);
    });

    it('une école neuve est vide : aucun chiffre de démonstration, des « — » plutôt que 0 %', async () => {
      const admin = await c.token('admin');
      const created = (await c.api().post('/admin/organizations').set(c.as(admin)).send({ type: 'École', name: 'Collège Neuf', province: 'Nyanga', level: 'Collège', director: { name: 'Marie Obame', phone: '07 20 30 41' } }).expect(201)).body;
      expect(created.province).toBe('Nyanga');
      const neuf = await activate('07 20 30 41');
      const d = await dash('ecole', neuf);
      expect(kpi(d, 'Élèves actifs')).toMatchObject({ value: '0', unit: ' / 0' });
      expect(kpi(d, 'Complétion des tâches').value).toBe('—');
      expect(kpi(d, 'Parents rattachés').value).toBe('—');
      expect(d.table.rows).toEqual([]);
      expect(d.chart.rows).toEqual([]);
      expect(d.side.items.map((i) => i.title)).toEqual(['Rien à signaler']);
      expect(d.nav.filter((n) => n.badge)).toEqual([]);
      expect(d.head.kicker).toContain('Collège Neuf');
    });

    it('un autre établissement ne modifie pas mes chiffres (isolation)', async () => {
      const before = await dash('ecole', ecole);
      const other = await createUser(app, { id: 'u-dir-b', phone: '07000099', role: 'etablissement', schoolId: 'o6' });
      const b = await dash('ecole', other);
      await c.api().post('/school/students').set(c.as(other)).send({ firstName: 'Paul', lastName: 'Ndong', phone: '07 11 22 33', classId: 'b6a' }).expect(201);
      expect(await dash('ecole', ecole)).toEqual(before);
      expect(kpi(await dash('ecole', other), 'Élèves actifs').unit).not.toBe(kpi(b, 'Élèves actifs').unit);
    });
  });

  describe('vue réseau', () => {
    it('compare les écoles du même diocèse, pas les autres', async () => {
      const admin = await c.token('admin');
      await c.api().put(`/admin/subscriptions/${DEMO_SCHOOL_ID}`).set(c.as(admin)).send({ plan: 'Réseau', period: 'annuelle', start: '2026-01-01', end: '2027-12-31', active: true }).expect(200);
      const d = await dash('ecole/network', ecole);
      expect(d.table.rows.map((r) => r[0]).sort()).toEqual(['Collège Bessieux', 'Lycée Léon Mba', 'École Saint-Michel']); // enfants du Diocèse de Libreville
      expect(kpi(d, 'Établissements').value).toBe('3');
      const owendo = await createUser(app, { id: 'u-dir-o8', phone: '07000098', role: 'etablissement', schoolId: 'o8' });
      await c.api().put('/admin/subscriptions/o8').set(c.as(admin)).send({ plan: 'Réseau', period: 'annuelle', start: '2026-01-01', end: '2027-12-31', active: true }).expect(200);
      expect((await dash('ecole/network', owendo)).table.rows.map((r) => r[0])).toEqual(['Lycée d’Owendo']); // sans réseau : elle seule
    });
  });

  describe('espace agent', () => {
    it('ne contient que les écoles du périmètre, avec les mêmes chiffres partout', async () => {
      const agent = await c.token('agent');
      const d = await dash('agent', agent);
      const list = (await get('/agent/schools', agent).expect(200)).body as { name: string; active: string; completion: string; absences: string; status: string }[];
      expect(d.table.rows.map((r) => r[0])).toEqual(list.map((r) => r.name));
      expect(d.table.rows).toEqual(list.map((r) => [r.name, r.active, r.completion, r.absences, r.status]));
      expect(list.map((r) => r.name).sort()).toEqual(['Collège Bessieux', 'Collège de Nzeng-Ayong', 'Lycée Léon Mba', 'Lycée d’Owendo', 'École Akébé-Plaine', 'École Saint-Michel']);
      expect(kpi(d, 'Absences signalées').value).toBe(String(list.reduce((n, r) => n + Number(r.absences), 0)));
    });

    it('ajouter une école au périmètre l’ajoute aux chiffres ; une école hors périmètre reste introuvable', async () => {
      const agent = await c.token('agent');
      await dbOf(app).delete(userScopes).where(eq(userScopes.userId, DEMO_USERS.agent.id));
      await dbOf(app).insert(userScopes).values({ userId: DEMO_USERS.agent.id, orgId: 'o6' });
      expect((await get('/agent/schools', agent).expect(200)).body.map((r: { name: string }) => r.name)).toEqual(['Collège Bessieux']);
      await get('/agent/schools/Lyc%C3%A9e%20L%C3%A9on%20Mba', agent).expect(404);
      await dbOf(app).insert(userScopes).values({ userId: DEMO_USERS.agent.id, orgId: DEMO_SCHOOL_ID });
      const school = (await get('/agent/schools/Lyc%C3%A9e%20L%C3%A9on%20Mba', agent).expect(200)).body;
      expect(school.kpis.map((k: { label: string }) => k.label)).toEqual(['Comptes activés', 'Complétion', 'Absences', 'Dernière visite']);
      expect(school.activation[0][1]).toMatch(/^\d+ \/ \d+$/);
      expect((await dash('agent', agent)).table.rows).toHaveLength(2);
    });
  });

  describe('espace partenaire', () => {
    const seedSchool = async (id: string, province: string, level: string, count: number) => {
      const db = dbOf(app);
      await db.insert(organizations).values({ id, name: `École ${id}`, type: 'École', plan: 'Essentiel', status: 'Actif', province, level });
      await db.insert(classes).values({ id: `cl-${id}`, schoolId: id, name: '6ème A', level: 'Collège', capacity: 60 });
      await db.insert(students).values(Array.from({ length: count }, (_, i) => ({ id: `${id}-s${i}`, schoolId: id, firstName: `Prénom${i}`, lastName: `Nom${i}`, classId: `cl-${id}`, code: `9${id.length}${String(i).padStart(4, '0')}${id.length}`.slice(0, 6), activated: i % 2 === 0 })));
    };
    const province = async (partner: string, name: string) => ((await get('/partner/provinces', partner).expect(200)).body.rows as { province: string; schools: number; cells: (string | null)[] }[]).find((r) => r.province === name);

    it('masque une province de moins de 10 élèves puis la publie dès le 10e', async () => {
      const partner = await c.token('partenaire');
      await seedSchool('p1', 'Nyanga', 'Collège', PRIVACY_THRESHOLD - 1);
      expect((await province(partner, 'Nyanga'))?.cells).toEqual([null, null, null, null]);
      await dbOf(app).insert(students).values({ id: 'p1-s9', schoolId: 'p1', firstName: 'Dixième', lastName: 'Élève', classId: 'cl-p1', code: '123456', activated: true });
      const published = await province(partner, 'Nyanga');
      expect(published?.cells[0]).toBe('60 %'); // 6 comptes activés sur 10 (indices pairs 0,2,4,6,8 + le 10e)
      expect(published?.schools).toBe(1);
    });

    it('filtre par niveau et par région sur les vraies écoles', async () => {
      const partner = await c.token('partenaire');
      await seedSchool('p2', 'Nyanga', 'Lycée', 12);
      const rows = async (q: string) => ((await get(`/partner/provinces?${q}`, partner).expect(200)).body.rows as { province: string }[]).map((r) => r.province);
      expect(await rows('region=Toutes&level=Tous')).toEqual(expect.arrayContaining(['Estuaire', 'Nyanga']));
      expect(await rows('region=Intérieur&level=Tous')).toEqual(['Nyanga']);
      expect(await rows('region=Estuaire&level=Tous')).toEqual(['Estuaire']);
      expect(await rows('region=Toutes&level=Primaire')).toEqual(['Estuaire']); // Saint-Michel, Akébé-Plaine
      expect(await rows('region=Intérieur&level=Collège')).toEqual([]);
    });

    it('n’expose aucune cellule de moins de 10, aucun nom, et l’export CSV reprend l’écran', async () => {
      const partner = await c.token('partenaire');
      await seedSchool('p3', 'Haut-Ogooué', 'Collège', 4);
      const bodies = await Promise.all(['/partner/indicators', '/partner/provinces', '/partner/reports'].map(async (p) => (await get(p, partner).expect(200)).body));
      const reports = bodies[2].rows as { open: number | null; inProgress: number | null; closed: number | null }[];
      for (const r of reports) for (const v of [r.open, r.inProgress, r.closed]) expect(v === null || v >= PRIVACY_THRESHOLD).toBe(true);
      const all = JSON.stringify(bodies);
      for (const name of ['Brice', 'Nzé', 'Océane', 'Prénom0', 'Ndzengue']) expect(all).not.toContain(name);
      expect((bodies[1].rows as { province: string; cells: (string | null)[] }[]).find((r) => r.province === 'Haut-Ogooué')?.cells).toEqual([null, null, null, null]);
      const csv = (await get('/partner/export.csv?dataset=provinces', partner).expect(200)).text.split('\n');
      expect(csv[0]).toBe('province;établissements;activation;complétion;présence;signalements');
      expect(csv.find((l) => l.startsWith('Haut-Ogooué'))).toBe('Haut-Ogooué;1;;;;');
      const signalements = (await get('/partner/export.csv', partner).expect(200)).text.split('\n');
      expect(signalements).toHaveLength(reports.length + 1);
    });

    it('les indicateurs nationaux changent avec les données', async () => {
      const partner = await c.token('partenaire');
      const national = async () => ((await get('/partner/indicators', partner).expect(200)).body.kpis as { label: string; value: string; sub: string }[]);
      const before = (await national()).find((k) => k.label === 'Établissements')!;
      await seedSchool('p4', 'Ngounié', 'Collège', 11);
      const after = (await national()).find((k) => k.label === 'Établissements')!;
      expect(Number(after.value)).toBe(Number(before.value) + 1);
      expect(after.sub).toMatch(/dans 2 provinces/);
    });
  });

  describe('espace administrateur', () => {
    it('compte les écoles, les essais et le revenu récurrent à partir des abonnements', async () => {
      const admin = await c.token('admin');
      const before = await dash('admin', admin);
      expect(kpi(before, 'Écoles actives').sub).toBe('dont 1 en essai'); // Nzeng-Ayong
      expect(before.chart.rows.map((r) => r.label)).toEqual(['Essentiel', 'Standard', 'Réseau', 'Diocésain']);
      await c.api().put(`/admin/subscriptions/${DEMO_SCHOOL_ID}`).set(c.as(admin)).send({ plan: 'Standard', period: 'annuelle', start: '2026-01-01', end: '2027-12-31', active: false }).expect(200);
      const after = await dash('admin', admin);
      expect(Number(kpi(after, 'Écoles actives').value)).toBe(Number(kpi(before, 'Écoles actives').value) - 1);
      expect(kpi(after, 'Revenus récurrents').value).not.toBe(kpi(before, 'Revenus récurrents').value);
    });

    it('les incidents ouverts et les demandes de formule alimentent les pastilles', async () => {
      const admin = await c.token('admin');
      expect(badge(await dash('admin', admin), 'Incidents')).toBe('2');
      const incidents = (await get('/admin/incidents', admin).expect(200)).body as { id: string }[];
      await c.api().post(`/admin/incidents/${incidents[0]!.id}/resolve`).set(c.as(admin)).expect(201);
      expect(badge(await dash('admin', admin), 'Incidents')).toBe('1');
    });

    it('permet de situer une école existante', async () => {
      const admin = await c.token('admin');
      const org = (await c.api().patch('/admin/organizations/o6').set(c.as(admin)).send({ province: 'Ngounié', level: 'Lycée' }).expect(200)).body;
      expect(org).toMatchObject({ province: 'Ngounié', level: 'Lycée' });
      await c.api().patch('/admin/organizations/o1').set(c.as(admin)).send({ province: 'Ngounié' }).expect(404); // un diocèse n'a pas de province
      await c.api().patch('/admin/organizations/o6').set(c.as(ecole)).send({ province: 'Ngounié' }).expect(403);
    });
  });

  it('refuse l’espace d’un autre profil', async () => {
    await get('/dashboard/admin', ecole).expect(403);
    await get('/dashboard/partenaire', ecole).expect(403);
  });
});
