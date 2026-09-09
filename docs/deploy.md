# Baobun self-hosted deployment

The production stack has two containers: Baobun and PostgreSQL. The Baobun container serves
the frontend, API, uploads, and calendar feeds on one port. Uploaded files are stored in a
Docker volume; SMTP is optional.

## Quick start (pre-built images)

No repo needed on the server. Pull pre-built images from GitHub Container Registry:

```sh
# Create a directory
mkdir -p ~/baobun && cd ~/baobun

# Download the prod compose file and env template
curl -fsSL https://raw.githubusercontent.com/Daniele-rolli/Baobun/main/docker-compose.prod.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Daniele-rolli/Baobun/main/.env.example -o .env

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

Only the first two values are required:

| Variable            | Default                          | Purpose                                                                         |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD` | —                                | **Required.** PostgreSQL password; use a long URL-safe value.                   |
| `PUBLIC_URL`        | —                                | **Required.** Public HTTPS URL, for example `https://baobun.example.com`.        |
| `FRONTEND_PORT`     | `4173`                           | The only host port published by the stack.                                      |
| `MAIL_DEBUG`        | `true`                           | Log messages instead of sending them. Set `false` when SMTP is configured.      |
| `MAIL_SENDER`       | `Baobun <no-reply@baobun.local>` | From-address for email.                                                         |
| `MAIL_HOST`         | _(empty)_                        | Optional SMTP host.                                                             |
| `MAIL_PORT`         | `587`                            | SMTP port.                                                                      |
| `MAIL_SECURE`       | `false`                          | Use implicit TLS, normally for port 465. STARTTLS on port 587 does not need it. |
| `MAIL_USER`         | _(empty)_                        | SMTP username.                                                                  |
| `MAIL_PASSWORD`     | _(empty)_                        | SMTP password.                                                                  |

Event reminders are delivered through this SMTP configuration. Set `PUBLIC_URL` to include
direct Baobun links in reminder messages. With `MAIL_DEBUG=true`, messages are logged instead
of delivered; this is useful locally but should not be used for production reminders.

Production quick start (edit `.env`):

```env
POSTGRES_PASSWORD=<strong-password>
PUBLIC_URL=https://baobun.example.com
MAIL_DEBUG=false
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=no-reply@example.com
MAIL_PASSWORD=<smtp-password>
```

## Reverse proxy routing

Point your domain to the Baobun application:

| Path                                               | Upstream             |
| -------------------------------------------------- | -------------------- |
| `/` (all paths, including `/api/*` and `/feeds/*`) | `http://<host>:4173` |

No CORS allowlist or path-specific reverse-proxy rules are needed. PostgreSQL is not
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

The app applies compatible Prisma schema updates before starting. If that update fails, the
container stops rather than running against an incompatible database; inspect
`docker compose logs app`, correct the database issue, and restart it.

## Migrating from Appwrite

If you are migrating an existing Appwrite dataset, run the one-shot ETL before going live — see `docs/runbooks/cutover.md` and `apps/api/migrate-README.md`.

## Useful commands

```sh
docker compose ps          # status
docker compose logs -f app # application logs
docker compose down        # stop (data persists)
docker compose down -v     # stop + wipe volumes (destructive!)
```
