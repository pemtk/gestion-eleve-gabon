# Contexte de construction : la racine du dépôt (docker build -f apps/web/Dockerfile .)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm ci -w @sge/web -w @sge/shared -w @sge/design-tokens
RUN npm run build:packages && npm run build -w @sge/web

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w @sge/web -w @sge/shared -w @sge/design-tokens

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json /app/packages/shared/
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/apps/web/package.json /app/apps/web/
COPY --from=build /app/apps/web/build /app/apps/web/build
WORKDIR /app/apps/web
USER node
EXPOSE 3000
# SESSION_SECRET et API_URL sont requis (voir .env.example)
CMD ["npx", "react-router-serve", "./build/server/index.js"]
