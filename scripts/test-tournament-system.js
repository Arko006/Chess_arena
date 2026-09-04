const http = require('http');
const { PrismaClient } = require('@prisma/client');
const {
  generateSwissPairings,
  generateRoundRobinSchedule,
  computeTournamentStandings,
} = require('../src/server/tournamentEngine');

const prisma = new PrismaClient();

console.log('================================================================');
console.log('       FIDE TOURNAMENT SYSTEM & PAIRING ENGINE TEST SUITE       ');
console.log('================================================================\n');

let total = 0;
let passed = 0;

function assert(condition, name, detail) {
  total++;
  if (condition) {
    console.log(`[PASS] ${name}${detail ? ' -> ' + detail : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}${detail ? ' -> ' + detail : ''}`);
    throw new Error(`Assertion failed: ${name}`);
  }
}

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  try {
    // 1. Swiss-System Round 1 Pairings
    console.log('--- 1. Testing Swiss-System Round 1 Initial Pairings ---');
    const competitors = [
      { id: '1', name: 'Magnus C.', rating: 2850, seed: 1, score: 0, opponents: [], colors: [] },
      { id: '2', name: 'Hikaru N.', rating: 2800, seed: 2, score: 0, opponents: [], colors: [] },
      { id: '3', name: 'Fabiano C.', rating: 2790, seed: 3, score: 0, opponents: [], colors: [] },
      { id: '4', name: 'Alireza F.', rating: 2770, seed: 4, score: 0, opponents: [], colors: [] },
      { id: '5', name: 'Ding L.', rating: 2750, seed: 5, score: 0, opponents: [], colors: [] },
      { id: '6', name: 'Gukesh D.', rating: 2760, seed: 6, score: 0, opponents: [], colors: [] },
      { id: '7', name: 'Nodirbek A.', rating: 2740, seed: 7, score: 0, opponents: [], colors: [] },
      { id: '8', name: 'Pragg R.', rating: 2730, seed: 8, score: 0, opponents: [], colors: [] },
    ];

    const r1Pairings = generateSwissPairings(competitors);
    assert(r1Pairings.length === 4, 'Generated exactly 4 pairings for 8 competitors', `${r1Pairings.length} matches`);
    // Top-half vs bottom-half Dutch pairing: Seed 1 vs Seed 5, 2 vs 6, 3 vs 7, 4 vs 8
    assert(r1Pairings[0].whitePlayerName === 'Magnus C.' || r1Pairings[0].blackPlayerName === 'Magnus C.', 'Seed 1 paired in match 1');

    // 2. Swiss-System Round 2 Score Brackets & Rematch Prevention
    console.log('\n--- 2. Testing Round 2 Bracket Pairing & Rematch Avoidance ---');
    // Simulate R1 results:
    // Match 1: Magnus beats Ding (1-0)
    // Match 2: Hikaru draws Gukesh (0.5-0.5)
    // Match 3: Fabiano beats Nodirbek (1-0)
    // Match 4: Alireza beats Pragg (1-0)
    const r2Competitors = [
      { id: '1', name: 'Magnus C.', rating: 2850, seed: 1, score: 1.0, opponents: ['Ding L.'], colors: ['w'] },
      { id: '3', name: 'Fabiano C.', rating: 2790, seed: 3, score: 1.0, opponents: ['Nodirbek A.'], colors: ['w'] },
      { id: '4', name: 'Alireza F.', rating: 2770, seed: 4, score: 1.0, opponents: ['Pragg R.'], colors: ['w'] },
      { id: '2', name: 'Hikaru N.', rating: 2800, seed: 2, score: 0.5, opponents: ['Gukesh D.'], colors: ['w'] },
      { id: '6', name: 'Gukesh D.', rating: 2760, seed: 6, score: 0.5, opponents: ['Hikaru N.'], colors: ['b'] },
      { id: '5', name: 'Ding L.', rating: 2750, seed: 5, score: 0.0, opponents: ['Magnus C.'], colors: ['b'] },
      { id: '7', name: 'Nodirbek A.', rating: 2740, seed: 7, score: 0.0, opponents: ['Fabiano C.'], colors: ['b'] },
      { id: '8', name: 'Pragg R.', rating: 2730, seed: 8, score: 0.0, opponents: ['Alireza F.'], colors: ['b'] },
    ];

    const r2Pairings = generateSwissPairings(r2Competitors);
    assert(r2Pairings.length === 4, 'Round 2 generated 4 pairings');

    // Verify rematch prevention
    for (const pair of r2Pairings) {
      const p1 = r2Competitors.find(c => c.name === pair.whitePlayerName);
      assert(!p1?.opponents.includes(pair.blackPlayerName), `No rematch between ${pair.whitePlayerName} and ${pair.blackPlayerName}`);
    }

    // 3. Odd Number of Players - Bye Allocation
    console.log('\n--- 3. Testing Odd Player Count & Bye Awarding ---');
    const oddCompetitors = competitors.slice(0, 7); // 7 players
    const oddPairings = generateSwissPairings(oddCompetitors);
    const byeMatch = oddPairings.find(p => p.isBye || p.blackPlayerName === 'BYE');
    assert(!!byeMatch, 'Bye allocated for odd player pool', byeMatch?.whitePlayerName);
    assert(byeMatch?.whitePlayerName === 'Nodirbek A.', 'Lowest seeded competitor received Bye', byeMatch?.whitePlayerName);

    // 4. Round-Robin Berger Schedule Generator
    console.log('\n--- 4. Testing Round-Robin Berger Schedule Generator ---');
    const rrPlayers = ['Player A', 'Player B', 'Player C', 'Player D'];
    const rrSchedule = generateRoundRobinSchedule(rrPlayers);
    assert(rrSchedule.length === 3, '4 players generate 3 rounds');
    let totalRRMatches = 0;
    rrSchedule.forEach(r => totalRRMatches += r.pairings.length);
    assert(totalRRMatches === 6, 'Total Round-Robin matches = 4 * 3 / 2 = 6', `${totalRRMatches} matches`);

    // 5. FIDE Tiebreak Calculations (Buchholz & Sonneborn-Berger)
    console.log('\n--- 5. Testing FIDE Standings & Tiebreak Calculations ---');
    const sampleStandings = computeTournamentStandings(
      [
        { name: 'Magnus C.', rating: 2850 },
        { name: 'Hikaru N.', rating: 2800 },
        { name: 'Fabiano C.', rating: 2790 },
      ],
      [
        { whitePlayerName: 'Magnus C.', blackPlayerName: 'Hikaru N.', result: '1-0', status: 'FINISHED' },
        { whitePlayerName: 'Fabiano C.', blackPlayerName: 'Magnus C.', result: '0-1', status: 'FINISHED' },
        { whitePlayerName: 'Hikaru N.', blackPlayerName: 'Fabiano C.', result: '1-0', status: 'FINISHED' },
      ]
    );

    assert(sampleStandings.length === 3, 'Computed standings for all 3 players');
    assert(sampleStandings[0].name === 'Magnus C.', 'Leader is Magnus C. with 2.0 pts');
    assert(sampleStandings[0].points === 2, 'Magnus has 2 points');
    assert(sampleStandings[1].name === 'Hikaru N.', 'Second place is Hikaru N. with 1.0 pt');
    assert(sampleStandings[0].buchholz > 0, 'Buchholz tiebreak computed', `${sampleStandings[0].buchholz} BH`);
    assert(sampleStandings[0].sonnebornBerger > 0, 'Sonneborn-Berger tiebreak computed', `${sampleStandings[0].sonnebornBerger} SB`);

    // 6. Live API End-to-End Test for Tournament System
    console.log('\n--- 6. Testing Tournament Endpoints via HTTP ---');
    // Arbiter login to get token
    const loginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'arbiter@chessarena.com', password: 'arbiter1234' });

    const arbiterToken = loginRes.json?.token;
    assert(!!arbiterToken, 'Obtained Arbiter JWT token for tournament actions');

    // Create a new test tournament
    const arbiter = await prisma.user.findFirst({ where: { role: 'ARBITER' } });
    const tournament = await prisma.tournament.create({
      data: {
        name: 'Automated Swiss Invitational 2026',
        description: 'Verification tournament for automated Swiss pairings and tiebreaks.',
        timeControl: '5+3',
        format: 'SWISS',
        totalRounds: 3,
        createdById: arbiter.id,
      }
    });

    assert(!!tournament.id, 'Created tournament instance', tournament.id);

    // Register 4 players via API
    const regRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tournaments/${tournament.id}/players`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${arbiterToken}`
      }
    }, {
      players: [
        { name: 'Grandmaster Alpha', rating: 2600, seed: 1 },
        { name: 'Grandmaster Beta', rating: 2550, seed: 2 },
        { name: 'Grandmaster Gamma', rating: 2500, seed: 3 },
        { name: 'Grandmaster Delta', rating: 2450, seed: 4 },
      ]
    });

    assert(regRes.statusCode === 200, 'Registered competitors via API HTTP 200');
    assert(regRes.json?.count === 4, '4 competitors registered');

    // 1-Click Swiss Pairing Generation via API
    console.log('\n--- 7. Testing 1-Click Swiss Pairing Generation Endpoint ---');
    const pairRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tournaments/${tournament.id}/pair`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${arbiterToken}`
      }
    });

    assert(pairRes.statusCode === 200, 'Pairing endpoint returned HTTP 200');
    assert(pairRes.json?.matchCount === 2, 'Generated 2 matches for Round 1');
    assert(!!pairRes.json?.matches[0]?.invitations?.white?.rawToken, 'White seat invitation token issued');
    assert(!!pairRes.json?.matches[0]?.invitations?.black?.rawToken, 'Black seat invitation token issued');

    // Fetch tournament details and verify Crosstable & Standings
    console.log('\n--- 8. Testing Standings & Crosstable Retrieval ---');
    const detailRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tournaments/${tournament.id}`,
      method: 'GET'
    });

    assert(detailRes.statusCode === 200, 'Tournament details HTTP 200');
    assert(detailRes.json?.standings?.length === 4, 'Standings list 4 competitors');
    assert(!!detailRes.json?.crosstable?.matrix, 'Crosstable matrix populated');

    console.log('\n================================================================');
    console.log(` ALL TOURNAMENT TESTS PASSED: ${passed}/${total} verifications!`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\nTournament Test Suite Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
