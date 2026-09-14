# Appwrite → Baobun migration

Run against Appwrite Cloud with a project owner API key.
The key needs read access to users, databases/documents, buckets, and files.

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

The Baobun image includes the migration program, and the repository includes a
wrapper that passes the Appwrite settings safely. From the repository root:

```bash
cp .env.appwrite.example .env.appwrite
# Fill in .env.appwrite with IDs and an Appwrite server API key.

# Start Baobun, validate access, and preview source counts.
docker compose -f docker-compose.baobun.yml up -d
./scripts/migrate-appwrite.sh --dry-run

# After the dry-run counts are correct, import the data.
./scripts/migrate-appwrite.sh --apply
```

Set `BAOBUN_COMPOSE_FILE` or `BAOBUN_SERVICE` when your merged Compose file has a
different path or service name. The migration is idempotent: rerunning it updates
records with the same source IDs rather than creating duplicates. It migrates auth
users, profiles, groups, memberships, events, tags, avatars, tag images, and
published calendar feeds.

## Notes

- Migrated users get `needsPasswordSet=true`; they'll receive a set-password email on first login.
- Calendar-feed object keys are reproduced so existing webcal subscriptions keep working.
- Always run `--dry-run` first and keep the Appwrite project unchanged until Baobun is verified.
