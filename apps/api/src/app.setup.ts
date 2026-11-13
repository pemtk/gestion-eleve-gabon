import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * Réglages communs à l'API réelle et aux tests : en-têtes de sécurité (helmet) et adresse IP du client.
 * Derrière un proxy ou un répartiteur de charge, `TRUST_PROXY` (nombre de proxys, ex. 1) permet de lire la vraie adresse
 * dans X-Forwarded-For ; sans lui, l'adresse vue est celle du proxy et la limitation par IP perd son sens.
 */
export function configureApp(app: INestApplication): void {
  const express = app as NestExpressApplication;
  const trust = process.env.TRUST_PROXY;
  if (trust) express.set('trust proxy', /^\d+$/.test(trust) ? Number(trust) : trust);
  // API JSON : pas de page à protéger par une CSP complexe, mais tout le reste des protections par défaut s'applique.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
}
