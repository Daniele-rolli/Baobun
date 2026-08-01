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
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "src/index.js"]
