# Baobun self-hosted deployment

Single-host deployment: frontend (static) + API (Hono/Node) + Postgres + MinIO + SMTP.
The frontend container also proxies `/api` and `/feeds`, so only one app port needs to be
published through your reverse proxy.

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

| Variable              | Default                          | Purpose                                                                                            |
| --------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`       | `baobun`                         | Postgres user                                                                                      |
| `POSTGRES_PASSWORD`   | `change_me`                      | **Set a strong password**                                                                          |
| `POSTGRES_DB`         | `baobun`                         | Postgres database                                                                                  |
| `MINIO_ROOT_USER`     | `baobun`                         | MinIO admin user                                                                                   |
| `MINIO_ROOT_PASSWORD` | `change_me`                      | **Set a strong password**                                                                          |
| `PUBLIC_URL`          | _(derived)_                      | Optional canonical app URL. Normally derived from standard `Host` and `X-Forwarded-Proto` headers. |
| `FRONTEND_PORT`       | `4173`                           | The only host port published by the production stack                                               |
| `MAIL_DEBUG`          | `true`                           | `true` = print previews. **In production set `false`** and configure real SMTP.                    |
| `MAIL_SENDER`         | `Baobun <no-reply@baobun.local>` | From-address for emails                                                                            |
| `MAIL_HOST`           | `mailpit`                        | SMTP host (in production, use a real relay)                                                        |
| `MAIL_PORT`           | `1025`                           | SMTP port                                                                                          |
| `MAIL_USER`           | _(empty)_                        | SMTP username                                                                                      |
| `MAIL_PASSWORD`       | _(empty)_                        | SMTP password                                                                                      |

Event reminders are delivered through this SMTP configuration. Set `PUBLIC_URL` to include
direct Baobun links in reminder messages. With `MAIL_DEBUG=true`, messages are logged instead
of delivered; this is useful locally but should not be used for production reminders.

Production quick start (edit `.env`):

```env
POSTGRES_PASSWORD=<strong-password>
MINIO_ROOT_USER=<minio-user>
MINIO_ROOT_PASSWORD=<strong-password>
# Optional; forwarded headers are used when omitted.
PUBLIC_URL=https://baobun.example.com
MAIL_DEBUG=false
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=no-reply@example.com
MAIL_PASSWORD=<smtp-password>
```

## Reverse proxy routing

Point your domain to the frontend container. It serves the SPA and proxies API and feed
traffic internally, keeping authentication and calendar feeds on one origin:

| Path                                               | Upstream             |
| -------------------------------------------------- | -------------------- |
| `/` (all paths, including `/api/*` and `/feeds/*`) | `http://<host>:4173` |

No CORS allowlist or path-specific reverse-proxy rules are needed. The frontend container
forwards `/api` and `/feeds` internally. Postgres, the API, MinIO, and Mailpit are not
published by the production Compose file.

Example nginx snippets:

```nginx
location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## HTTPS / cookies

The API sets a `secure`, `httpOnly`, `SameSite=Lax` session cookie (`baobun_sid`). **HTTPS is mandatory** — the session cookie will not be sent over plain HTTP. Terminate TLS at your reverse proxy and let it forward to the containers.

## Verify

- Frontend loads at `https://baobun.example.com` (200).
- Register a user → login succeeds and a `baobun_sid` cookie is set over HTTPS.
- Create a group and a recurring event, then verify its occurrences in the calendar.
- Import a small `.ics` file and verify the imported event.
- Publish the calendar feed and open the returned `.ics` URL in a browser.
- Create a token under **Settings → API Access** and call `GET /api/v1/groups` using the
  example in [`api.md`](api.md).

The API applies compatible Prisma schema updates before starting. If that update fails, the
container stops rather than running against an incompatible database; inspect
`docker compose logs api`, correct the database issue, and restart it.

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
