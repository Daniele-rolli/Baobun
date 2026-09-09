# Baobun

Baobun is a shared calendar for groups. Members can create groups, invite people, schedule
recurring events and email reminders, import or export `.ics` calendars, tag events, and
publish subscribable calendar feeds. Owner, admin, member, and viewer roles control who can
change shared data.

## Run with Docker Compose

Docker Compose is the recommended local and self-hosted setup. It starts only two containers:
the complete Baobun application and PostgreSQL. Uploaded files and feeds live in a persistent
application volume.

```sh
cp .env.example .env
docker compose up --build
```

Open the app at http://localhost:4173. The application container serves the Vue SPA, API,
uploads, and calendar feeds from that one origin. Data is kept in named Docker volumes
across restarts.

Stop the app with `docker compose down`. Avoid `docker compose down -v` unless you intend to
delete all Baobun data.

## Local development

Requirements: Node.js 22.12+ and Yarn 1.

```sh
yarn install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres
yarn api:dev
```

In a second terminal:

```sh
yarn watch
```

The Vite development server runs at http://localhost:4173 and proxies API requests to
http://localhost:3001.

## Quality checks

```sh
yarn build
yarn eslint .
```

With the Docker Compose stack running, execute the responsive browser and single-origin API
flows with:

```sh
yarn e2e
```

API tests require a dedicated test database configured in `apps/api/.env.test`; use
`apps/api/.env.example` as a starting point, then run:

```sh
yarn api:test
```

## Production deployment

See [`docs/deploy.md`](docs/deploy.md) for pre-built images, environment variables, TLS,
SMTP, reverse proxy guidance, updates, and verification.

For read-only integration tokens and endpoints, see [`docs/api.md`](docs/api.md).
