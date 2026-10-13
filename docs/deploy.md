# Baobun self-hosted deployment

Single-host deployment: frontend (static) + API (Hono/Node) + Postgres + MinIO + SMTP, all behind your existing reverse proxy.

TLS is handled independently of this stack: terminate HTTPS at your reverse
proxy or provider (Caddy, nginx, Traefik, Cloudflare Tunnel, …) and forward
plain HTTP to the containers. The only thing the app needs from you is its
public origin in `WEB_ORIGIN` (https URL). The session cookie is `Secure`,
so the browser-facing origin **must** be HTTPS — plain-HTTP deployments
cannot log in.

## Quick start (pre-built images)

No repo needed on the server. Images are published to GitHub Container
Registry on every version tag (`docker-publish.yml` workflow):

```sh
# Create a directory
mkdir -p ~/baobun && cd ~/baobun

# Download the prod compose file and env template
curl -fsSL https://raw.githubusercontent.com/Daniele-rolli/Baobun/master/docker-compose.prod.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Daniele-rolli/Baobun/master/.env.example -o .env

# Edit .env with your settings (see table below)
nano .env

# Pull and start
docker compose pull
docker compose up -d
```

Compose refuses to start without `POSTGRES_PASSWORD` and
`MINIO_ROOT_PASSWORD` — there are no default passwords in prod.

To update to the latest version:

```sh
docker compose pull
docker compose up -d
```

## From source (development)

Clone the repo and use the dev compose (includes Mailpit dev inbox):

```sh
git clone https://github.com/Daniele-rolli/Baobun.git
cd Baobun
cp .env.example .env
docker compose build
docker compose up -d
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` | `baobun` | Postgres user |
| `POSTGRES_PASSWORD` | *(required, no default)* | **Set a strong password** |
| `POSTGRES_DB` | `baobun` | Postgres database |
| `POSTGRES_PORT` | `5432` | Host port for Postgres (can stay internal) |
| `MINIO_ROOT_USER` | `baobun` | MinIO admin user |
| `MINIO_ROOT_PASSWORD` | *(required, no default)* | **Set a strong password** |
| `MINIO_API_PORT` | `9100` | Host port for MinIO S3 API (internal use only; do not expose) |
| `MINIO_CONSOLE_PORT` | `9101` | MinIO web console (dev only; do not expose in prod) |
| `WEB_ORIGIN` | `http://localhost:4173` | Public frontend origin. Used for CORS, password-reset links, **and** calendar-feed subscription URLs — must be the exact https URL users open. Comma-separated for multiple origins. |
| `API_PORT` | `3001` | Host port for the API (internal; only needs proxy access) |
| `FRONTEND_PORT` | `4173` | Host port for the frontend (internal; only needs proxy access) |
| `MAIL_DEBUG` | `false` | `true` = print mail previews to API logs instead of sending (dev only) |
| `MAIL_SENDER` | `Baobun <no-reply@baobun.local>` | From-address for emails |
| `MAIL_HOST` | *(empty = sending disabled)* | SMTP host (a real relay in production, e.g. your provider) |
| `MAIL_PORT` | `587` | SMTP port (587/465 for production) |
| `MAIL_USER` | *(empty)* | SMTP username |
| `MAIL_PASSWORD` | *(empty)* | SMTP password |
| `MAILPIT_UI_PORT` | `8025` | Mailpit dev inbox UI (dev compose only) |
| `MAILPIT_SMTP_PORT` | `1025` | Mailpit SMTP port (dev compose only) |

Production quick start (edit `.env`):

```env
POSTGRES_PASSWORD=<strong-password>
MINIO_ROOT_PASSWORD=<strong-password>
WEB_ORIGIN=https://baobun.example.com
MAIL_DEBUG=false
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=no-reply@example.com
MAIL_PASSWORD=<smtp-password>
```

Without a working SMTP relay, registration and login still work — only
password-reset and invitation emails are disabled.

## Reverse proxy routing

Point your domain at the host and proxy these paths. Frontend + API on one
origin is the recommended layout — it avoids CORS and `SameSite=Lax`
cookie issues:

| Path | Upstream |
|---|---|
| `/api/*` | `http://<host>:3001` |
| `/` (everything else) | `http://<host>:4173` (frontend) |

Calendar `.ics` subscription URLs are served by the API itself
(`/api/calendar-feeds/public/<token>.ics`), so no extra proxy entries are
needed. MinIO never needs to be reachable from browsers.

Example nginx snippets:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location / {
    proxy_pass http://127.0.0.1:4173;
}
```

Caddy equivalent (TLS automatic):

```
baobun.example.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        reverse_proxy 127.0.0.1:4173
    }
}
```

## HTTPS / cookies

The API sets a `Secure`, `httpOnly`, `SameSite=Lax` session cookie
(`baobun_sid`). Terminate TLS at your reverse proxy and forward to the
containers over plain HTTP — nothing in the stack needs certificates.

## Verify

- Frontend loads at `https://baobun.example.com` (200).
- Register a user → login succeeds and a `baobun_sid` cookie is set over HTTPS.
- Log out → the cookie is cleared (stays logged out after reload).
- Create a group and an event, publish the calendar feed, open the returned `.ics` URL in a browser.

## Migrating from Appwrite

If you are migrating an existing Appwrite dataset, run the one-shot ETL before going live — see `docs/runbooks/cutover.md` and `apps/api/scripts/migrate-README.md`.

## Useful commands

```sh
docker compose ps          # status
docker compose logs -f api # API logs
docker compose logs -f frontend
docker compose down        # stop (data persists)
docker compose down -v     # stop + wipe volumes (destructive!)
```
