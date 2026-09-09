FROM node:24-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared packages/shared
COPY apps/api/prisma apps/api/prisma

RUN yarn install --frozen-lockfile
RUN yarn workspace @baobun/api prisma generate

COPY apps/api/src apps/api/src
COPY apps/api/scripts apps/api/scripts
COPY apps/api/entrypoint.sh apps/api/entrypoint.sh
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1
CMD ["sh", "entrypoint.sh"]
