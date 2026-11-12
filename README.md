# Gestion Élève — Gabon

Plateforme de suivi et de gestion des élèves pour les établissements scolaires du Gabon
(manuel utilisateur : sept profils, deux supports).

| Profil | Support | Où dans le code |
| --- | --- | --- |
| Élève, Parent, Enseignant | Mobile (Expo / React Native) | `apps/mobile/src/screens/{eleve,parent,prof}.tsx` |
| Établissement (admin école) | Web | `apps/web/app/routes/ecole/` |
| Agent | Web | `apps/web/app/routes/agent/` |
| Partenaire institutionnel | Web (lecture seule, données agrégées) | `apps/web/app/routes/partenaire/` |
| Administrateur plateforme | Web | `apps/web/app/routes/admin/` |

L'interface suit le design « plateforme multiprofile » (système **Classical** : Cormorant Garamond + Lora,
un accent doré, filets fins, contours plutôt que aplats).

## Architecture

```
apps/
  api/      NestJS 12 (ESM) — REST /api, JWT, validation zod, PostgreSQL (Drizzle ORM), Vitest
  web/      React Router 8 (mode framework, SSR) + Tailwind v4
  mobile/   Expo SDK 58 + expo-router, French UI, file d'attente hors ligne
packages/
  shared/         rôles et droits (§13.2 du manuel), schémas zod, règles métier, données de démo
  design-tokens/  jetons Classical : thème Tailwind (CSS) et équivalent React Native (TS)
```

Les règles métier vivent dans `packages/shared` et sont partagées par les trois applications :
règles du mot de passe, validation du CSV d'élèves, seuil de confidentialité (10), matrice des droits,
fonctionnalités par formule d'abonnement.

## Démarrer

Node ≥ 22.

```bash
npm install
docker compose up -d db    # PostgreSQL 16 sur localhost:5432 (ou votre propre serveur)
cp .env.example .env       # DATABASE_URL, secrets…
npm run build:packages     # compile packages/shared et packages/design-tokens
export DATABASE_URL=postgres://sge:sge@localhost:5432/sge
npm run dev:api            # applique les migrations, charge la démo, puis http://localhost:3000/api/health
npm run dev:web            # http://localhost:5173
npm run dev:mobile         # Expo (QR code / émulateur)
```

En développement, la page de connexion propose des **profils de démonstration**
(connexion directe, sans SMS). Code OTP en dehors de la production : `123456`.
Mot de passe des comptes de démo : `motdepasse1`.

Mobile : `EXPO_PUBLIC_API_URL` doit pointer vers l'API (émulateur Android : `http://10.0.2.2:3000/api`,
appareil réel : l'adresse IP de votre machine). Voir `.env.example`.

Tout lancer avec Docker : `docker compose up --build` (web : 5173, API : 3000).

## Vérifications

```bash
npm run typecheck   # tous les paquets
npm run lint        # API (oxlint)
npm test            # paquet partagé + API (unitaires, puis intégration sur PostgreSQL)
```

Les tests d'intégration de l'API exigent `DATABASE_URL` vers une base **dédiée aux tests**
(elle est vidée à chaque test) : `export DATABASE_URL=postgres://sge:sge@localhost:5432/sge_test`.

## Isolation entre établissements (multi-tenant)

Plusieurs écoles partagent la même base ; chacune ne voit et ne modifie que ses données.

- **Le tenant est l'organisation de type « École »** (`organizations`). Chaque compte scolaire (direction, enseignant,
  élève, parent) a un `school_id` ; agent, partenaire et administrateur n'en ont pas (profils multi-établissements).
- **L'identifiant d'école vient du jeton signé** (`schoolId`), jamais de l'URL ni du corps de la requête.
  Les contrôleurs le lisent avec `schoolOf(user)` et filtrent chaque requête dessus.
