# Arche — one image for the web server and the deploy-time migration (derived from Keystone's, R-003). Runbook:
# docs/EXPLOITATION.md (French).
#   web server : the default command (next start on port 3400)
#   migration  : npm run db:migrate   (before the new version starts; ARCHE_SEED explicit on an empty schema)
# Arche runs on PostgreSQL only: DATABASE_URL is a runtime variable (the shared EPC2I server, schema `arche`, role arche_app).
# Coolify: deploy/compose.yaml.
FROM node:22-bookworm-slim

# curl stays: Coolify's own health check (enabled in its UI) needs curl or wget in the image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

COPY package.json package-lock.json ./
# Development dependencies are kept on purpose: tsx runs db:migrate.
RUN npm ci --no-audit

COPY . .

# Public URLs of the sibling apps, inlined in the browser bundles by `next build`: the ONLY build arguments (Coolify:
# variables marked "Available at build time"). Left empty they are unset, so the links keep their localhost defaults.
ARG NEXT_PUBLIC_KEYSTONE_URL
ARG NEXT_PUBLIC_CODEX_URL
ARG NEXT_PUBLIC_VIGIE_URL
RUN if [ -z "$NEXT_PUBLIC_KEYSTONE_URL" ]; then unset NEXT_PUBLIC_KEYSTONE_URL; fi; \
    if [ -z "$NEXT_PUBLIC_CODEX_URL" ]; then unset NEXT_PUBLIC_CODEX_URL; fi; \
    if [ -z "$NEXT_PUBLIC_VIGIE_URL" ]; then unset NEXT_PUBLIC_VIGIE_URL; fi; \
    npm run build

ENV NODE_ENV=production \
    ARCHE_DATA_DIR=/data \
    TZ=Europe/Paris \
    LOG_FORMAT=json \
    PORT=3400 \
    HOSTNAME=0.0.0.0

RUN mkdir -p /data && chown node:node /data && chown -R node:node /app/.next
USER node

EXPOSE 3400
# GET /api/health: 200 when the database answers and has no pending migration.
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3400/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3400"]
