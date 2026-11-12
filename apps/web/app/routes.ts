import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  route('logout', 'routes/logout.tsx'),

  // Établissement (administrateur d'école)
  ...prefix('ecole', [
    layout('routes/ecole/layout.tsx', [
      index('routes/ecole/dashboard.tsx'),
      route('utilisateurs', 'routes/ecole/users.tsx'),
      route('utilisateurs/import', 'routes/ecole/import.tsx'),
      route('configuration', 'routes/ecole/config.tsx'),
      route('absences', 'routes/ecole/absences.tsx'),
      route('resultats', 'routes/ecole/results.tsx'),
      route('annonces', 'routes/ecole/announcements.tsx'),
      route('vie-scolaire', 'routes/ecole/referent.tsx'),
      route('vie-scolaire/:caseId', 'routes/ecole/case.tsx'),
      route('reseau', 'routes/ecole/network.tsx'),
      route('abonnement', 'routes/ecole/subscription.tsx'),
    ]),
  ]),

  // Agent
  ...prefix('agent', [
    layout('routes/agent/layout.tsx', [
      index('routes/agent/dashboard.tsx'),
      route('comptes-rendus', 'routes/agent/reports.tsx'),
      route('ecole', 'routes/agent/school.tsx'),
      route('alertes', 'routes/agent/alerts.tsx'),
    ]),
  ]),

  // Partenaire institutionnel (lecture seule, données agrégées)
  ...prefix('partenaire', [
    layout('routes/partenaire/layout.tsx', [
      index('routes/partenaire/dashboard.tsx'),
      route('regions', 'routes/partenaire/regions.tsx'),
      route('signalements', 'routes/partenaire/reports.tsx'),
      route('exports', 'routes/partenaire/exports.tsx'),
    ]),
    route('export.csv', 'routes/partenaire/export-csv.ts'),
  ]),

  // Administrateur plateforme
  ...prefix('admin', [
    layout('routes/admin/layout.tsx', [
      index('routes/admin/dashboard.tsx'),
      route('organisations', 'routes/admin/organizations.tsx'),
      route('abonnements', 'routes/admin/subscriptions.tsx'),
      route('utilisateurs', 'routes/admin/users.tsx'),
      route('incidents', 'routes/admin/incidents.tsx'),
    ]),
  ]),
] satisfies RouteConfig;
