import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import type { Route } from './+types/root';
import { renewSession } from '~/lib/renew.server';
import './app.css';

export const middleware: Route.MiddlewareFunction[] = [renewSession];

export const links: Route.LinksFunction = () => [
  { rel: 'icon', type: 'image/png', href: '/favicon.png' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap',
  },
];

export const meta: Route.MetaFunction = () => [{ title: 'Suivi et Gestion des Élèves' }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-bg text-text font-body">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error)
    ? (typeof error.data === 'string' ? error.data : error.statusText)
    : error instanceof Error ? error.message : 'Une erreur est survenue.';
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="text-[11px] tracking-[.1em] uppercase text-accent-700">{notFound ? '404' : 'Erreur'}</p>
      <h1 className="mt-1 text-4xl">{notFound ? 'Page introuvable' : 'Un instant…'}</h1>
      <p className="mt-3 text-neutral-700">{notFound ? 'Cette page n’existe pas.' : message}</p>
      <a href="/" className="mt-6 inline-block">Retour à l’accueil</a>
    </main>
  );
}
