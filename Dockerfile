# BillTime - self-host image (local-first, SQLite). One container, your data in a volume.
# Reliability over image size: we keep node_modules so the Prisma CLI + engine and
# `next start` are present at runtime (no standalone-trace surprises with Prisma).

FROM node:22-slim AS base
# openssl is required by the Prisma query engine on debian-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# /settings and /projects are prerendered at build time and read the DB, so the
# build needs a schema-initialised throwaway DB (runtime uses the volume DB instead).
ENV DATABASE_URL=file:/tmp/build.db
RUN npx prisma generate \
    && npx prisma migrate deploy --schema=./prisma/schema.prisma \
    && npm run build \
    && rm -f /tmp/build.db

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
# Default DB path inside the container. docker-compose bind-mounts the host's
# ./prisma here, so this is the SAME prisma/dev.db that `npm run dev` uses.
ENV DATABASE_URL=file:/app/prisma/dev.db
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
# entrypoint runs migrations against the DB, then starts Next
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
