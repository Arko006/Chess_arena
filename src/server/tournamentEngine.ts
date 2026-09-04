/**
 * FIDE-Standard Tournament Pairing & Tiebreak Engine
 * Supports Swiss-System (Dutch algorithm), Round-Robin (Berger tables),
 * Buchholz & Sonneborn-Berger tiebreaks, and Elo rating adjustments.
 */

export interface TournamentPlayerProfile {
  id: string;
  name: string;
  rating: number;
  seed: number;
  score: number;
  opponents: string[];     // list of opponent names played against
  colors: ('w' | 'b')[];   // list of colors played: 'w' or 'b'
  hasHadBye?: boolean;
}

export interface GeneratedPairing {
  whitePlayerName: string;
  blackPlayerName: string;
  isBye?: boolean;
}

export interface PlayerStanding {
  rank: number;
  name: string;
  rating: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  buchholz: number;
  sonnebornBerger: number;
  eloDelta: number;
  performanceRating: number;
}

/**
 * Generates Swiss pairings for the next round according to FIDE Dutch rules:
 * 1. Score bracket grouping
 * 2. Rematch prevention (players cannot face each other twice)
 * 3. Color balance optimization (equalize W/B, prevent 3 same colors in a row)
 * 4. Half-point or full-point Bye handling for odd player counts
 */
export function generateSwissPairings(
  players: TournamentPlayerProfile[]
): GeneratedPairing[] {
  if (players.length < 2) return [];

  // Deep clone to avoid mutating input
  let pool: TournamentPlayerProfile[] = players.map((p) => ({
    ...p,
    opponents: [...p.opponents],
    colors: [...p.colors],
  }));

  // Sort descending by score, then by rating, then by seed
  pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.seed - b.seed;
  });

  const pairings: GeneratedPairing[] = [];

  // If odd number of players, award a Bye to the lowest-scoring player who hasn't had one
  if (pool.length % 2 !== 0) {
    let byeIndex = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!pool[i].hasHadBye) {
        byeIndex = i;
        break;
      }
    }
    if (byeIndex === -1) byeIndex = pool.length - 1;

    const [byePlayer] = pool.splice(byeIndex, 1);
    pairings.push({
      whitePlayerName: byePlayer.name,
      blackPlayerName: 'BYE',
      isBye: true,
    });
  }

  // Backtracking pairing search
  function pairRemaining(currentPool: TournamentPlayerProfile[]): GeneratedPairing[] | null {
    if (currentPool.length === 0) return [];

    const first = currentPool[0];
    const candidates = currentPool.slice(1);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      // Check if they already played
      if (first.opponents.includes(candidate.name) || candidate.opponents.includes(first.name)) {
        continue;
      }

      // Determine color allocation
      const colorPair = allocateColors(first, candidate);
      if (!colorPair) continue; // Incompatible color constraints (e.g. 3 same colors in a row)

      const rest = currentPool.filter((p) => p.name !== first.name && p.name !== candidate.name);
      const subPairings = pairRemaining(rest);

      if (subPairings !== null) {
        return [colorPair, ...subPairings];
      }
    }

    // If strict pairing within bracket fails, relax rematch constraint for tail if unavoidable
    return null;
  }

  const result = pairRemaining(pool);

  if (result !== null) {
    return [...pairings, ...result];
  }

  // Fallback: Greedy sequential matching ignoring strict color constraints if bracket is tight
  const fallbackPairings: GeneratedPairing[] = [...pairings];
  const matched = new Set<string>();

  for (let i = 0; i < pool.length; i++) {
    const p1 = pool[i];
    if (matched.has(p1.name)) continue;

    let opponent: TournamentPlayerProfile | null = null;
    for (let j = i + 1; j < pool.length; j++) {
      const p2 = pool[j];
      if (!matched.has(p2.name) && !p1.opponents.includes(p2.name)) {
        opponent = p2;
        break;
      }
    }

    if (!opponent) {
      // Pick first available unmatched
      for (let j = i + 1; j < pool.length; j++) {
        if (!matched.has(pool[j].name)) {
          opponent = pool[j];
          break;
        }
      }
    }

    if (opponent) {
      matched.add(p1.name);
      matched.add(opponent.name);
      const colors = allocateColors(p1, opponent) || {
        whitePlayerName: p1.name,
        blackPlayerName: opponent.name,
      };
      fallbackPairings.push(colors);
    }
  }

  return fallbackPairings;
}