- **Une ressource d'une autre école est introuvable (404)**, en lecture comme en écriture : on ne révèle pas son existence.
- **La base l'impose aussi** : `school_id` obligatoire avec clé étrangère sur toutes les tables scolaires, et clé étrangère
  composite `students (class_id, school_id) → classes (id, school_id)` (un élève ne peut pas être rattaché à la classe d'une autre école).
- Par école : abonnement et formule (`org_subscriptions`), référent vie scolaire (`settings`), année scolaire, classes
  (nom unique **par école**), élèves, enseignants, absences, notes, annonces, signalements, tâches, conversations.
- Par utilisateur : points et série, préférences d'alerte, récompenses, notifications lues, visibilité de la photo.
- **L'agent** ne voit que les écoles de son périmètre (`user_scopes`). Les codes parents sont uniques sur toute la plateforme.
- Le jeu de démonstration contient **deux écoles** : Lycée Léon Mba (profils de démo) et Collège Bessieux
  (direction : `07 00 00 05` / `motdepasse1`, formule Essentiel). Les tests `apps/api/test/isolation.e2e-spec.ts` vérifient le cloisonnement.

## Base de données

PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) : schéma dans `apps/api/src/db/schema.ts`,
migrations SQL versionnées dans `apps/api/drizzle/`.

```bash
npm run db:generate -w @sge/api   # après une modification du schéma : crée la migration (à commiter)
npm run db:migrate  -w @sge/api   # applique les migrations (l'API le fait aussi au démarrage)
npm run db:seed     -w @sge/api   # REMET À ZÉRO puis charge le jeu de démonstration
```

- Au démarrage, l'API applique les migrations (`RUN_MIGRATIONS=false` pour les jouer à part).
- Le jeu de démonstration (Lycée Léon Mba) n'est chargé que dans une **base vide** et jamais par défaut en production
  (`SEED_DEMO=true` pour le forcer, par exemple pour une préproduction).
- Garanties assurées par la base : codes parents uniques, un message hors ligne n'est enregistré qu'une fois
  (index unique sur `client_id`), une tâche n'est validée qu'une fois, les transitions d'un signalement
  confidentiel sont atomiques, les corrections de notes sont historisées.

## CI/CD (GitHub Actions)

| Workflow | Déclencheur | Rôle |
| --- | --- | --- |
| `ci.yml` | push `main`, pull request | typecheck, lint, tests, builds API/web, bundle Android, icônes à jour, construction à blanc des images Docker |
| `release.yml` | push `main`, tag `vX.Y.Z` | publie `ghcr.io/<owner>/<repo>-api` et `-web` (GitHub Container Registry, sans secret) |
| `mobile.yml` | push `main` (mobile), tag `mobile-vX.Y.Z`, manuel | EAS Update (canal `preview`) et EAS Build. Secret : `EXPO_TOKEN` |

Dependabot met à jour npm (hebdo) et les actions (mensuel).
Production : `JWT_SECRET` (API) et `SESSION_SECRET` (web) sont **obligatoires** ; la connexion de démonstration est coupée.

## Limites connues (à traiter avant une mise en production)

- **Indicateurs** : les tableaux de bord (taux, volumes) affichent les valeurs du jeu de démonstration ; leur calcul
  à partir des données réelles (activité, présences…) reste à écrire.
- **Parent et enfants** : l'accueil du parent affiche les enfants du jeu de démonstration ; le rattachement par code
  est enregistré en base mais n'alimente pas encore cette liste. Les tâches sont communes à une école (pas encore par classe).
- **Défense en profondeur** : le cloisonnement est appliqué par l'application et par des contraintes ; PostgreSQL
  *Row Level Security* (politiques sur `school_id`) pourrait s'y ajouter pour qu'un oubli de filtre soit sans effet.
- **SMS** : `SmsGateway` journalise les messages ; brancher l'opérateur SMS (OTP, alertes, invitations).
- **Fichiers** : photos de preuve, pièces jointes et images de messagerie sont des indicateurs, sans stockage.
- **QR code** : l'écran « scanner » du parent est une maquette ; la saisie du code à 6 chiffres est fonctionnelle.
- **Notifications push** : l'interrupteur est en place, l'envoi (Expo Push) reste à brancher.

