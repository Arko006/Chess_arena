const http = require('http');
const { StockfishService } = require('../src/server/stockfishService');
const { analyzeMatchFairPlay } = require('../src/server/engine');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

console.log('================================================================');
console.log('         STOCKFISH ENGINE INTEGRATION VERIFICATION SUITE        ');
console.log('================================================================\n');

let total = 0;
let passed = 0;

function assert(cond, name, detail) {
  total++;
  if (cond) {
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
        resolve({ statusCode: res.statusCode, body: data, json });
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
    // 1. Core Stockfish Service
    console.log('--- 1. Testing Core StockfishService Engine Subprocess ---');
    const sf = StockfishService.getInstance();
    
    const startposEval = await sf.evaluatePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 6);
    assert(startposEval !== null, 'Stockfish evaluated starting position');
    assert(typeof startposEval.bestMove === 'string' && startposEval.bestMove.length >= 4, 'Stockfish issued legal UCI bestmove', startposEval.bestMove);
    assert(typeof startposEval.cp === 'number', 'Centipawn evaluation returned', `${startposEval.cp} cp`);

    // 2. Tactical Mate Evaluation
    console.log('\n--- 2. Testing Tactical Checkmate Position ---');
    // Scholar's Mate final position before checkmate: White has Qxf7#
    const scholarsMateFen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 5';
    const tacticalEval = await sf.evaluatePosition(scholarsMateFen, 6);
    assert(tacticalEval.bestMove === 'f3f7', 'Stockfish found Qxf7# tactical mate move', tacticalEval.bestMove);

    // 3. Engine API Evaluation Endpoint
    console.log('\n--- 3. Testing POST /api/engine [action: evaluate] ---');
    const apiEvalRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/engine',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      action: 'evaluate',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      depth: 6
    });

    assert(apiEvalRes.statusCode === 200, 'API /api/engine returned HTTP 200');
    assert(!!apiEvalRes.json?.evaluation, 'Evaluation object returned in payload');
    assert(typeof apiEvalRes.json?.evaluation?.winChance === 'number', 'Calculated win chance percentage', `${apiEvalRes.json?.evaluation?.winChance}%`);
    assert(!!apiEvalRes.json?.evaluation?.displayScore, 'Calculated display score', apiEvalRes.json?.evaluation?.displayScore);

    // 4. Engine Bot Move Endpoint
    console.log('\n--- 4. Testing POST /api/engine [action: bot-move] ---');
    const botMoveRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/engine',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      action: 'bot-move',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      skillLevel: 8,
      moveTimeMs: 400
    });

    assert(botMoveRes.statusCode === 200, 'Bot move API returned HTTP 200');
    assert(!!botMoveRes.json?.move, 'Bot returned valid move', botMoveRes.json?.move);
    assert(!!botMoveRes.json?.san, 'Bot move translated to Standard Algebraic Notation (SAN)', botMoveRes.json?.san);

    // 5. Post-Game Fair-Play Analysis Upgrade
    console.log('\n--- 5. Testing Stockfish-Enhanced Fair-Play Analysis ---');
    const completedMatch = await prisma.match.findFirst({
      where: { status: 'FINISHED' },
      include: { moves: true }
    });

    if (completedMatch && completedMatch.moves.length > 0) {
      const report = await analyzeMatchFairPlay(completedMatch.id);
      assert(!!report, 'Generated Stockfish fair-play analysis report', report?.id);
      assert(typeof report.accuracyWhite === 'number', 'White accuracy calculated', `${report.accuracyWhite}%`);
      assert(typeof report.acplWhite === 'number', 'White ACPL calculated', `${report.acplWhite} cpl`);

      const analyses = JSON.parse(report.engineAnalysis);
      assert(analyses.length > 0, 'Move analyses list populated', `${analyses.length} moves`);
      const firstMove = analyses[0];
      assert(!!firstMove.classification, 'Move classified with chess badge', firstMove.classification);
      assert(!!firstMove.bestMoveSan, 'Alternative best move recorded in SAN', firstMove.bestMoveSan);
    }

    console.log('\n================================================================');
    console.log(` ALL ENGINE INTEGRATION TESTS PASSED: ${passed}/${total} verifications!`);
    console.log('================================================================\n');

    sf.destroy();
    process.exit(0);
  } catch (err) {
    console.error('\nTest Suite Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