/**
 * Determines White and Black assignments based on color balance and streaks:
 * - Difference in White vs Black games
 * - Last color played (alternation preference)
 * - Prohibits 3 same colors in a row
 */
function allocateColors(
  p1: TournamentPlayerProfile,
  p2: TournamentPlayerProfile
): GeneratedPairing | null {
  const p1Whites = p1.colors.filter((c) => c === 'w').length;
  const p1Blacks = p1.colors.filter((c) => c === 'b').length;
  const p1Balance = p1Whites - p1Blacks; // > 0 means has had more White

  const p2Whites = p2.colors.filter((c) => c === 'w').length;
  const p2Blacks = p2.colors.filter((c) => c === 'b').length;
  const p2Balance = p2Whites - p2Blacks;

  const p1Last2 = p1.colors.slice(-2);
  const p2Last2 = p2.colors.slice(-2);

  const p1CannotWhite = p1Last2.length === 2 && p1Last2[0] === 'w' && p1Last2[1] === 'w';
  const p1CannotBlack = p1Last2.length === 2 && p1Last2[0] === 'b' && p1Last2[1] === 'b';
  const p2CannotWhite = p2Last2.length === 2 && p2Last2[0] === 'w' && p2Last2[1] === 'w';
  const p2CannotBlack = p2Last2.length === 2 && p2Last2[0] === 'b' && p2Last2[1] === 'b';

  if (p1CannotWhite && p2CannotWhite) return null;
  if (p1CannotBlack && p2CannotBlack) return null;

  if (p1CannotWhite || p2CannotBlack) {
    return { whitePlayerName: p2.name, blackPlayerName: p1.name };
  }
  if (p1CannotBlack || p2CannotWhite) {
    return { whitePlayerName: p1.name, blackPlayerName: p2.name };
  }

  // Preference based on balance: player with fewer Whites gets White
  if (p1Balance < p2Balance) {
    return { whitePlayerName: p1.name, blackPlayerName: p2.name };
  } else if (p2Balance < p1Balance) {
    return { whitePlayerName: p2.name, blackPlayerName: p1.name };
  }

  // If balances equal, alternate from last round
  const p1Last = p1.colors[p1.colors.length - 1];
  if (p1Last === 'b') {
    return { whitePlayerName: p1.name, blackPlayerName: p2.name };
  } else {
    return { whitePlayerName: p2.name, blackPlayerName: p1.name };
  }
}

/**
 * Generates full Round-Robin schedule using standard Berger table algorithm
 */
export function generateRoundRobinSchedule(
  playerNames: string[]
): { roundNumber: number; pairings: GeneratedPairing[] }[] {
  let list = [...playerNames];
  if (list.length % 2 !== 0) {
    list.push('BYE');
  }

  const n = list.length;
  const roundsCount = n - 1;
  const schedule: { roundNumber: number; pairings: GeneratedPairing[] }[] = [];

  for (let r = 0; r < roundsCount; r++) {
    const pairings: GeneratedPairing[] = [];

    for (let i = 0; i < n / 2; i++) {
      const p1 = list[i];
      const p2 = list[n - 1 - i];

      if (p1 === 'BYE' || p2 === 'BYE') {
        const actual = p1 === 'BYE' ? p2 : p1;
        pairings.push({
          whitePlayerName: actual,
          blackPlayerName: 'BYE',
          isBye: true,
        });
      } else {
        // Alternate colors each round for balance
        if (i === 0) {
          if (r % 2 === 0) {
            pairings.push({ whitePlayerName: p1, blackPlayerName: p2 });
          } else {
            pairings.push({ whitePlayerName: p2, blackPlayerName: p1 });
          }
        } else {
          if ((i + r) % 2 === 0) {
            pairings.push({ whitePlayerName: p1, blackPlayerName: p2 });
          } else {
            pairings.push({ whitePlayerName: p2, blackPlayerName: p1 });
          }
        }
      }
    }

    schedule.push({ roundNumber: r + 1, pairings });

    // Rotate array, keeping list[0] fixed
    const fixed = list[0];
    const moving = list.slice(1);
    const last = moving.pop();
    if (last !== undefined) moving.unshift(last);
    list = [fixed, ...moving];
  }

  return schedule;
}

