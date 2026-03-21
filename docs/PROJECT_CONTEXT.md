Project: Wafuri-Idle

Goal:
Build a server-authoritative, browser-based idle game foundation inspired by World Flipper, with a clean backend architecture that can safely scale into multiplayer systems later.

Core Stack:
- Backend: Node.js + TypeScript + Express
- Frontend: React + TypeScript + Vite
- Database: PostgreSQL with Prisma
- Cache: Redis
- Auth: JWT access tokens + hashed refresh-token sessions
- Architecture: Request -> Route -> Controller -> Service -> DB

Core Principles:
- The server is authoritative. The client sends intent only.
- Services contain game/application logic and stay reusable outside HTTP.
- Given the same input state and `nowMs`, services must produce identical results.
- PostgreSQL is the source of truth. Redis is cache only.
- Player mutations must be concurrency-safe.
- Large progression values must remain numerically safe long-term.
- Config and feature flags are centralized.

Backend Structure:
- `server/src/routes`: endpoint definitions only
- `server/src/controllers`: request/response handling only
- `server/src/services`: game and auth logic only
- `server/src/db`: Prisma queries and repository access only
- `server/src/middleware`: auth, logging, rate limiting, error handling
- `server/src/config`: runtime config, game balance, feature flags
- `server/src/utils`: pure helpers, shared types, math, logging utilities

Current Gameplay Foundation:
- Idle mana progression is time-based and calculated on the server.
- Team power boosts mana generation.
- Upgrades increase both mana generation rate and team power.
- Offline progress is capped via config.
- Client polling displays server-calculated state only.

Current Player State Model:
- `mana`
- `manaGenerationRate`
- `teamPower`
- `lastUpdateTimestampMs`
- `version`
- `createdAt`
- `updatedAt`

Numeric Model:
- Large numeric progression values are stored as strings in PostgreSQL.
- Services use fixed-point `bigint` math internally.
- API responses return large numeric values as strings.
- Time units are explicit in milliseconds (`lastUpdateTimestampMs`, `elapsedMs`).
- Time-dependent services must receive the current time as an argument rather than reading system time internally.

Concurrency + Persistence Model:
- Backend is stateless for request handling across requests.
- Player state is never stored in process memory as a source of truth.
- Redis read flow: cache lookup -> DB on miss -> cache fill.
- Mutation flow: DB first -> cache overwrite.
- Player writes use optimistic locking with a `version` field.
- Repository mutation paths retry once on version conflict, then fail explicitly.
- Mutation endpoints should be safe to retry.
- Critical operations may use idempotency keys where needed.
- Session persistence exists only for authentication lifecycle management.

Authentication + Identity:
- Guest accounts are supported.
- Registered accounts use username, email, and password.
- Guest accounts can be upgraded in place to registered accounts.
- `Account` represents identity and authentication.
- `Player` represents game state only.
- `Account` and `Player` are separate but linked 1:1.
- `Session` stores hashed refresh tokens.
- `PasswordResetToken` supports password reset with expiry and single-use semantics.
- Email and username must be normalized before persistence.
- Database uniqueness must rely on normalized values.
- Account upgrade and password reset operations must be transactional.

Identity/Data Model:
- `Account`
  - account identity record
  - supports `GUEST` and `REGISTERED`
  - case-insensitive uniqueness through normalized username/email fields
- `Player`
  - gameplay state linked 1:1 to `Account`
  - includes optimistic-lock `version`
- `Session`
  - linked 1:many from `Account`
  - stores hashed refresh tokens with expiry/revocation support
- `PasswordResetToken`
  - linked 1:many from `Account`
  - stores hashed reset tokens with expiry and used markers

Current Auth/API Flows:
- `POST /auth/guest`
  - creates a guest account + player
  - issues access token + refresh token
- `POST /auth/login`
  - authenticates username/password
  - issues access token + refresh token
- `POST /auth/upgrade`
  - requires auth
  - upgrades the current guest account into a registered account
  - issues fresh access token + refresh token
- `POST /auth/request-password-reset`
  - generates and stores a hashed reset token
  - currently returns the raw token for a future email-delivery layer
  - returning the raw reset token is temporary for development only
  - production must deliver reset tokens via a secure email channel only
- `POST /auth/reset-password`
  - validates token
  - updates password
  - consumes the token
  - must remain single-use and safe under retry conditions

Current Game/API Flows:
- `GET /state`
  - requires auth
  - loads player state
  - applies idle progress once
  - persists updated state
  - returns serialized player state
- `POST /tick`
  - requires auth
  - applies idle progress once
  - persists updated state
  - returns serialized player state
- `POST /upgrade`
  - requires auth
  - applies idle progress once
  - applies upgrade once
  - persists updated state
  - returns serialized player state
  - should remain safe under client and network retry conditions

API Conventions:
- Success responses use:
  - `{ success: true, data: ... }`
- Error responses use:
  - `{ success: false, error: "message" }`
- Client-facing response shapes should remain backward-compatible.

Implemented Safety/Operations Layer:
- JWT auth middleware attaches `req.user = { accountId, playerId }`
- structured logging with `pino`
- global error handler
- rate limiting on mutation-heavy endpoints
- explicit runtime config validation at startup

Current Balance/Config Notes:
- Game balance lives in `GAME_CONFIG`.
- Feature switches live in `FEATURES`.
- Current flags keep gacha and multiplayer disabled.
- Refresh token TTL is configurable and currently defaults to 30 days.

Current Frontend State:
- Minimal React client focused on function over polish.
- Bootstraps auth through the guest flow.
- Stores auth token client-side and uses it for player endpoints.
- Displays mana, mana generation rate, and team power.
- Auto-refreshes player state from the server.

Out of Scope / Not Built Yet:
- Real multiplayer gameplay
- Gacha / summoning systems
- Character collection / team-building depth
- Pinball combat mechanics
- Social systems
- Production UI polish
- Background workers/queues
- Email delivery for password reset
- Refresh-token rotation or refresh endpoint

Development Guidance:
- Preserve strict layering.
- Keep services pure from Express concerns.
- Services must not call `Date.now()` internally for game logic.
- All time-dependent logic must receive `nowMs` as an argument.
- Avoid hardcoded balance values in services.
- Prefer explicit, composable functions over hidden coupling.
- Treat retries, stale cache data, and concurrent requests as normal conditions.
- Keep changes small, safe, and compatible with future workers and multiplayer systems.
