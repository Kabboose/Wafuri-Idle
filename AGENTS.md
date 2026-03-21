# AGENTS.md

This file defines the project guardrails for future development in this repository.

## Core Intent

Wafuri-Idle is being built as a server-authoritative idle game foundation.
The codebase should optimize for:

- correctness under concurrent requests
- deterministic game logic
- clean separation of concerns
- long-term numeric safety
- predictable cache behavior
- easy future expansion into workers, multiplayer, and more systems

Do not trade these foundations away for short-term convenience.

## Architecture Rules

Backend structure under `server/src`:

- `routes`: endpoint definitions only
- `controllers`: request/response handling only
- `services`: game/application logic only
- `db`: Prisma client and database access only
- `middleware`: auth, logging, rate limiting, error handling
- `config`: runtime config, game balance, feature flags
- `utils`: pure helpers, shared types, formatting/math helpers

Expected flow:

`Request -> Route -> Controller -> Service -> DB`

Rules:

- Never put business logic in routes.
- Never pass `req` or `res` into services.
- Services must accept plain data and return plain data.
- Prisma queries belong in the DB layer only.
- Redis is cache only, never the source of truth.

## Auth Rules

- JWT auth is required for all player endpoints.
- `requireAuth` must attach `req.user = { playerId: string }`.
- Controllers read `req.user`.
- Services receive `playerId` as a plain argument.
- Services must not know about Express or JWT internals.

## Trust Model

The server is authoritative.

Rules:

- The client may only send intent, never authoritative values.
- All progression, rewards, and calculations must occur on the server.
- Never trust client-provided resource values or timestamps.

## API Conventions

Successful responses should use:

```json
{
  "success": true,
  "data": {}
}
```

Error responses should use:

```json
{
  "success": false,
  "error": "message"
}
```

Maintain this envelope unless there is a very strong reason not to.

## API Stability

Client-facing API contracts should remain stable.

Rules:

- Do not change response shapes without versioning or migration.
- Add new fields in a backward-compatible way.
- Avoid breaking existing clients.

## Game Logic Rules

Idle and upgrade logic are intentionally split:

- `progressPlayer(...)`
- `upgradePlayer(...)`

Do not re-introduce hidden coupling where one helper silently applies both unless there is a compelling design reason.

Per request:

- `/state` should apply idle progress only
- `/tick` should apply idle progress only
- `/upgrade` should apply idle progress once, then upgrade once

Capture `Date.now()` once per logical request mutation and pass it through.

## Concurrency Rules

Player state updates must be safe under concurrent requests.

Current strategy:

- players have a `version` field
- writes use optimistic locking (`id + version`)
- failed version checks retry once with fresh DB state
- repeated conflict throws an explicit error

Rules:

- Never do blind overwrites.
- Never bypass the version check for player state mutations.
- Cached state may be used as a hint only.
- DB state must win on conflict.

## Idempotency Rules

Some requests may be retried due to network issues, optimistic locking conflicts, or future worker/job retries.

Rules:

- Player mutations should be safe to retry when possible.
- Avoid duplicate application of the same logical action.
- Services must not assume a request only happens once.

Why this matters:

- optimistic locking retries can otherwise double-apply state changes
- future background jobs and queues will likely retry on failure
- client/network retries can repeat the same request unexpectedly

## Transaction Rules

Critical player state updates must be atomic.

Rules:

- Use database transactions where multiple writes must succeed together.
- Do not split dependent writes across separate operations.
- Ensure player state updates are committed or rolled back as a unit.

## Cache Rules

PostgreSQL is the source of truth.
Redis is cache only.

Current cache pattern:

- cache key: `player:{playerId}`
- read flow: Redis -> DB on miss -> store in Redis
- write flow: DB first -> overwrite Redis

Rules:

- Do not rely on Redis alone for correctness.
- Do not invalidate and then immediately rewrite the same player key; overwrite directly.
- Cache values may be stale, so repository write paths must tolerate stale cached state safely.

## Numeric Safety Rules

Idle games do not stay small.

Current numeric strategy:

- large numeric resources/rates are stored as strings in Postgres
- services use fixed-point `bigint`
- API returns large numeric values as strings

Rules:

- Do not introduce JS `number` for mana/resource values or generation rates.
- Keep all progression math in fixed-point helpers/services.
- Treat the client as display-only for large numbers.

## Time Rules

Time units must be explicit.

Rules:

- use `lastUpdateTimestampMs` naming for millisecond timestamps
- use `elapsedMs` naming for elapsed time in milliseconds
- offline progress must respect the configured max cap

Do not use ambiguous names like `timestamp` or `elapsed` when units matter.

## Balance and Feature Flags

All balance values must come from `GAME_CONFIG`.
All incomplete systems should be gated via `FEATURES`.

Rules:

- do not hardcode progression values in services
- add new balance knobs to config before using them
- add new unfinished systems behind feature flags by default

Config is intentionally structured so it can move to DB-backed config later.

## Logging and Safety

Use structured logs.

Rules:

- log requests
- log errors
- log key game actions with meaningful result context
- keep rate limiting on mutation-heavy endpoints

Do not log sensitive secrets or raw JWTs.

## Commenting and Documentation

- All functions should have docstrings.
- Add inline comments only for non-obvious behavior.
- Prefer concise explanations over noisy commentary.
- Preserve the existing standard when adding new code.

## Frontend Rules

- The client displays server-calculated state only.
- Do not move authoritative game logic into the client.
- Keep client-side number formatting safe for string-based large values.
- Keep API handling aligned with the success/error envelope.

## Worker Compatibility

Services must be reusable outside HTTP contexts.

Rules:

- Services must not depend on request lifecycle state.
- Services should be callable from background workers or jobs.
- Avoid assumptions about synchronous request-response flow.

## Migration Discipline

Schema changes are expected early.

Rules:

- update Prisma schema intentionally
- regenerate Prisma client after schema changes
- keep Just/README workflows aligned with migration behavior
- prefer getting naming right early over preserving a weak schema shape

## When Unsure

Prefer:

1. correctness over convenience
2. DB truth over cache assumptions
3. explicitness over magic
4. composable services over clever shortcuts
5. small, reversible changes over broad speculative rewrites
