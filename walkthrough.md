# ChessArena Platform Walkthrough

**ChessArena** is a production-grade, secure online chess tournament platform equipped with server-authoritative rule validation, anti-cheat telemetry, automated **Swiss-System & Round-Robin Tournament Pairings**, official **FIDE Tiebreaks (Buchholz & Sonneborn-Berger)**, and **Stockfish Chess Engine** integration.

---

## 1. System Architecture & Components

```
                +-------------------------------------------------------------+
                |                  ChessArena Client (Next.js)                |
                |   - Interactive Responsive Chessboard (SVG + Sounds)        |
                |   - Dynamic Evaluation Bar (White/Black Win Chance %)       |
                |   - FIDE Tournament Crosstable Matrix & Standings           |
                |   - Dual Synchronized Clocks & Move History Ledger          |
                |   - Tab Visibility / Focus Telemetry Stream                 |
                |   - Practice Arena vs Stockfish Bot (Elo 1200 - 2850)       |
                +------------------------------+------------------------------+
                                               |
                             HTTP / WebSocket  | (Socket.IO + Next.js App API)
                                               v
                +-------------------------------------------------------------+
                |                Authoritative Server (Node.js)               |
                |   - Server Rule Validation (chess.js)                       |
                |   - Tournament Pairing Engine (Swiss Dutch + Berger RR)     |
                |   - Server Clock Daemon (Ticks, Increments, Flag)           |
                |   - Cryptographic Seat Manager (SHA-256 Hashes)             |
                |   - Stockfish UCI Engine Subprocess Pool (depth 8-16)       |
                |   - Post-Game Fair-Play Engine (CPL, ACPL & Accuracy)       |
                +------------------------------+------------------------------+
                                               |
                                               v
                +-------------------------------------------------------------+
                |                Prisma ORM (SQLite / PostgreSQL)             |
                |   - User, Tournament, TournamentPlayer, Round, Match        |
                |   - MatchInvitation, Move, FairPlayEvent, Report            |
                +-------------------------------------------------------------+
```

---

## 2. Tournament System Features

### A. Automated Swiss-System Pairing Engine (`/server/tournamentEngine.ts`)
- Implements the **FIDE Dutch Swiss pairing system**:
  - **Score Bracket Grouping**: Matches players with equal or proximate scores each round.
  - **Strict Rematch Avoidance**: Guarantees that two players never play against each other twice in the same tournament.
  - **Color Balance Optimization**: Alternates White and Black assignments and strictly prevents three consecutive games with the same color.
  - **Bye Allocation**: Automatically awards a Bye (+1 point) to the lowest-seeded unfloated player when an odd number of competitors are enrolled.

### B. Round-Robin Schedule Generator (Berger Tables)
- Generates complete round-by-round pairings for all rounds using the standard polygon rotation algorithm.
- Supports both even and odd competitor counts with Bye handling.

### C. FIDE Official Tiebreaks & Performance Ratings
- **Buchholz (BH)**: Sum of all opponents' total tournament scores.
- **Sonneborn-Berger (SB)**: Sum of scores of defeated opponents $+ 0.5 \times$ sum of scores of drawn opponents.
- **Tournament Performance Rating (TPR)**: Estimated Elo performance based on opponents' average rating and score percentage.
- **FIDE Elo Calculation**: Live Elo delta ($\Delta R = 32 \times (Actual - Expected)$).

### D. Interactive Crosstable Matrix (`/components/Crosstable.tsx`)
- Displays a FIDE-standard matrix table showing player-vs-player scores (`1`, `0`, `½`, `-`) across rows and columns with total points and final rank.

### E. Arbiter 1-Click Pairing Workflow (`/tournaments/[id]`)
- **"Generate Next Round Pairings"**: Arbiters can trigger pairing generation with a single click. The system creates the matches and generates 256-bit cryptographic invitation tokens for all players in one atomic operation.
- **Competitor Roster Management**: Enroll players with customized seeds and ratings or import existing players.

---

## 3. Stockfish Engine Integration Features

### A. Real-Time Dynamic Evaluation Bar (`/components/EvaluationBar.tsx`)
- Vertical evaluation gauge displaying White and Black winning advantage in real time.
- Display score badge (`+1.4`, `-0.8`, `M2`, `-M1`) with high-contrast typography and checkmate detection.

### B. Arbiter Live Surveillance Integration (`/arbiter/match/[id]`)
- Real-time mirrored board with live **Evaluation Bar**.
- Stockfish Top Line Banner displaying the current engine evaluation and recommended tactical continuation.

### C. Enhanced Post-Game Fair-Play Analysis (`/arbiter/review/[id]`)
- Every move is classified with chess badges:
  - 🟢 **★ Best** (0–5 CPL loss)
  - 🔵 **✓ Excellent** (CPL ≤ 25)
  - ⚪ **Good** (CPL ≤ 60)
  - 🟡 **?! Inaccuracy** (60 < CPL ≤ 120)
  - 🟠 **? Mistake** (120 < CPL ≤ 250)
  - 🔴 **?? Blunder** (CPL > 250)
- Displays alternative Stockfish lines (`pv`) alongside the played move.

### D. Practice Arena vs Stockfish Bot (`/practice`)
- Dedicated sparring mode with 4 selectable difficulty tiers (Club, Intermediate, Master, Grandmaster).

---

## 4. Verification & Test Results

### A. Core Engine & Rules Suite (`npm test`)
- **Result**: `ALL TESTS PASSED: 22/22 verifications successful!`

### B. Live WebSocket & Tournament System (`node scripts/test-live-system.js`)
- **Result**: `ALL LIVE SYSTEM TESTS PASSED: 44/44 verifications successful!`

### C. Stockfish Engine Integration Suite (`npx tsx scripts/test-engine-integration.js`)
- **Result**: `ALL ENGINE INTEGRATION TESTS PASSED: 17/17 verifications successful!`

### D. FIDE Tournament Pairing & Tiebreak Suite (`npx tsx scripts/test-tournament-system.js`)
- **Result**: `ALL TOURNAMENT TESTS PASSED: 28/28 verifications successful!`

---

## 5. How to Run

```bash
# Install dependencies
npm install

# Push database schema & seed initial accounts
npm run db:push
npm run db:seed

# Run tournament & engine test suites
npx tsx scripts/test-tournament-system.js
npx tsx scripts/test-engine-integration.js

# Launch development server
npm run dev
```

Application is live at [http://localhost:3000](http://localhost:3000).
- Tournaments & Crosstables: [http://localhost:3000/tournaments](http://localhost:3000/tournaments)
- Practice vs Bot: [http://localhost:3000/practice](http://localhost:3000/practice)
- Arbiter Desk: [http://localhost:3000/arbiter](http://localhost:3000/arbiter)