Project: Wafuri-Idle

Goal:
A server-authoritative, browser-based idle gacha game inspired by World Flipper.

Core Stack:
- Backend: Node.js + TypeScript
- DB: PostgreSQL (Prisma)
- Cache: Redis
- Auth: JWT (username + guest accounts, no email)
- Architecture: Route → Controller → Service → DB

Key Rules:
- Services contain all game logic (pure, deterministic)
- Backend is authoritative (client is display-only)
- All large numbers use bigint (fixed-point) and are serialized as strings
- Redis is cache only, DB is source of truth
- Player updates use optimistic locking (version field)
- Stateless backend (horizontal scaling ready)

Current Systems Implemented:
- Idle progression (time-based)
- Upgrade system (rate + team power)
- Optimistic DB updates
- Cache layer (read-through + write-through)
- JWT auth middleware (playerId attached)

In Progress:
- Identity system (guest accounts → username/password optional)
- No email collection

Design Priorities:
- Deterministic simulation
- Concurrency safety
- Scalability
- Clean separation of concerns

Instructions:
Continue building in small, safe phases suitable for Codex execution.
Do not break architectural rules.
Prefer explicit, composable services.