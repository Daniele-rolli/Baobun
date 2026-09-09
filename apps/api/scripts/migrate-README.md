# Appwrite → Baobun migration

Run against Appwrite Cloud with a project owner API key.

## Local (dev)

```bash
cd apps/api
export APPWRITE_ENDPOINT=https://cloud.appwrite.io
export APPWRITE_PROJECT_ID=...
export APPWRITE_API_KEY=...
export APPWRITE_DB_ID=...
export APPWRITE_USERS_COLLECTION=...
export APPWRITE_GROUPS_COLLECTION=...
export APPWRITE_MEMBERS_COLLECTION=...
export APPWRITE_EVENTS_COLLECTION=...
export APPWRITE_TAGS_COLLECTION=...
export APPWRITE_AVATAR_BUCKET=...
export APPWRITE_TAG_ICONS_BUCKET=...
export APPWRITE_CALENDAR_FEEDS_BUCKET=...

node --env-file=.env scripts/migrate-from-appwrite.js --dry-run
node --env-file=.env scripts/migrate-from-appwrite.js
```

## Docker (compose stack)

The Baobun image includes the migration script. Run it from the repo root with
the stack up; `docker compose run app` inherits the database and local-storage
configuration. Only the Appwrite variables need to be passed in:

```bash
docker compose build app

# Dry run — prints counts, writes nothing
docker compose run --rm --no-deps \
  -e APPWRITE_ENDPOINT=https://cloud.appwrite.io \
  -e APPWRITE_PROJECT_ID=... \
  -e APPWRITE_API_KEY=... \
  -e APPWRITE_DB_ID=... \
  -e APPWRITE_USERS_COLLECTION=... \
  -e APPWRITE_GROUPS_COLLECTION=... \
  -e APPWRITE_MEMBERS_COLLECTION=... \
  -e APPWRITE_EVENTS_COLLECTION=... \
  -e APPWRITE_TAGS_COLLECTION=... \
  -e APPWRITE_AVATAR_BUCKET=... \
  -e APPWRITE_TAG_ICONS_BUCKET=... \
  -e APPWRITE_CALENDAR_FEEDS_BUCKET=... \
  app node scripts/migrate-from-appwrite.js --dry-run

# Real run — writes PostgreSQL + the Baobun data volume
docker compose run --rm --no-deps \
  -e APPWRITE_ENDPOINT=https://cloud.appwrite.io \
  -e APPWRITE_PROJECT_ID=... \
  -e APPWRITE_API_KEY=... \
  -e APPWRITE_DB_ID=... \
  -e APPWRITE_USERS_COLLECTION=... \
  -e APPWRITE_GROUPS_COLLECTION=... \
  -e APPWRITE_MEMBERS_COLLECTION=... \
  -e APPWRITE_EVENTS_COLLECTION=... \
  -e APPWRITE_TAGS_COLLECTION=... \
  -e APPWRITE_AVATAR_BUCKET=... \
  -e APPWRITE_TAG_ICONS_BUCKET=... \
  -e APPWRITE_CALENDAR_FEEDS_BUCKET=... \
  app node scripts/migrate-from-appwrite.js
```

`--no-deps` avoids starting (or re-creating) the stack; `docker compose run`
does not publish the service ports, so the running `app` container is unaffected.
The report is printed to stdout (in Docker, `migration-report.json` is written
inside the ephemeral container and discarded with `--rm` — copy the printed
report if you want to keep it).

## Notes

- Migrated users get `needsPasswordSet=true`; they'll receive a set-password email on first login.
- Calendar-feed object keys are reproduced so existing webcal subscriptions keep working.