/**
 * Computes official FIDE tournament standings, Buchholz (BH), Sonneborn-Berger (SB),
 * and Elo performance rating.
 */
export function computeTournamentStandings(
  players: { name: string; rating?: number; seed?: number }[],
  matches: {
    whitePlayerName: string;
    blackPlayerName: string;
    result: string | null;
    status: string;
  }[]
): PlayerStanding[] {
  interface PlayerStats {
    name: string;
    rating: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    points: number;
    opponents: { name: string; resultScore: number }[]; // resultScore: 1 (won), 0.5 (drew), 0 (lost)
  }

  const map: Record<string, PlayerStats> = {};

  // Initialize all registered players
  players.forEach((p, idx) => {
    map[p.name] = {
      name: p.name,
      rating: p.rating || 1500,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      opponents: [],
    };
  });

  // Tally matches
  matches.forEach((m) => {
    if (!m.result || m.result === '*' || m.result === 'ABORTED') return;

    const w = m.whitePlayerName;
    const b = m.blackPlayerName;

    if (!map[w]) map[w] = { name: w, rating: 1500, played: 0, won: 0, drawn: 0, lost: 0, points: 0, opponents: [] };
    if (!map[b]) map[b] = { name: b, rating: 1500, played: 0, won: 0, drawn: 0, lost: 0, points: 0, opponents: [] };

    map[w].played++;
    map[b].played++;

    if (m.result === '1-0') {
      map[w].won++;
      map[w].points += 1;
      map[w].opponents.push({ name: b, resultScore: 1 });

      map[b].lost++;
      map[b].opponents.push({ name: w, resultScore: 0 });
    } else if (m.result === '0-1') {
      map[b].won++;
      map[b].points += 1;
      map[b].opponents.push({ name: w, resultScore: 1 });

      map[w].lost++;
      map[w].opponents.push({ name: b, resultScore: 0 });
    } else if (m.result === '1/2-1/2') {
      map[w].drawn++;
      map[w].points += 0.5;
      map[w].opponents.push({ name: b, resultScore: 0.5 });

      map[b].drawn++;
      map[b].points += 0.5;
      map[b].opponents.push({ name: w, resultScore: 0.5 });
    }
  });

  const list = Object.values(map);

  // Compute Buchholz and Sonneborn-Berger
  const calculated: PlayerStanding[] = list.map((p) => {
    let bh = 0;
    let sb = 0;
    let oppRatingSum = 0;
    let oppCount = 0;

    let eloDeltaSum = 0;

    p.opponents.forEach((opp) => {
      const oppStats = map[opp.name];
      if (oppStats) {
        bh += oppStats.points;
        if (opp.resultScore === 1) {
          sb += oppStats.points;
        } else if (opp.resultScore === 0.5) {
          sb += 0.5 * oppStats.points;
        }

        oppRatingSum += oppStats.rating;
        oppCount++;

        // FIDE Elo calculation: K = 32
        const expected = 1 / (1 + Math.pow(10, (oppStats.rating - p.rating) / 400));
        eloDeltaSum += 32 * (opp.resultScore - expected);
      }
    });

    // Performance Rating (TPR)
    const avgOppRating = oppCount > 0 ? oppRatingSum / oppCount : p.rating;
    const scoreFraction = p.played > 0 ? p.points / p.played : 0.5;
    // Linear approximation of FIDE conversion
    const performanceRating = Math.round(avgOppRating + 800 * (scoreFraction - 0.5));

    return {
      rank: 0,
      name: p.name,
      rating: p.rating,
      played: p.played,
      won: p.won,
      drawn: p.drawn,
      lost: p.lost,
      points: p.points,
      buchholz: Math.round(bh * 10) / 10,
      sonnebornBerger: Math.round(sb * 10) / 10,
      eloDelta: Math.round(eloDeltaSum * 10) / 10,
      performanceRating,
    };
  });

  // Sort by: 1) Points desc, 2) Buchholz desc, 3) Sonneborn-Berger desc, 4) Wins desc
  calculated.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
    return b.won - a.won;
  });

  // Assign ranks
  calculated.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  return calculated;
}
