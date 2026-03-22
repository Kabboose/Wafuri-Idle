# Wafuri-Idle

Current prototype for a World Flipper-inspired browser idle game built with TypeScript.

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

Game balance and feature toggles live in [server/src/config/index.ts](/home/alexzervas/gitrepos/Wafuri-Idle/server/src/config/index.ts) via `GAME_CONFIG` and `FEATURES`, so values can be rebalanced centrally and moved to DB-backed config later without rewriting services.

## Current Features

- Player state persists in PostgreSQL instead of process memory
- Redis stores player cache entries
- Every authenticated request recalculates idle mana from `lastUpdateTimestampMs`
- Upgrades increase both `teamPower` and `manaGenerationRate`
- Guest accounts can be created explicitly from the entry screen
- Registered accounts can log in with username/password
- Guest accounts can be upgraded in place via the in-game `Save Progress` flow
- Access and refresh tokens are rotated through `POST /auth/refresh` using stored refresh-token sessions
- The frontend uses an auth state machine instead of auto-creating a guest on startup
- Players can log out the current session or revoke all active sessions from the game screen

## Run

This repo requires Node.js 20+ and npm.

1. Create the server env file:

```bash
cp server/.env.example server/.env
```

2. Start PostgreSQL and Redis, then update `server/.env` if needed.

Required variables:

- `DATABASE_URL`
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

## Current Auth Flow

- First visit: the app shows an entry screen instead of auto-creating a guest account
- `Continue as Guest`: creates a guest account/player and authenticates immediately
- `Login`: authenticates an existing registered account
- `Save Progress`: available in-game for guest accounts to upgrade the current account in place
- Startup/bootstrap: the client validates the stored access token, attempts one refresh if needed, and falls back to explicit auth selection or login instead of silently creating a guest
- Runtime `401` handling: the client performs one single-flight refresh attempt, atomically stores the rotated token pair, retries once, and returns to the auth flow if refresh fails
- Session controls: the game screen exposes `Log Out` and `Log Out All Devices`, both of which clear local auth state and revoke sessions server-side via soft revocation

## Just Commands

`just` is installed locally at `~/.local/bin/just` in this environment.

If `just` is not on your `PATH`, run it as:

```bash
~/.local/bin/just <recipe>
```

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
- `server`: run the backend dev server
- `client`: run the frontend dev server
- `run`: do the full local startup flow, then run server and client together

## Git Hooks

This repo includes versioned Git hooks under `.githooks`.

Install them once per clone with:

```bash
just hooks-install
```

Hook behavior:

- `pre-commit`: runs `just lint`
- `pre-push`: runs `just test`

## GitHub Enforcement

Local hooks are useful for fast feedback, but the real enforcement should happen in GitHub.

This repo now includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs:

- lint
- server auth tests
- client build

To enforce it for collaborators, enable branch protection on your main branch in GitHub:

1. Go to `Settings` -> `Branches`
2. Add a branch protection rule for `main`
3. Enable:
   - `Require a pull request before merging`
   - `Require status checks to pass before merging`
   - `Require branches to be up to date before merging` (recommended)
4. Mark the `lint-and-test` job from the `CI` workflow as a required status check
5. Optionally enable:
   - `Restrict who can push to matching branches`
   - `Do not allow bypassing the above settings`

Recommended model:

- local hooks: developer feedback
- required GitHub checks: actual merge enforcement
