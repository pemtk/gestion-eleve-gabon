# Conventions du dépôt

- Monorepo npm workspaces (`legacy-peer-deps` activé dans `.npmrc`). Node 22.
- Les règles métier et les schémas de validation vont dans `packages/shared` (puis `npm run build:packages`).
- Le texte de l'interface est en **français**.
- Design : système Classical. Couleurs et polices viennent de `packages/design-tokens`, jamais de valeurs en dur.
  Boutons = contour doré (pas de plein) ; titres en Cormorant Garamond, corps en Lora ; icônes Lucide.
- Icônes : après avoir utilisé un nouveau nom d'icône, lancer `npm run icons -w @sge/web` et/ou `-w @sge/mobile`
  (la CI vérifie que les fichiers `icons.generated.ts` sont à jour).
- API NestJS en ESM : les imports relatifs finissent par `.js` ; validation par schémas zod (`@Body({ schema })`) ;
  accès par `@Roles(...)` ; tests Vitest (`*.spec.ts` unitaires, `test/*.e2e-spec.ts` e2e).
- Web : routes déclarées dans `apps/web/app/routes.ts`, données par `loader`/`action` côté serveur
  (jeton dans un cookie de session httpOnly, jamais dans le navigateur).
- Mobile : expo-router ; onglets dans `(tabs)`, écrans de détail empilés par-dessus. Actions hors ligne :
  passer par `useSession().send` (file d'attente persistée, rejouée au retour du réseau).
- Base de données : Drizzle + PostgreSQL. Toute modification de `apps/api/src/db/schema.ts` s'accompagne d'une migration
  (`npm run db:generate -w @sge/api`, à commiter ; la CI vérifie). Les tests d'intégration utilisent un vrai PostgreSQL
  (`DATABASE_URL` vers une base de test, vidée à chaque test).
