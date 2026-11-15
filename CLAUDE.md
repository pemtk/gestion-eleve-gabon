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
- **Multi-établissement** : toute requête sur des données scolaires filtre par `schoolOf(user)` (jeton, jamais l'URL ni le corps) ;
  une ressource d'une autre école répond 404. Toute nouvelle table scolaire porte `school_id` (clé étrangère vers `organizations`)
  et reçoit un cas de test dans `apps/api/test/isolation.e2e-spec.ts`. Données personnelles : rattacher à l'utilisateur (`user_id`).

## Qualité du code (à respecter pour toute modification)

- **Un fichier = une responsabilité.** Mobile : `apps/mobile/src/features/<fonctionnalité>/` avec un fichier par écran (`XxxScreen.tsx`),
  `components/` pour les composants, `use-xxx.ts` pour la logique, `types.ts` ; `src/app/**` ne fait que ré-exporter les écrans (routes expo-router).
  Web : une route par page dans `app/routes/**` (chargeur, action, composition), ses composants dans `app/components/<fonctionnalité>/` ;
  briques génériques dans `app/components/ui/` et `app/components/blocks/` (un fichier par composant, `index.ts` pour les ré-exporter).
- **Séparer logique et affichage** : l'état et les appels réseau dans un hook (`use-student-import.ts`, `use-thread.ts`), jamais de JSX renvoyé par un hook.
- **Taille** : viser moins de 200 lignes par fichier ; au-delà, extraire un composant, un hook ou un service. Noms explicites (`task`, pas `t`), en anglais ;
  texte d'interface et commentaires de description en français ; une description (`/** … */`) en tête de chaque écran, composant et service.
- **Mise en forme** : Prettier (largeur 100), vérifiée par la CI. `npm run format` avant de commiter, `npm run format:check` pour contrôler.
- **Jamais de valeur figée affichée comme réelle** (pastilles, indicateurs) : tout chiffre vient de l'API. Un bouton ou un lien d'action sans destination n'est pas affiché.
- **Interface** : tester l'affichage bureau (1440 px) et téléphone (390 px) ; chiffres alignés sur la ligne (pas d'elzéviriens), aucune action sans effet.

