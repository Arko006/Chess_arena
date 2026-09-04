# ChessArena — Secure Online Chess Tournament Platform

**ChessArena** is a production-grade full-stack online chess tournament web application engineered for arbiters and competitive tournament play. It enforces **strict server authority**, **cryptographically isolated player invitation links**, **server-controlled chess clocks**, and **post-game Stockfish fair-play telemetry**.

---

## Key Features

### 1. Cryptographic Seat Invitations
- **Unguessable Tokens**: Generated via 256-bit cryptographically secure randomness (`crypto.randomBytes(32)`).
- **Hashed Storage**: Only the `SHA-256` digest of tokens is persisted in the database; raw tokens never touch the database.
- **Seat Binding**: White can join only as White; Black can join only as Black.
- **Cross-Claim Defense**: Prevents a player from claiming both seats in the same match or switching colors.
- **Revocation & Regeneration**: Arbiters can revoke active tokens and issue fresh ones on demand.

### 2. Single Source of Truth & Authoritative Engine
- **Server Rule Validation**: Client sends only move intent (`{ from: "e2", to: "e4" }`).
- **Never Trust Client Data**: Board positions, clocks, move histories, and results from browsers are ignored.
- **Chess.js Server Engine**: All legality checks, checkmate, stalemate, 3-fold repetition, 50-move rule, and insufficient material are computed on the server.

### 3. Server-Controlled Precision Clocks
- **Authoritative Countdown**: Exact millisecond delta calculation on each move with server-side timeout loop.
- **Time Controls Supported**: `1+0`, `3+0`, `3+2`, `5+0`, `5+3`, `10+0`, `10+5`, `15+10`, `30+0`.
- **Automatic Increment**: Added to the player's clock upon successful move validation.
- **Disconnection Resilience**: Clock continues accurately during player disconnections; automatic timeout loss triggers when reaching 0.

### 4. Real-Time WebSocket Gameplay
- Powered by integrated **Socket.IO** mounted on the primary HTTP server.
- Synchronized dual clocks, instant move broadcast, check notifications, and pawn promotion dialog.
- Built-in zero-latency Web Audio API sound synthesizer (move, capture, check, victory, defeat).

### 5. FIDE Arbiter Control Station
- **Live Match Monitor**: Mirrored chessboard, active clocks, move history, and live player connection badges.
- **Arbiter Interventions**: Pause match, resume match, award win to White (`1-0`), award win to Black (`0-1`), declare draw (`1/2-1/2`), or abort.
- **Tournament Management**: Organize championships, configure rounds, manually pair players, and view live standings.
- **Standard PGN Export**: One-click download or clipboard copy with standard FIDE tournament headers.

### 6. Anti-Cheat Surveillance & Engine Analysis
- **Telemetry Event Stream**: Monitors `visibilitychange` (tab hidden / tab visible) and window `blur` / `focus` events.
- **Engine Analysis**: Evaluates Average Centipawn Loss (ACPL), % Top Engine Agreement, and rapid difficult moves.
- **Arbiter Fair-Play Panel**: Interactive move-by-move evaluation ledger, telemetry timeline, review notes, and result adjudication.

---

## Technology Stack

- **Framework**: Next.js 14 (React 18, TypeScript, App Router)
- **Real-Time Engine**: Socket.IO
- **Chess Logic**: chess.js
- **Database & ORM**: Prisma ORM with SQLite (fully compatible with PostgreSQL via `.env`)
- **Styling**: Tailwind CSS, Lucide React Icons
- **Authentication**: Secure Session Cookies & JWT (Role-Based: Admin, Arbiter, Player)

---

## Getting Started

### 1. Prerequisites
- Node.js (v18.x, v20.x, or v24.x)
- npm (v9.x or higher)

### 2. Installation
```bash
# Clone or navigate to the project directory
cd chess_new

# Install dependencies
npm install
```

### 3. Database Setup & Seeding
```bash
# Push schema to SQLite database (creates dev.db)
npm run db:push

# Seed database with default Admin, Arbiter, and sample tournament
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Default Credentials

The seed script creates the following pre-configured accounts:

| Role | Email | Password | Console URL |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@chessarena.com` | `admin1234` | `/admin` |
| **Arbiter** | `arbiter@chessarena.com` | `arbiter1234` | `/arbiter` |

*Tip: The `/login` page includes one-click demo buttons to sign in as Arbiter or Admin instantly.*

---

## Running Automated Verification Tests

To run the automated chess rule validation, clock arithmetic, and cryptographic invitation security tests:

```bash
npm test
```

Verifies:
- Legal and illegal move validation
- Turn and color enforcement
- Checkmate detection (Fool's Mate) and game termination
- Millisecond clock countdowns and increment application
- SHA-256 token hashing and seat isolation
- Static positional heuristic evaluator

---

## Deployment (Production)

To deploy to production or cloud hosting (e.g. Vercel, Railway, Render, Fly.io):

1. Set environment variables:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/chessarena?sslmode=require"
   JWT_SECRET="your-production-secret"
   NEXT_PUBLIC_APP_URL="https://yourdomain.com"
   PORT=3000
   NODE_ENV=production
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Start the production server:
   ```bash
   npm start
   ```