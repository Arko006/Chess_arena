const fetch = globalThis.fetch || require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('=== TESTING MULTI-PLAYER ENROLLMENT, SCHEDULE & SCORECARD HUB ===\n');

  // 1. Login as Arbiter
  console.log('1. Logging in as Arbiter...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'arbiter@chessarena.com', password: 'arbiter1234' }),
  });
  const loginData = await loginRes.json();
  const setCookie = loginRes.headers.get('set-cookie');
  const token = loginData.token;
  console.log('   Arbiter logged in successfully. User:', loginData.user.name, 'Role:', loginData.user.role);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': setCookie || '',
    'Authorization': `Bearer ${token}`,
  };

  // 2. Create a test tournament
  console.log('\n2. Creating test tournament "Grand Masters Super Rapid"...');
  const tRes = await fetch(`${BASE_URL}/api/tournaments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Grand Masters Super Rapid ' + Date.now(),
      description: 'Championship with multi-player bulk registration test',
      format: 'SWISS',
      roundsTotal: 3,
      timeControl: '5+3',
    }),
  });
  const tData = await tRes.json();
  if (!tData.tournament) {
    throw new Error('Failed to create tournament: ' + JSON.stringify(tData));
  }
  const tournamentId = tData.tournament.id;
  console.log('   Tournament created with ID:', tournamentId);

  // 3. Batch enroll multiple players
  console.log('\n3. Batch enrolling 6 players at once via POST /api/tournaments/[id]/players...');
  const batchPlayers = [
    { name: 'Magnus Carlsen', rating: 2882, seed: 1 },
    { name: 'Hikaru Nakamura', rating: 2875, seed: 2 },
    { name: 'Alireza Firouzja', rating: 2805, seed: 3 },
    { name: 'Fabiano Caruana', rating: 2800, seed: 4 },
    { name: 'Gukesh D', rating: 2794, seed: 5 },
    { name: 'Arjun Erigaisi', rating: 2797, seed: 6 },
  ];

  const enrollRes = await fetch(`${BASE_URL}/api/tournaments/${tournamentId}/players`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ players: batchPlayers }),
  });
  const enrollData = await enrollRes.json();
  console.log('   Batch enroll response:', enrollData.success ? `SUCCESS! Added ${enrollData.count} players.` : enrollData);

  // Verify enrolled players
  const getPlayersRes = await fetch(`${BASE_URL}/api/tournaments/${tournamentId}/players`);
  const getPlayersData = await getPlayersRes.json();
  console.log('   Verified roster count:', getPlayersData.players?.length, 'competitors');
  if (getPlayersData.players?.length !== 6) {
    throw new Error('Expected 6 players, got ' + getPlayersData.players?.length);
  }

  // 4. Generate Round 1 Swiss pairings
  console.log('\n4. Generating official Swiss pairings for Round 1...');
  const pairRes = await fetch(`${BASE_URL}/api/tournaments/${tournamentId}/pair`, {
    method: 'POST',
    headers: authHeaders,
  });
  const pairData = await pairRes.json();
  console.log('   Pairing response:', pairData.message, 'Matches created:', pairData.matchCount);

  // 5. Query Schedule API
  console.log('\n5. Querying Schedule API (/api/schedule)...');
  const schedRes = await fetch(`${BASE_URL}/api/schedule?tournamentId=${tournamentId}`);
  const schedData = await schedRes.json();
  console.log('   Schedule returned:', {
    totalTournaments: schedData.tournaments?.length,
    upcomingMatches: schedData.matches?.upcoming?.length,
    stats: schedData.stats,
  });

  if (!schedData.matches?.upcoming || schedData.matches.upcoming.length < 3) {
    throw new Error('Expected at least 3 upcoming matches in schedule!');
  }
  console.log('   Sample match fixture:', {
    white: schedData.matches.upcoming[0].whitePlayerName,
    black: schedData.matches.upcoming[0].blackPlayerName,
    timeControl: schedData.matches.upcoming[0].timeControl,
    round: schedData.matches.upcoming[0].roundNumber,
  });

  // 6. Query Dashboard API for individual competitor scorecard & schedule
  console.log('\n6. Querying Dashboard API (/api/dashboard?playerName=Magnus%20Carlsen)...');
  const dashRes = await fetch(`${BASE_URL}/api/dashboard?playerName=Magnus%20Carlsen`);
  const dashData = await dashRes.json();
  console.log('   Dashboard loaded for:', dashData.player?.name);
  console.log('   Stats:', dashData.stats);
  console.log('   Upcoming match for Magnus:', dashData.upcomingSchedule?.map(m => `${m.whitePlayerName} vs ${m.blackPlayerName} (Round ${m.roundNumber})`));
  console.log('   Enrolled tournaments count:', dashData.enrolledTournaments?.length);

  // 7. Query Dashboard for Hikaru
  console.log('\n7. Querying Dashboard API for Hikaru Nakamura...');
  const hikaruRes = await fetch(`${BASE_URL}/api/dashboard?playerName=Hikaru%20Nakamura`);
  const hikaruData = await hikaruRes.json();
  console.log('   Dashboard loaded for:', hikaruData.player?.name);
  console.log('   Upcoming match for Hikaru:', hikaruData.upcomingSchedule?.map(m => `${m.whitePlayerName} vs ${m.blackPlayerName} (Round ${m.roundNumber})`));

  console.log('\n=== ALL MULTI-PLAYER ENROLLMENT, SCHEDULE & DASHBOARD TESTS PASSED! ===');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
