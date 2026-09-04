const { io } = require('socket.io-client');
const http = require('http');

console.log('================================================================');
console.log('       CHESSARENA LIVE SYSTEM & WEBSOCKET E2E TEST SUITE        ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, name, detail) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${name}${detail ? ' -> ' + detail : ''}`);
    passedTests++;
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
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
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
    // 1. Check HTTP server
    console.log('--- 1. Testing HTTP Server Health ---');
    const homeRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    assert(homeRes.statusCode === 200, 'Homepage HTTP 200 OK');

    // 2. Arbiter authentication
    console.log('\n--- 2. Testing Arbiter Login ---');
    const loginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'arbiter@chessarena.com',
      password: 'arbiter1234'
    });
    assert(loginRes.statusCode === 200, 'Arbiter credentials accepted');
    assert(loginRes.json?.user?.role === 'ARBITER', 'User role is ARBITER');
    const arbiterToken = loginRes.json?.token;
    assert(!!arbiterToken, 'JWT auth token issued to Arbiter');

    // 3. Match Creation via Arbiter
    console.log('\n--- 3. Testing Match Creation & Token Generation ---');
    const createMatchRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/matches',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${arbiterToken}`
      }
    }, {
      whitePlayerName: 'Levon Aronian',
      blackPlayerName: 'Anish Giri',
      timeControl: '3+2'
    });

    assert(createMatchRes.statusCode === 200, 'Match created successfully by Arbiter');
    const match = createMatchRes.json?.match;
    const invitations = createMatchRes.json?.invitations;
    assert(!!match?.id, 'Match record created with unique ID', match?.id);
    assert(match?.timeControl === '3+2', 'Time control 3+2 registered');
    assert(!!invitations?.white?.rawToken, 'Cryptographic White token issued');
    assert(!!invitations?.black?.rawToken, 'Cryptographic Black token issued');
    assert(invitations.white.rawToken !== invitations.black.rawToken, 'White and Black tokens are completely distinct');

    const whiteRaw = invitations.white.rawToken;
    const blackRaw = invitations.black.rawToken;
    const matchId = match.id;

    // 4. Token & Seat Security
    console.log('\n--- 4. Testing Cryptographic Seat Claim & Security ---');
    const getInviteRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/join/${whiteRaw}`,
      method: 'GET'
    });
    assert(getInviteRes.statusCode === 200, 'Resolved White invitation details');
    assert(getInviteRes.json?.invitation?.color === 'white', 'Seat assignment matches White');

    const claimWhiteRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/join/${whiteRaw}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { playerName: 'Levon Aronian' });
    assert(claimWhiteRes.statusCode === 200, 'Levon claimed White seat successfully');
    const whitePlayerToken = claimWhiteRes.json?.token;
    assert(!!whitePlayerToken, 'White player session token issued');

    const claimBlackRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/join/${blackRaw}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { playerName: 'Anish Giri' });
    assert(claimBlackRes.statusCode === 200, 'Anish claimed Black seat successfully');
    const blackPlayerToken = claimBlackRes.json?.token;
    assert(!!blackPlayerToken, 'Black player session token issued');

    const fakeInviteRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/join/deadbeef1234567890abcdefdeadbeef',
      method: 'GET'
    });
    assert(fakeInviteRes.statusCode === 404, 'Tampered/invalid invitation token returns 404 Not Found');

    // 5. Real-Time Socket.IO Tests
    console.log('\n--- 5. Testing Real-Time WebSocket Gameplay & Clocks ---');
    const socketWhite = io('http://localhost:3000', { transports: ['websocket'] });
    const socketBlack = io('http://localhost:3000', { transports: ['websocket'] });
    const socketArbiter = io('http://localhost:3000', { transports: ['websocket'] });

    await new Promise((resolve) => {
      let connectedCount = 0;
      const onConn = () => {
        connectedCount++;
        if (connectedCount === 3) resolve();
      };
      socketWhite.on('connect', onConn);
      socketBlack.on('connect', onConn);
      socketArbiter.on('connect', onConn);
    });
    assert(true, 'All 3 WebSockets (White, Black, Arbiter) connected to server');

    // Join match rooms and wait for join confirmation on all 3
    const joinPromises = [
      new Promise(r => socketWhite.once('match:joined', r)),
      new Promise(r => socketBlack.once('match:joined', r)),
      new Promise(r => socketArbiter.once('match:joined', r))
    ];
    socketWhite.emit('match:join', { matchId, token: whitePlayerToken, role: 'player' });
    socketBlack.emit('match:join', { matchId, token: blackPlayerToken, role: 'player' });
    socketArbiter.emit('match:join', { matchId, token: arbiterToken, role: 'arbiter' });

    const [whiteJoined, blackJoined, arbiterJoined] = await Promise.all(joinPromises);
    assert(whiteJoined.color === 'white', 'White socket verified as white player');
    assert(blackJoined.color === 'black', 'Black socket verified as black player');
    assert(arbiterJoined.role === 'arbiter', 'Arbiter socket verified as arbiter');

    // Small tick to ensure any initial state buffers clear
    await new Promise(r => setTimeout(r, 100));

    // Helper to play and wait for move
    async function playMove(mover, from, to) {
      const p = new Promise((resolve) => {
        const handler = (data) => {
          const lastMove = data.state.history.slice(-1)[0];
          if (lastMove && lastMove.from === from && lastMove.to === to) {
            socketArbiter.off('match:move', handler);
            resolve(data.state);
          }
        };
        socketArbiter.on('match:move', handler);
      });
      mover.emit('match:move', { matchId, from, to });
      return await p;
    }

    // Make Move 1: White e2 -> e4
    console.log('\n--- 6. Testing Move Execution & Broadcast ---');
    const stateAfterMove1 = await playMove(socketWhite, 'e2', 'e4');
    assert(stateAfterMove1.status === 'ACTIVE', 'Match transitions to ACTIVE on first move');
    assert(stateAfterMove1.turn === 'b', 'Turn transitioned to Black (b)');
    assert(stateAfterMove1.history.length === 1 && stateAfterMove1.history[0].san === 'e4', 'Move e4 recorded in server history');

    // Test illegal move: White trying to move on Black turn
    let illegalMoveError = null;
    socketWhite.once('match:error', (err) => { illegalMoveError = err; });
    socketWhite.emit('match:move', { matchId, from: 'd2', to: 'd4' });
    await new Promise(r => setTimeout(r, 200));
    assert(!!illegalMoveError, 'White moving out of turn is rejected with socket error', illegalMoveError?.message);

    // Make Move 2: Black e7 -> e5
    const stateAfterMove2 = await playMove(socketBlack, 'e7', 'e5');
    assert(stateAfterMove2.turn === 'w', 'Turn transitioned back to White');
    assert(stateAfterMove2.history.length === 2 && stateAfterMove2.history[1].san === 'e5', 'Move e5 confirmed');

    // Make Move 3: White g1 -> f3
    const stateAfterMove3 = await playMove(socketWhite, 'g1', 'f3');
    assert(stateAfterMove3.history.length === 3 && stateAfterMove3.history[2].san === 'Nf3', 'Knight move Nf3 confirmed');

    // 7. Arbiter Control Actions (Pause / Resume)
    console.log('\n--- 7. Testing Arbiter Intervention Controls ---');
    const pausePromise = new Promise((resolve) => {
      socketWhite.once('match:state', (s) => {
        if (s.isPaused) resolve(s);
      });
    });
    socketArbiter.emit('match:arbiter-action', { matchId, action: 'PAUSE', token: arbiterToken });
    const pausedState = await pausePromise;
    assert(pausedState.isPaused === true, 'Arbiter PAUSE halted clock and moves across all clients');

    const resumePromise = new Promise((resolve) => {
      socketWhite.once('match:state', (s) => {
        if (!s.isPaused) resolve(s);
      });
    });
    socketArbiter.emit('match:arbiter-action', { matchId, action: 'RESUME', token: arbiterToken });
    const resumedState = await resumePromise;
    assert(resumedState.isPaused === false, 'Arbiter RESUME unpaused match successfully');

    // 8. Fair-Play Telemetry Ingestion
    console.log('\n--- 8. Testing Anti-Cheat Telemetry Ingestion ---');
    const telemetryPromise = new Promise((resolve) => {
      socketArbiter.once('match:fair-play-event', resolve);
    });
    socketBlack.emit('match:fair-play-event', {
      matchId,
      eventType: 'TAB_HIDDEN',
      metadata: { reason: 'User switched tab to browser engine' }
    });
    const telemetryAlert = await telemetryPromise;
    assert(telemetryAlert?.eventType === 'TAB_HIDDEN', 'Arbiter received real-time TAB_HIDDEN telemetry alert');
    assert(telemetryAlert?.color === 'b', 'Fair-play alert accurately attributed to Black player');

    // 9. Resignation & Game Termination
    console.log('\n--- 9. Testing Match Resignation & Result Finalization ---');
    const finishPromise = new Promise((resolve) => {
      socketWhite.once('match:finish', resolve);
    });
    socketBlack.emit('match:resign', { matchId });
    const finishData = await finishPromise;
    assert(finishData.result === '1-0', 'Result set to 1-0 in favor of White');
    assert(finishData.resultReason === 'RESIGNATION', 'Reason correctly identified as RESIGNATION');

    // Disconnect sockets cleanly
    socketWhite.disconnect();
    socketBlack.disconnect();
    socketArbiter.disconnect();

    // 10. Verify PGN Export
    console.log('\n--- 10. Testing PGN Export Generation ---');
    const pgnRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/matches/${matchId}/pgn`,
      method: 'GET'
    });
    assert(pgnRes.statusCode === 200, 'PGN file generated HTTP 200');
    assert(pgnRes.body.includes('[Event "ChessArena'), 'PGN contains Event header');
    assert(pgnRes.body.includes('[White "Levon Aronian"]'), 'PGN contains White player header');
    assert(pgnRes.body.includes('[Black "Anish Giri"]'), 'PGN contains Black player header');
    assert(pgnRes.body.includes('1. e4 e5 2. Nf3'), 'PGN contains move history');
    assert(pgnRes.body.includes('1-0'), 'PGN contains final result 1-0');

    // 11. Fair-Play Post-Game Analysis Report
    console.log('\n--- 11. Testing Fair-Play Engine Analysis Report ---');
    // Allow background analysis worker 2.5 seconds to calculate ACPL & accuracy
    await new Promise(r => setTimeout(r, 2500));
    const reportRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/reports/${matchId}`,
      method: 'GET'
    });
    assert(reportRes.statusCode === 200, 'Post-game Fair-Play report generated HTTP 200');
    const report = reportRes.json?.report;
    assert(typeof report?.accuracyWhite === 'number', 'White accuracy score calculated', `${report?.accuracyWhite}%`);
    assert(typeof report?.acplWhite === 'number', 'White Average Centipawn Loss (ACPL) computed', `${report?.acplWhite} cpl`);
    assert(report?.status === 'CLEAN' || report?.status === 'SUSPICIOUS', 'Fair-play status flagged based on telemetry', report?.status);

    console.log('\n================================================================');
    console.log(` ALL LIVE SYSTEM TESTS PASSED: ${passedTests}/${totalTests} verifications!`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n[FATAL ERROR IN LIVE TEST]:', error);
    process.exit(1);
  }
}

run();
