import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import pg from 'pg';
import * as schema from './schema.js';
import { bootstrapAdmin } from './admin.js';
import { seedDemo } from './seed.js';

export const DB = Symbol('DB');
const POOL = Symbol('PG_POOL');
export type Db = NodePgDatabase<typeof schema>;

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'drizzle');

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL est obligatoire (ex. postgres://sge:sge@localhost:5432/sge).');
  return url;
}

@Global()
@Module({
  providers: [
    { provide: POOL, useFactory: () => new pg.Pool({ connectionString: databaseUrl(), max: Number(process.env.DB_POOL_MAX ?? 10) }) },
    {
      provide: DB,
      inject: [POOL],
      useFactory: async (pool: pg.Pool): Promise<Db> => {
        const db = drizzle(pool, { schema });
        const log = new Logger('Database');
        // Migrations appliquées au démarrage (désactivables : RUN_MIGRATIONS=false si elles sont jouées par le déploiement).
        if (process.env.RUN_MIGRATIONS !== 'false') {
          await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
          log.log('Migrations appliquées.');
        }
        // Données de démonstration : jamais par défaut en production.
        if (process.env.SEED_DEMO === 'true' || (process.env.SEED_DEMO !== 'false' && process.env.NODE_ENV !== 'production')) {
          if (await seedDemo(db, { onlyIfEmpty: true })) log.log('Données de démonstration chargées.');
        }
        // Premier administrateur (déploiement sans base de démonstration).
        if (await bootstrapAdmin(db)) log.log('Premier administrateur créé (BOOTSTRAP_ADMIN_*).');
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
