#!/bin/sh
set -e

echo "[entrypoint] Running prisma db push..."
npx prisma db push --skip-generate 2>&1 || echo "[entrypoint] prisma db push failed (non-fatal, continuing)"

echo "[entrypoint] Starting API..."
exec node src/index.js
