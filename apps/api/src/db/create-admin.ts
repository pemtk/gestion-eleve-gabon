import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { createPlatformAdmin } from './admin.js';
import { databaseUrl } from './db.module.js';
import * as schema from './schema.js';

/**
 * `npm run admin:create -w @sge/api -- --name "Équipe plateforme" --phone "07 00 00 00"`
 * Le mot de passe se passe par la variable `ADMIN_PASSWORD` (jamais en argument : il resterait dans l'historique du shell).
 */
const arg = (flag: string) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };
const name = arg('--name') ?? process.env.ADMIN_NAME ?? 'Administrateur';
const phone = arg('--phone') ?? process.env.ADMIN_PHONE;
const password = process.env.ADMIN_PASSWORD;
if (!phone || !password) {
  console.error('Usage : ADMIN_PASSWORD=… npm run admin:create -w @sge/api -- --name "Nom" --phone "07 00 00 00"');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: databaseUrl() });
try {
  const admin = await createPlatformAdmin(drizzle(pool, { schema }), { name, phone, password });
  console.log(`Administrateur créé : ${admin.name} (+241 ${admin.phone}). Connexion : numéro + mot de passe, ou « Code SMS ».`);
} catch (e) {
  console.error(`Échec : ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
