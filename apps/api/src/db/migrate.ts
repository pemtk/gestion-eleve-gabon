import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { databaseUrl, MIGRATIONS_DIR } from './db.module.js';

/** `npm run db:migrate` : applique les migrations puis quitte (déploiement, CI). */
const pool = new pg.Pool({ connectionString: databaseUrl() });
await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
await pool.end();
console.log('Migrations appliquées.');
