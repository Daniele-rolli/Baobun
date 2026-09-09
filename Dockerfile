# Stage 1: Build the frontend
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

# Stage 2: Serve the app and proxy API/feed requests on the same origin
FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 4173

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4173/ >/dev/null || exit 1
