# Baobun read API

Baobun exposes a read-only API for personal integrations. Create and revoke tokens from
**Settings → API Access**. Tokens inherit the groups available to the user who created them.

Keep tokens secret. Send one in the standard bearer authorization header:

```http
Authorization: Bearer bbn_your_token
```

## List groups

```http
GET /api/v1/groups
```

The response includes each group's ID, name, color, caller role, member count, and event
count.

## Pull events and tags

```http
GET /api/v1/groups/:groupId/events
GET /api/v1/groups/:groupId/events?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z
```

`from` and `to` are optional ISO 8601 timestamps. The response contains events in ascending
start order and the group's tags. Recurring events are returned as materialized
occurrences, so consumers do not need to expand recurrence rules.

Tag image URLs are relative to the Baobun origin. Fetch them with the same bearer token.

Example:

```sh
curl https://baobun.example.com/api/v1/groups \
  -H "Authorization: Bearer $BAOBUN_TOKEN"
```

API traffic uses the same Baobun origin as the web application. No separate API hostname or
CORS configuration is required.
