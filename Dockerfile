# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Kloyya API — Fastify + Better Auth.
#
# The API runs from TypeScript source via tsx, not from a compiled dist. Its
# workspace packages (@kloyya/core, @kloyya/db) ship as raw .ts through their
# package "exports", so `node dist/server.js` cannot load them — tsx transpiles
# them on the fly instead (the same mechanism the dev server already uses).
#
# Build context is the MONOREPO ROOT so pnpm can resolve the workspace. Only the
# API and the packages it depends on are installed (`--filter @kloyya/api...`);
# the web app is never built here.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="/pnpm:$PATH"
# corepack pins pnpm to the version in package.json's "packageManager" field.
RUN corepack enable
WORKDIR /app

# ── install: the API and its workspace dependencies, from the frozen lockfile ──
FROM base AS deps
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @kloyya/api...

# ── runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app /app
# The host injects PORT; config.ts reads PORT when API_PORT is unset. 4000 is the
# local default and just documents the exposed port here.
EXPOSE 4000
# Fastify binds 0.0.0.0, so the container is reachable from the platform's proxy.
CMD ["pnpm", "--filter", "@kloyya/api", "start"]
