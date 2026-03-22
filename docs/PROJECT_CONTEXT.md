Project: Wafuri-Idle

Goal:
Build a server-authoritative, browser-based idle game inspired by World Flipper.

The game combines:
- idle progression (resource generation over time)
- short active “burst run” gameplay loops
- team synergy and future gacha systems
- async-first multiplayer compatibility

The architecture must support deterministic simulation, concurrency safety, and future scaling into multiplayer systems.

---

Core Stack:
- Backend: Node.js + TypeScript + Express
- Frontend: React + TypeScript + Vite
- Database: PostgreSQL (Prisma)
- Cache: Redis
- Auth: JWT access tokens + rotated, hashed refresh-token sessions
- Architecture: Request → Route → Controller → Service → DB

---

Core Principles:
- Server authoritative; client sends intent only
- Services keep business/application logic reusable outside HTTP
- Services accept plain data and return plain data
- Same input + same `nowMs` = same result
- PostgreSQL is source of truth; Redis is cache only
- All player mutations are concurrency-safe
- Large numbers use fixed-point bigint (stored as strings)
- Time is always passed explicitly (`nowMs`)
- Config + feature flags centralized
- API responses use the standard success/error envelope

---

Backend Structure:
- routes → controllers → services → db
- services contain business logic only
- no Express objects in services
- Prisma only in db layer

---

Authentication + Identity (CURRENTLY IMPLEMENTED)

System includes:
- Guest accounts (explicit creation only)
- Registered accounts with username + email + password
- Guest → registered upgrade flow
- JWT access tokens
- Rotating refresh tokens (hashed in DB)
- Session table with soft revocation (`revokedAt`)
- Replay detection with account-wide session revocation
- Logout (single session)
- Logout-all (global session invalidation)
- Immediate access-token invalidation via `sessionVersion`

Key behavior:
- Refresh tokens rotate on every use
- Reuse of old refresh token triggers replay detection
- Replay detection revokes all sessions
- Logout-all revokes all sessions AND invalidates all access tokens immediately

---

Identity/Data Model:
- Account (identity + auth)
  - type: GUEST | REGISTERED
  - sessionVersion (for global invalidation)
- Player (game state, 1:1 with Account)
- Session (hashed refresh tokens, revocation-aware)
- PasswordResetToken (hashed, single-use)

---

Frontend Auth System (COMPLETE)

Auth state machine:
- loading
- needsSelection (guest vs login)
- needsLogin
- authenticated

Behavior:
- no automatic guest creation
- explicit user intent required
- bootstrap attempts access → refresh → fallback
- API client:
  - attaches JWT
  - retries once after refresh
  - uses single-flight refresh pattern
- auth failures reset app state cleanly

UI includes:
- entry screen
- login screen
- game screen
- upgrade modal (“Save Progress”)

---

Current Gameplay Foundation (PROTOTYPE)

- Idle resource generation exists using Energy
- Energy accumulation is capped by `maxEnergy`
- Upgrade system affects generation and power
- Run entry cost exists through `runEnergyCost`
- Reward output currently grants:
  - currency from damage
  - progression from combo
- Current authenticated gameplay endpoints are:
  - `GET /state` applies idle progress only
  - `POST /tick` applies idle progress only
  - `POST /upgrade` applies idle progress once, then upgrade once
  - `POST /run` applies idle progress, checks affordability, spends energy, simulates a deterministic run, calculates rewards, and persists the updated player state
- Player state:
  - energy
  - maxEnergy
  - energyPerSecond
  - currency
  - progression
  - teamPower
  - version
  - lastUpdateTimestampMs

Deterministic run simulation currently implemented:
- fixed-duration runs
- seeded RNG
- summary output:
  - totalDamage
  - comboCount
  - summary triggers
- playback output:
  - arena snapshot
  - deterministic entity list
  - ordered event timeline

Playback currently supports:
- one ball
- a small deterministic enemy set
- phase events
- straight-line ball path segments
- collision events
- damage events
- sparse trigger events

Current playback trigger kinds:
- IMPACT_BURST
- COMBO_MILESTONE
- ENEMY_DEFEATED
- SKILL_ACTIVATED
- CHAIN_STARTED
- CHAIN_EXTENDED
- RUN_FINISHER

Frontend replay currently maps the server playback timeline into:
- ball motion
- world-space impact cues
- damage popups
- rolling total damage
- combo display
- sparse UI trigger banners
- end-of-run summary reveal

This system is still considered **foundational scaffolding**, but the current live loop is no longer target direction only:
- idle energy accumulation
- deterministic run trigger
- server-calculated rewards
- playback-driven frontend replay

---

# 🚀 NEXT PHASE: CORE GAMEPLAY LOOP

The project is transitioning from prototype → real game loop.

---

## 🎯 Target Gameplay Direction

Inspired by World Flipper:

> Build → Charge → Burst → Repeat

---

## Core Gameplay Loop

Player fantasy:
Build a team that unleashes powerful chained skill bursts.

Core repeated action:
Trigger short “runs” where the team auto-combats and chains abilities.

Primary resources:
- Energy (generated over time)
- run entry cost / future run-charge style gating

Primary decisions:
- when to trigger runs
- how to build team synergy
- which units amplify chain effects

---

## Loop Structure

### Idle Phase
- generate Energy over time (offline supported)
- accumulate capacity for runs

### Active Phase (Burst Runs)
- player triggers a run (10–30s simulated combat)
- team auto-executes abilities
- deterministic simulation

### Result Phase
- outputs:
  - damage dealt
  - combo count
  - triggered effects
  - playback timeline for replay
- rewards granted based on performance

---

## Time Loops

5-minute loop:
- trigger multiple runs
- observe results
- adjust team

1-hour loop:
- optimize synergy
- push higher performance

1-day loop:
- accumulate idle energy
- perform bulk runs
- progress upgrades

---

## Design Requirements for Future Multiplayer

Runs must be:
- deterministic
- reproducible
- comparable
- aggregatable

Run output must be structured:
- damage
- combo
- triggers
- playback timeline

This enables:
- async co-op (guild boss)
- leaderboards
- shared progression systems

---

## Planned Multiplayer Path (NOT IMPLEMENTED YET)

Phase approach:
1. Async contribution systems (guild boss)
2. Leaderboards
3. Shared buffs
4. Real-time co-op (later)

---

# 🔜 NEXT IMPLEMENTATION PHASE

Current status:
- deterministic run simulation exists
- reward calculation exists
- `/run` orchestration exists
- playback timeline exists
- frontend replay mapping exists

Next likely expansion areas:
- replace temporary client-provided combat input with server-authoritative team state
- extend natural trigger emission as more gameplay systems appear
- improve replay presentation without moving simulation logic client-side
- build richer team/synergy systems on top of the current deterministic run contract

---

# ⚠️ OUT OF SCOPE (FOR NOW)

- real multiplayer
- gacha system implementation
- character collection depth
- combat physics / pinball mechanics
- advanced UI polish
- social systems

---

# 🧭 DEVELOPMENT GUIDANCE

- keep systems minimal and composable
- do not overbuild before loop is validated
- prefer deterministic simulation over real-time complexity
- design all systems to be multiplayer-compatible, but not multiplayer-dependent
- build for extension, not completeness

---

# 🧠 GUIDING PRINCIPLE

You are no longer building:

> “numbers go up”

You are building:

> “repeatable, exciting gameplay moments”

Everything should support that.
