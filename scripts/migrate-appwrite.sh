#!/bin/sh
set -eu

ENV_FILE=${APPWRITE_ENV_FILE:-.env.appwrite}
COMPOSE_FILE=${BAOBUN_COMPOSE_FILE:-docker-compose.baobun.yml}
SERVICE=${BAOBUN_SERVICE:-baobun}
MODE=${1:---dry-run}

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.appwrite.example to $ENV_FILE and fill in its values." >&2
  exit 1
fi

case "$MODE" in
  --dry-run)
    MIGRATION_ARGUMENT=--dry-run
    ;;
  --apply)
    MIGRATION_ARGUMENT=
    ;;
  --list)
    MIGRATION_ARGUMENT=--list
    ;;
  *)
    echo "Usage: $0 [--dry-run|--apply|--list]" >&2
    exit 1
    ;;
esac

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo "Running Appwrite migration mode: $MODE"
docker compose -f "$COMPOSE_FILE" run --rm --no-deps \
  -e APPWRITE_ENDPOINT \
  -e APPWRITE_PROJECT_ID \
  -e APPWRITE_API_KEY \
  -e APPWRITE_DB_ID \
  -e APPWRITE_USERS_COLLECTION \
  -e APPWRITE_GROUPS_COLLECTION \
  -e APPWRITE_MEMBERS_COLLECTION \
  -e APPWRITE_EVENTS_COLLECTION \
  -e APPWRITE_TAGS_COLLECTION \
  -e APPWRITE_AVATAR_BUCKET \
  -e APPWRITE_TAG_ICONS_BUCKET \
  -e APPWRITE_CALENDAR_FEEDS_BUCKET \
  "$SERVICE" node scripts/migrate-from-appwrite.js ${MIGRATION_ARGUMENT:+"$MIGRATION_ARGUMENT"}
