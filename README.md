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
- **Parents et enfants** : un parent voit les enfants rattachés à son compte (`student_parents.parent_user_id`), même dans
  plusieurs écoles. Un code valide rattache tout de suite ; un code déjà utilisé deux fois crée une demande que l'école
  valide (la validation crée le rattachement). Le temps de travail vient des séances chronométrées enregistrées à chaque
  tâche terminée (`work_sessions`).
- **Espace enseignant** : tout part de ses **affectations** (enseignant × classe × matière). Une classe qui n'y figure pas est
  introuvable (404), même dans la même école. Les **tâches** sont publiées pour une classe et leur **avancement est propre à
  chaque élève** (`task_completions` : en cours, terminée, à refaire, avec temps, auto-évaluation, preuve et points).
  L'**appel** (`attendance_records`) est l'unique source des absences : la page « Absences » de l'école en est une vue.
  Les **notes** sont des évaluations (classe × matière × trimestre × libellé) publiées par l'enseignant, visibles aussitôt
  de l'élève et du parent ; une note publiée n'est jamais écrasée (la correction passe par l'école, avec motif, historisée).
  Les **signalements** créent un dossier : « confidentiel » pour le référent, « conduite » visible de l'école.
- Par utilisateur : points et série, préférences d'alerte, récompenses, notifications lues, visibilité de la photo.
- **L'agent** ne voit que les écoles de son périmètre (`user_scopes`). Les codes parents sont uniques sur toute la plateforme.
- Le jeu de démonstration contient **deux écoles** : Lycée Léon Mba (profils de démo) et Collège Bessieux
  (direction : `07 00 00 05` / `motdepasse1`, formule Essentiel). Les tests `apps/api/test/isolation.e2e-spec.ts` vérifient le cloisonnement.

## Sécurité

- **Limitation des tentatives** (stockée en base, donc valable avec plusieurs instances) : 5 mots de passe faux par numéro en
  15 min → blocage 15 min ; 30 échecs par adresse IP ; 10 mauvais codes SMS par numéro ; 5 demandes de SMS par numéro et par heure
  (anti « SMS pumping ») ; 5 essais de mot de passe actuel. La réponse est un `429` avec `code: RATE_LIMITED` et `retryAfterSeconds`.
  Derrière un proxy, définir `TRUST_PROXY` (nombre de proxys, ex. `1`) pour que l'adresse IP lue soit celle du client.
- **Sessions** : jeton d'accès de **15 minutes** (`ACCESS_TOKEN_TTL_SECONDS`) + jeton de renouvellement opaque (haché en base, rotation à
  chaque usage, 14 jours, session limitée à 30 jours). Rejouer un jeton déjà remplacé révoque toute la session. Déconnexion
  (`/auth/logout`, `/auth/logout-all`), changement et réinitialisation du mot de passe révoquent les jetons de renouvellement ;
  une session révoquée cesse au plus tard à l'expiration du jeton d'accès. Le web renouvelle en silence (cookie httpOnly), le mobile
  aussi (stockage sécurisé).
- **En-têtes** : `helmet` (nosniff, HSTS, CSP `default-src 'none'`, pas de `X-Powered-By`…).
- **Journal d'audit** (`audit_log`, ajout seul) : chaque lecture et chaque action sur un signalement confidentiel, y compris les
  tentatives refusées (dossier d'une autre école, étape invalide), ainsi que les blocages de connexion et les changements de mot de
  passe. Lecture : `GET /school/audit-log` (direction, son école) et `GET /admin/audit-log` (administrateur).
- **Chiffrement des champs sensibles — évaluation** : non retenu pour l'instant. Les signalements confidentiels sont protégés par le
  cloisonnement par école, les droits et le journal d'audit ; un chiffrement applicatif des colonnes (`cases.text`, `summary`…)
  apporterait surtout une protection contre une fuite de la base ou des sauvegardes, au prix de la gestion des clés (rotation,
  perte) et de l'impossibilité de rechercher dans ces champs. À faire d'abord : chiffrement du disque et des sauvegardes chez
  l'hébergeur (voir #14). Si une exigence réglementaire l'impose ensuite : chiffrement AES-256-GCM par colonne avec clé en variable
  d'environnement (ou KMS) et identifiant de clé stocké avec la valeur, pour permettre la rotation.

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

## Comptes et mise en service d'une école

Un **numéro de téléphone = un compte** sur toute la plateforme. Les comptes créés par quelqu'un d'autre n'ont pas de
mot de passe : leur titulaire les active avec le **code SMS** (« Code SMS » + son numéro), puis peut choisir un mot de passe.

| Compte | Créé par | Comment |
| --- | --- | --- |
| Administrateur de la plateforme | l'exploitant | `ADMIN_PASSWORD=… npm run admin:create -w @sge/api -- --name "Équipe" --phone "07 00 00 00"` (ou, au démarrage, `BOOTSTRAP_ADMIN_PHONE` + `BOOTSTRAP_ADMIN_PASSWORD`, sans effet si un administrateur existe déjà) |
| Direction d'une école | l'administrateur | lors de la création de l'école (champs « Direction »), SMS d'invitation |
| Agent, partenaire | l'administrateur | « Utilisateurs institutionnels » ; l'agent n'accède qu'aux écoles de son périmètre |
| Enseignant | la direction | « Inviter un enseignant » (formule Standard et plus), renvoi possible |
| Élève | la direction | création manuelle ou import CSV : fiche + compte dans la même transaction, code parent à 6 chiffres |
| Parent | lui-même | inscription, puis rattachement à ses enfants avec le code parent |

Une école neuve se met donc en service **sans base de démonstration** : `SEED_DEMO=false`, création de l'administrateur,
création de l'école et de sa direction, puis classes, enseignants et élèves. Le parcours complet est testé dans
`apps/api/test/accounts.e2e-spec.ts`.

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
- **Défense en profondeur** : le cloisonnement est appliqué par l'application et par des contraintes ; PostgreSQL
  *Row Level Security* (politiques sur `school_id`) pourrait s'y ajouter pour qu'un oubli de filtre soit sans effet.
- **SMS** : `SmsGateway` journalise les messages ; brancher l'opérateur SMS (OTP, alertes, invitations).
- **Fichiers** : photos de preuve, pièces jointes et images de messagerie sont des indicateurs, sans stockage.
- **QR code** : l'écran « scanner » du parent est une maquette ; la saisie du code à 6 chiffres est fonctionnelle.
- **Notifications push** : l'interrupteur est en place, l'envoi (Expo Push) reste à brancher.

