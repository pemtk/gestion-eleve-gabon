import { defineConfig } from 'vitest/config';

// Tests d'intégration : ils tournent sur un vrai PostgreSQL (DATABASE_URL) et partagent la même base,
// donc les fichiers s'exécutent l'un après l'autre.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { globals: true, root: './', include: ['**/*.e2e-spec.ts'], fileParallelism: false, testTimeout: 20000, hookTimeout: 30000 },
});
