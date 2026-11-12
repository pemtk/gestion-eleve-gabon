import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { Role } from '@sge/shared';
import { AppModule } from '../src/app.module.js';
import { DB, type Db } from '../src/db/db.module.js';
import { seedDemo } from '../src/db/seed.js';

/** Démarre l'application sur la base de DATABASE_URL (migrations appliquées) avec le jeu de démonstration remis à zéro. */
export async function createApp(): Promise<INestApplication<App>> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL est requis pour les tests d’intégration (ex. postgres://sge:sge@localhost:5432/sge_test).');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  await seedDemo(app.get<Db>(DB));
  return app;
}

export const dbOf = (app: INestApplication) => app.get<Db>(DB);
export const reset = (app: INestApplication) => seedDemo(dbOf(app));

export function client(app: INestApplication<App>) {
  const api = () => request(app.getHttpServer());
  const token = async (role: Role) => (await api().post(`/auth/demo/${role}`).expect(201)).body.accessToken as string;
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  return { api, token, as };
}
