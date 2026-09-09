# Cutover: Appwrite Cloud → self-hosted Baobun

1. **Freeze writes**: In Appwrite console, set the project to read-only.
2. **Run the migration** — see `apps/api/scripts/migrate-README.md` for both local and Docker (`docker compose run api node scripts/migrate-from-appwrite.js`) execution:
   - `--dry-run` first — verify counts match.
   - Then the real run — writes PostgreSQL and the Baobun data volume; check the printed report.
3. **Deploy**: `docker compose build --pull && docker compose up -d` (app + PostgreSQL). See `docs/deploy.md` for `.env` and reverse-proxy setup.
4. **Verify**:
   - `curl localhost:3001/api/auth/me` → 401.
   - Register a fresh user; create a group; add an event; confirm it appears.
5. **User migration**:
   - Users log in → API returns `password_set_required` → they get a set-password email → they set a new password.
6. **Calendar feeds**:
   - Existing webcal subscriptions keep working (object keys reproduced).
   - New feed URLs are `https://<host>/api/calendar-feeds/<groupId>/<userId>.ics`.
7. **Decommission Appwrite** once no traffic for a week.

Rollback: keep the Appwrite project active (read-only) until step 7; the frontend can be pointed back at Appwrite by restoring the old `.env` and `src/lib/appwrite.js` from git.
