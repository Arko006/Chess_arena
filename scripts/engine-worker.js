// Lightweight Stockfish UCI worker running stockfish.js
global.postMessage = function(msg) {
  if (typeof msg === 'string') {
    process.stdout.write(msg + '\n');
  }
};

require('stockfish.js/stockfish.js');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  const cmd = line.trim();
  if (cmd === 'quit') {
    process.exit(0);
  }
  if (typeof global.onmessage === 'function') {
    global.onmessage({ data: cmd });
  }
});
