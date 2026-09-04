let messages = [];
global.postMessage = function(msg) {
  messages.push(msg);
  console.log('[SF MSG]:', msg);
};

const sf = require('stockfish.js/stockfish.js');
console.log('Exports:', Object.keys(sf));
console.log('Type of onmessage:', typeof global.onmessage);

// In Emscripten WebWorker build:
// The engine listens to `global.onmessage({ data: '...' })` or `process.on('message')`!
// Let's test sending messages:
if (typeof global.onmessage === 'function') {
  console.log('Sending uci to global.onmessage...');
  global.onmessage({ data: 'uci' });
  setTimeout(() => {
    global.onmessage({ data: 'isready' });
    global.onmessage({ data: 'position startpos' });
    global.onmessage({ data: 'go depth 4' });
  }, 200);
}

setTimeout(() => {
  console.log('Done, total messages received:', messages.length);
  process.exit(0);
}, 1200);
