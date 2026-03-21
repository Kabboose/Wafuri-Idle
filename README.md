# Wafuri-Idle

Phase 2 prototype for a World Flipper-inspired browser idle game built with TypeScript.

## Structure

- `server`: Express backend with stateless request handling, Prisma persistence, Redis-backed caching, and guest-session auth
- `client`: React frontend that creates an anonymous guest session, polls the backend, and renders the current player state

## Phase 2 Features

- Player state persists in PostgreSQL instead of process memory
- Redis stores player cache entries and guest session tokens
- Every authenticated request recalculates idle mana from `lastUpdateTimestamp`
- Upgrades increase both `teamPower` and `manaGenerationRate`
- The frontend automatically creates and reuses a guest player via a bearer token in local storage

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
- `SESSION_TTL_SECONDS`

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
npm run prisma:migrate --workspace server
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

## Just Commands

`just` is installed locally at `~/.local/bin/just` in this environment.

If `just` is not on your `PATH`, run it as:

```bash
~/.local/bin/just <recipe>
```

Available recipes:

- `doctor`: verify Node, npm, and just are available
- `check-docker`: verify Docker and Docker Compose are available
- `infra-up`: start PostgreSQL and Redis from `compose.yaml`
- `wait-services`: wait for PostgreSQL and Redis to become ready
- `infra-down`: stop the local PostgreSQL and Redis containers
- `install`: install project dependencies
- `prisma-generate`: generate the Prisma client
- `prisma-migrate`: run the local Prisma migration
- `setup`: create env file, start infra, wait for readiness, install dependencies, generate Prisma client, and run migrations
- `build`: build both server and client
- `server`: run the backend dev server
- `client`: run the frontend dev server
- `dev`: do the full local startup flow, then run server and client together
