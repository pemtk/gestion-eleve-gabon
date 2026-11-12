# Contexte de construction : la racine du dépôt (docker build -f apps/api/Dockerfile .)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm ci -w @sge/api -w @sge/shared -w @sge/design-tokens
RUN npm run build:packages && npm run build -w @sge/api

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev -w @sge/api -w @sge/shared

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json /app/packages/shared/
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/apps/api/package.json /app/apps/api/
COPY --from=build /app/apps/api/dist /app/apps/api/dist
# Migrations SQL appliquées au démarrage (RUN_MIGRATIONS=false pour les jouer à part : npm run db:migrate)
COPY --from=build /app/apps/api/drizzle /app/apps/api/drizzle
USER node
EXPOSE 3000
# DATABASE_URL et JWT_SECRET sont obligatoires en production (voir .env.example)
CMD ["node", "apps/api/dist/main.js"]
