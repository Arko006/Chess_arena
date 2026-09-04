const { spawn } = require('child_process');
const path = require('path');

const workerPath = path.join(__dirname, 'engine-worker.js');
const child = spawn('node', [workerPath], { stdio: ['pipe', 'pipe', 'inherit'] });

let output = '';
child.stdout.on('data', (data) => {
  output += data.toString();
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.includes('bestmove')) {
      console.log('RECEIVED BESTMOVE:', line.trim());
      child.stdin.write('quit\n');
      process.exit(0);
    }
  }
});

child.stdin.write('uci\n');
child.stdin.write('isready\n');
child.stdin.write('position startpos moves e2e4 e7e5\n');
child.stdin.write('go depth 6\n');
