import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { databaseUrl } from './db.module.js';
import * as schema from './schema.js';
import { seedDemo } from './seed.js';

/** `npm run db:seed` : remet la base à zéro et charge les données de démonstration. */
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Refus : la base de production serait vidée. Définir ALLOW_DEMO_SEED=true pour forcer.');
}
const pool = new pg.Pool({ connectionString: databaseUrl() });
await seedDemo(drizzle(pool, { schema }));
await pool.end();
console.log('Données de démonstration chargées.');
