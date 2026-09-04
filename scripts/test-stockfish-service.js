// Test StockfishService via tsx or compiled ts
const { StockfishService } = require('../src/server/stockfishService');

async function test() {
  console.log('Testing StockfishService...');
  const sf = StockfishService.getInstance();

  // Test 1: Starting position
  console.log('1. Evaluating starting position (depth 8)...');
  const res1 = await sf.evaluatePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 8);
  console.log('Startpos eval:', { cp: res1.cp, bestMove: res1.bestMove, pv: res1.pv.slice(0, 3), depth: res1.depth });

  // Test 2: Mate in 1 position (Fool's Mate board: White moves Qh5#)
  console.log('\n2. Evaluating Mate-in-1 position...');
  const res2 = await sf.evaluatePosition('rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 3', 8);
  console.log('Mate position eval:', { cp: res2.cp, mate: res2.mate, bestMove: res2.bestMove });

  // Test 3: Bot Move calculation
  console.log('\n3. Requesting bot move at Skill Level 5...');
  const botMove = await sf.getBotMove('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 5, 500);
  console.log('Bot Move response:', botMove);

  console.log('\nAll StockfishService tests passed successfully!');
  sf.destroy();
  process.exit(0);
}

test().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
