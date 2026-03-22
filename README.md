# Wafuri-Idle

Current prototype for a World Flipper-inspired browser idle game built with TypeScript.

Wafuri-Idle is being built as a server-authoritative idle game foundation with deterministic simulation, concurrency-safe progression, and a backend that can grow into async multiplayer systems over time.

## Structure

- `server`: Express backend with stateless request handling, Prisma persistence, Redis-backed caching, JWT auth, and hashed refresh-token sessions
- `client`: React frontend with an explicit auth-entry flow, guest/login screens, authenticated game screen, and guest-upgrade modal

Backend layout:

- `server/src/routes`: endpoint definitions only
- `server/src/controllers`: request/response handling only
- `server/src/services`: reusable application and game logic
- `server/src/db`: Prisma client and repository queries
- `server/src/middleware`: auth and shared HTTP middleware
- `server/src/config`: environment-backed configuration
- `server/src/utils`: shared pure helpers and serialization

Game balance and feature toggles live in [server/src/config/index.ts](server/src/config/index.ts) via `GAME_CONFIG` and `FEATURES`, so values can be rebalanced centrally and moved to DB-backed config later without rewriting services.

## Current Features

- Player state persists in PostgreSQL instead of process memory
- Redis stores player cache entries
- Every authenticated request recalculates idle energy from `lastUpdateTimestampMs`
- Upgrades increase both `teamPower` and `energyPerSecond`
- Guest accounts can be created explicitly from the entry screen
- Registered accounts can log in with username/password
- Guest accounts can be upgraded in place via the in-game `Save Progress` flow
- Access and refresh tokens are rotated through `POST /auth/refresh` using stored refresh-token sessions
- The frontend uses an auth state machine instead of auto-creating a guest on startup
- Players can log out the current session or revoke all active sessions from the game screen

## Future Direction

The current energy-based prototype is temporary scaffolding. The next gameplay phase shifts the project toward a more explicit loop:

- idle Energy generation over time
- short deterministic burst runs
- rewards based on run outcomes such as damage, combos, and triggered effects
- stronger team-synergy decisions instead of simple linear stat growth

The short version is:

- idle phase: build resources and prepare runs
- active phase: trigger a short simulated run
- result phase: evaluate output and grant rewards

This is being designed so the same run outputs can later support async multiplayer systems such as guild-boss contributions, leaderboards, and shared progression without rewriting the core simulation model.

## Run

This repo requires Node.js 24+ and npm.
Use `nvm use` in the repo root before running project scripts.

1. Create the server env file:

```bash
cp server/.env.example server/.env
```

2. Start PostgreSQL and Redis, then update `server/.env` if needed.

Required variables:

- `DATABASE_URL`
- `DATABASE_URL_TEST`
- `REDIS_URL`
- `PORT`
- `JWT_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN`
- `REFRESH_TOKEN_TTL_MS`

3. Install dependencies:

```bash
npm install
```

4. Generate the Prisma client:

```bash
npm run prisma:generate --workspace server
```

5. Run the initial database migration:

```bash
npm run prisma:migrate --workspace server -- --name auto
```

6. Start the server:

```bash
npm run dev --workspace server
```

7. In a second terminal, start the client:

```bash
npm run dev --workspace client
```

8. Open `http://localhost:5173`

The frontend proxies REST calls to the backend on `http://localhost:3001`.

## OpenAPI Foundation

The repo now includes an initial generated OpenAPI contract at `openapi/openapi.json`.

Source of truth:

- `openapi/source.json`

Current scope:

- current auth endpoints
- current player gameplay endpoints
- standard success/error envelopes
- current run playback contract

Useful commands:

```bash
just openapi-generate
just openapi-check
```

When the server is running, the same document is also available at:

```text
http://localhost:3001/openapi.json
```

This is intentionally a foundation only. The contract is generated and validated, but client type generation and deeper schema-first runtime integration are still future work.

## Testing

- Server tests run against a dedicated test database when they touch persistence.
- By default, the test runner derives that database from `DATABASE_URL` by appending `_test`, or uses `DATABASE_URL_TEST` when provided explicitly.
- The dedicated test database is migrated before the suite and wiped after the suite completes.
- The normal development database is not used by `npm run test --workspace server`.

## Current Auth Flow

- First visit: the app shows an entry screen instead of auto-creating a guest account
- `Continue as Guest`: creates a guest account/player and authenticates immediately
- `Login`: authenticates an existing registered account
- `Save Progress`: available in-game for guest accounts to upgrade the current account in place
- Startup/bootstrap: the client validates the stored access token, attempts one refresh if needed, and falls back to explicit auth selection or login instead of silently creating a guest
- Runtime `401` handling: the client performs one single-flight refresh attempt, atomically stores the rotated token pair, retries once, and returns to the auth flow if refresh fails
- Session controls: the game screen exposes `Log Out` and `Log Out All Devices`, both of which clear local auth state and revoke sessions server-side via soft revocation

## Just Commands

This repo uses `just` for common local workflows.

Available recipes:

- `doctor`: verify Node, npm, and just are available
- `hooks-install`: configure this repo to use the versioned Git hooks
- `check-docker`: verify Docker and Docker Compose are available
- `infra-up`: start PostgreSQL and Redis from `compose.yaml`
- `wait-services`: wait for PostgreSQL and Redis to become ready
- `infra-down`: stop the local PostgreSQL and Redis containers
- `install`: install project dependencies
- `prisma-generate`: generate the Prisma client
- `prisma-migrate`: run the local Prisma migration with an automatic dev migration name
- `setup`: create env file, start infra, wait for readiness, install dependencies, generate Prisma client, and run migrations automatically
- `build`: build both server and client
- `test`: run lint, all server tests, and the client build
- `server`: run the backend dev server
- `client`: run the frontend dev server
- `run`: do the full local startup flow, then run server and client together

## Contributing With AI

AI-assisted contributions are welcome, but the repo has strong architectural constraints. Relevant guidance:

- [AGENTS.md](AGENTS.md)
- [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)

Key expectations for AI-generated changes:

- preserve the request flow: Route → Controller → Service → DB
- keep business logic in services, not routes or controllers
- do not pass Express `req` or `res` into services
- keep Prisma queries in the DB layer only
- treat PostgreSQL as source of truth and Redis as cache only
- keep game logic deterministic by passing `nowMs` explicitly
- keep player mutations safe under optimistic locking and retries
- do not move authoritative gameplay logic into the client

Recommended workflow:

1. Read the relevant files plus `AGENTS.md` before using an AI tool.
2. Provide the AI with a narrow task, clear file boundaries, and expected behavior.
3. Require an explanation of how the change respects determinism, layering, and concurrency-safety rules.
4. Review the diff manually before merging or adopting it.
5. Run `just test` or the narrowest relevant checks for the area changed.

Good AI tasks:

- adding small endpoints that follow the existing layering
- writing or extending repository tests
- refactoring duplicated controller or service code without changing behavior
- documenting flows and constraints

Bad AI tasks:

- broad architectural rewrites without first understanding the current design
- moving logic across layers for convenience
- introducing client-authoritative gameplay calculations
- changing API shapes casually
- bypassing optimistic locking, transactions, or auth/session rules

## Git Hooks

This repo includes versioned Git hooks under `.githooks`.

Install them once per clone with:

```bash
just hooks-install
```

Hook behavior:

- `pre-commit`: runs `just lint`
- `pre-push`: runs `just test`
