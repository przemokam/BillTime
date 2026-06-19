#!/bin/sh
# Apply pending migrations to the volume DB (creates it on first run, no-op after),
# then hand off to the container command (next start).
set -e
echo "[billtime] applying migrations to ${DATABASE_URL}"
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "[billtime] starting server on port ${PORT:-3000}"
exec "$@"
