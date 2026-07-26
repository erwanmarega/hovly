# syntax=docker/dockerfile:1
#
# Base Node nue + Chromium seul, plutôt que mcr.microsoft.com/playwright : cette
# image embarque aussi Firefox et WebKit, jamais utilisés ici, et pèse 4,23 Go
# contre 628 Mo. Supprimer les navigateurs inutiles dans une couche ultérieure ne
# sert à rien — ils restent dans la couche de base — d'où le changement de base.
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=:: \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY package.json ./

# Utilise le playwright déjà installé : le binaire correspond donc forcément à
# la lib, sans tag d'image à tenir à jour.
RUN npx playwright install --with-deps chromium \
    && rm -rf /root/.npm /var/lib/apt/lists/*

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
