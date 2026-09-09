#!/bin/sh
set -e

echo "[entrypoint] Running prisma db push..."
npx prisma db push --skip-generate

echo "[entrypoint] Starting API..."
exec node src/index.js
