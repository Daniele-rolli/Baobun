FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN yarn install --frozen-lockfile

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

FROM node:24-alpine AS runner

WORKDIR /app

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared packages/shared
COPY apps/api/prisma apps/api/prisma

RUN yarn install --frozen-lockfile --production=true
RUN yarn workspace @baobun/api prisma generate

COPY apps/api/src apps/api/src
COPY apps/api/scripts apps/api/scripts
COPY apps/api/entrypoint.sh apps/api/entrypoint.sh
COPY --from=builder /app/dist /app/dist

ENV NODE_ENV=production
ENV STATIC_DIR=/app/dist
ENV STORAGE_PATH=/data
ENV PORT=4173

WORKDIR /app/apps/api

EXPOSE 4173
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4173/api/health >/dev/null || exit 1

CMD ["sh", "entrypoint.sh"]
