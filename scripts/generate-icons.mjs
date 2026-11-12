#!/usr/bin/env node
/**
 * Génère la table d'icônes Lucide d'une application (web ou mobile).
 * On repère les chaînes « kebab-case » du code et des données partagées qui correspondent à une
 * icône Lucide, puis on n'importe que celles-là (pas de bibliothèque complète dans le bundle).
 *
 *   node scripts/generate-icons.mjs web      → apps/web/app/components/icons.generated.ts
 *   node scripts/generate-icons.mjs mobile   → apps/mobile/src/components/icons.generated.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const target = process.argv[2];
const cfg = {
  web: { pkg: 'lucide-react', src: 'apps/web/app', out: 'apps/web/app/components/icons.generated.ts' },
  mobile: { pkg: 'lucide-react-native', src: 'apps/mobile/src', out: 'apps/mobile/src/components/icons.generated.ts' },
}[target];
if (!cfg) throw new Error('Usage : generate-icons.mjs <web|mobile>');

const root = resolve(import.meta.dirname, '..');
// Les noms d'icônes sont identiques dans lucide-react et lucide-react-native ; la version web se charge sous Node.
const require = createRequire(join(root, 'apps', 'web', 'package.json'));
const lucide = require('lucide-react');

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.generated.ts')) files.push(p);
  }
};
walk(join(root, cfg.src));
walk(join(root, 'packages/shared/src'));

const pascal = (k) => k.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const found = new Map();
for (const file of files) {
  for (const m of readFileSync(file, 'utf8').matchAll(/['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)*)['"`]/g)) {
    const name = m[1];
    const comp = pascal(name);
    if (!found.has(name) && lucide[comp] && typeof lucide[comp] !== 'string') found.set(name, comp);
  }
}

const names = [...found.keys()].sort();
const out = `// Fichier généré par scripts/generate-icons.mjs — ne pas modifier à la main.
import {
${[...found.values()].sort().map((c) => `  ${c},`).join('\n')}
} from '${cfg.pkg}';

export const ICONS = {
${names.map((n) => `  '${n}': ${found.get(n)},`).join('\n')}
} as const;

export type IconName = keyof typeof ICONS;
`;
writeFileSync(join(root, cfg.out), out);
console.log(`${names.length} icônes → ${cfg.out}`);
