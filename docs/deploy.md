# Baobun self-hosted deployment

Single-host deployment: frontend (static) + API (Hono/Node) + Postgres + MinIO + SMTP, all behind your existing reverse proxy.

## Quick start (pre-built images)

No repo needed on the server. Pull pre-built images from GitHub Container Registry:

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

To update to the latest version:

```sh
docker compose pull
docker compose up -d
```

## From source (development)

Clone the repo and use the dev compose:

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
| `POSTGRES_PASSWORD` | `change_me` | **Set a strong password** |
| `POSTGRES_DB` | `baobun` | Postgres database |
| `POSTGRES_PORT` | `5432` | Host port for Postgres (can stay internal) |
| `MINIO_ROOT_USER` | `baobun` | MinIO admin user |
| `MINIO_ROOT_PASSWORD` | `change_me` | **Set a strong password** |
| `MINIO_API_PORT` | `9100` | Host port for MinIO S3 API (feeds served from here) |
| `MINIO_CONSOLE_PORT` | `9101` | MinIO web console |
| `S3_PUBLIC_ENDPOINT` | `http://localhost:9100` | Base URL for feed `.ics` URLs. In production set to the proxied MinIO URL, e.g. `https://baobun.example.com/feeds`. |
| `WEB_ORIGIN` | `http://localhost:4173` | CORS origin + password-reset link base. Must match the frontend's public origin. Comma-separated for multiple origins. |
| `API_PORT` | `3001` | Host port for the API |
| `FRONTEND_PORT` | `4173` | Host port for the frontend |
| `MAIL_DEBUG` | `true` | `true` = print mail previews (dev only). **In production set `false`** and configure real SMTP below. |
| `MAIL_SENDER` | `Baobun <no-reply@baobun.local>` | From-address for emails |
| `MAIL_HOST` | `mailpit` | SMTP host (in production a real relay, e.g. your provider) |
| `MAIL_PORT` | `1025` | SMTP port (587/465 for production) |
| `MAIL_USER` | *(empty)* | SMTP username |
| `MAIL_PASSWORD` | *(empty)* | SMTP password |
| `MAILPIT_UI_PORT` | `8025` | Mailpit dev inbox UI (dev only) |
| `MAILPIT_SMTP_PORT` | `1025` | Mailpit SMTP port (dev only) |

Production quick start (edit `.env`):

```env
POSTGRES_PASSWORD=<strong-password>
MINIO_ROOT_USER=<minio-user>
MINIO_ROOT_PASSWORD=<strong-password>
S3_PUBLIC_ENDPOINT=https://baobun.example.com/feeds
WEB_ORIGIN=https://baobun.example.com
MAIL_DEBUG=false
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=no-reply@example.com
MAIL_PASSWORD=<smtp-password>
```

## Reverse proxy routing

Point your domain's origin to the host and proxy these paths (frontend + API on one origin is the recommended layout — it avoids CORS and `SameSite=Lax` cookie issues):

| Path | Upstream |
|---|---|
| `/api/*` | `http://<host>:3001` |
| `/` (everything else) | `http://<host>:4173` (frontend) |

MinIO feed URLs come from `S3_PUBLIC_ENDPOINT`. Two options:

1. **Via the proxy** (recommended): set `S3_PUBLIC_ENDPOINT=https://baobun.example.com/feeds` and proxy:
   ```
   /feeds/* → http://<host>:9100
   ```
   The `.ics` files are served with a `public, max-age=60` cache header.

2. **Direct**: if `MINIO_API_PORT` is exposed publicly, keep `S3_PUBLIC_ENDPOINT` as `https://baobun.example.com:9100` or route a subdomain to port 9100.

Example nginx snippets:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /feeds/ {
    proxy_pass http://127.0.0.1:9100;
}

location / {
    proxy_pass http://127.0.0.1:4173;
}
```

## HTTPS / cookies

The API sets a `secure`, `httpOnly`, `SameSite=Lax` session cookie (`baobun_sid`). **HTTPS is mandatory** — the session cookie will not be sent over plain HTTP. Terminate TLS at your reverse proxy and let it forward to the containers.

## Verify

- Frontend loads at `https://baobun.example.com` (200).
- Register a user → login succeeds and a `baobun_sid` cookie is set over HTTPS.
- Create a group and an event, publish the calendar feed, open the returned `.ics` URL in a browser.

## Migrating from Appwrite

If you are migrating an existing Appwrite dataset, run the one-shot ETL before going live — see `docs/runbooks/cutover.md` and `apps/api/migrate-README.md`.

## Useful commands

```sh
docker compose ps          # status
docker compose logs -f api # API logs
docker compose logs -f frontend
docker compose down        # stop (data persists)
docker compose down -v     # stop + wipe volumes (destructive!)
```
