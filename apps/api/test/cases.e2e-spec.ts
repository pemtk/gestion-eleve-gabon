import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { client, createApp, reset } from './helpers.js';

const id = 'SC-0142';

describe('Signalement confidentiel (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let t: string;
  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(async () => { await reset(app); t = await c.token('etablissement'); });
  const post = (path: string, body?: object) => c.api().post(`/school/cases/${id}/${path}`).set(c.as(t)).send(body);

  it('suit accusé → évaluation → plan d’action → clôture', async () => {
    expect((await post('acknowledge').expect(201)).body.step).toBe(2);
    expect((await post('evaluate', { gravity: 'Modérée', measures: 'Entretien', informDirector: true, informFamily: false }).expect(201)).body.step).toBe(3);
    await post('actions', { label: 'Entretien avec l’élève', owner: 'Référente' }).expect(201);
    expect((await post('prepare-close').expect(201)).body.step).toBe(4);
    expect((await post('close', { summary: 'Situation apaisée', directorAgreement: true }).expect(201)).body.step).toBe(5);
    const { body } = await c.api().get(`/school/cases/${id}`).set(c.as(t)).expect(200);
    expect(body.state.log.map((l: { event: string }) => l.event)).toEqual([
      'Accusé de réception · l’auteur est informé',
      'Évaluation : gravité modérée · directrice informée',
      'Action ajoutée : Entretien avec l’élève',
      'Signalement clos avec l’accord de la directrice',
    ]);
  });

  it('interdit de sauter une étape et de clore sans action', async () => {
    await post('evaluate', { gravity: 'Faible', measures: '', informDirector: false, informFamily: false }).expect(400);
    await post('acknowledge').expect(201);
    await post('evaluate', { gravity: 'Faible', measures: '', informDirector: false, informFamily: false }).expect(201);
    expect((await post('prepare-close').expect(400)).body.message).toMatch(/au moins une action/);
    await post('acknowledge').expect(400);
  });

  it('ne passe l’accusé de réception qu’une fois si deux clics arrivent ensemble', async () => {
    const results = await Promise.all([post('acknowledge'), post('acknowledge')]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 400]);
    const { body } = await c.api().get(`/school/cases/${id}`).set(c.as(t)).expect(200);
    expect(body.state.log).toHaveLength(1);
  });
});
