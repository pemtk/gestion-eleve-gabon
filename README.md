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
  api/      NestJS 12 (ESM) — REST /api, JWT, validation zod, Vitest
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
npm run build:packages     # compile packages/shared et packages/design-tokens
npm run dev:api            # http://localhost:3000/api/health
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
npm test            # paquet partagé + API (unitaires et e2e)
```

## CI/CD (GitHub Actions)

| Workflow | Déclencheur | Rôle |
| --- | --- | --- |
| `ci.yml` | push `main`, pull request | typecheck, lint, tests, builds API/web, bundle Android, icônes à jour, construction à blanc des images Docker |
| `release.yml` | push `main`, tag `vX.Y.Z` | publie `ghcr.io/<owner>/<repo>-api` et `-web` (GitHub Container Registry, sans secret) |
| `mobile.yml` | push `main` (mobile), tag `mobile-vX.Y.Z`, manuel | EAS Update (canal `preview`) et EAS Build. Secret : `EXPO_TOKEN` |

Dependabot met à jour npm (hebdo) et les actions (mensuel).
Production : `JWT_SECRET` (API) et `SESSION_SECRET` (web) sont **obligatoires** ; la connexion de démonstration est coupée.

## Limites connues (à traiter avant une mise en production)

- **Persistance** : l'API garde ses données **en mémoire** (`apps/api/src/common/store.service.ts`),
  initialisées depuis `packages/shared/src/seed.ts`. Elles sont perdues au redémarrage. C'est le seul
  endroit à remplacer par une base de données (Nest propose TypeORM, Drizzle, Mongoose…).
- **SMS** : `SmsGateway` journalise les messages ; brancher l'opérateur SMS (OTP, alertes, invitations).
- **Fichiers** : photos de preuve, pièces jointes et images de messagerie sont des indicateurs, sans stockage.
- **QR code** : l'écran « scanner » du parent est une maquette ; la saisie du code à 6 chiffres est fonctionnelle.
- **Notifications push** : l'interrupteur est en place, l'envoi (Expo Push) reste à brancher.

