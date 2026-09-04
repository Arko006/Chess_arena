const http = require('http');
const next = require('next');
const { Server } = require('socket.io');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'chessarena_super_secure_jwt_secret_key_2026_dev_env';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error('Next.js request error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Lazy load GameManager after TypeScript transpilation or directly
  // Note: We can transpile or compile src/server or require ts-node/tsx or import the compiled JS
  let gameManagerInstance = null;
  function getGameManager() {
    if (!gameManagerInstance) {
      try {
        const { GameManager } = require('./src/server/gameManager');
        gameManagerInstance = GameManager.getInstance();
        gameManagerInstance.setIoServer(io);
      } catch (err) {
        console.error('Failed to initialize GameManager:', err);
      }
    }
    return gameManagerInstance;
  }

  io.on('connection', (socket) => {
    let currentMatchId = null;
    let playerColor = null;
    let userRole = 'spectator';
    let playerName = 'Anonymous Spectator';

    socket.on('match:join', async (data) => {
      try {
        const { matchId, token, role } = data || {};
        if (!matchId) return;

        currentMatchId = matchId;
        socket.join(`match:${matchId}`);

        const gm = getGameManager();
        if (!gm) return;

        const match = await gm.getMatch(matchId);
        if (!match) {
          socket.emit('match:error', { message: 'Match not found' });
          return;
        }

        // Check authentication token if provided
        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.matchId === matchId && (decoded.color === 'white' || decoded.color === 'black')) {
              playerColor = decoded.color;
              userRole = 'player';
              playerName = decoded.playerName || (playerColor === 'white' ? match.whitePlayerName : match.blackPlayerName);
              gm.setConnectionStatus(matchId, playerColor, true);
            } else if (decoded.role === 'ARBITER' || decoded.role === 'ADMIN') {
              userRole = 'arbiter';
              playerName = decoded.name;
            }
          } catch (e) {
            console.warn('Socket token verification failed:', e.message);
          }
        }

        // Send current game state
        socket.emit('match:state', gm.getClientState(matchId));
        socket.emit('match:joined', {
          role: userRole,
          color: playerColor,
          playerName,
        });

        // If game is active, broadcast connection update
        if (playerColor) {
          io.to(`match:${matchId}`).emit('match:connection-status', {
            color: playerColor,
            connected: true,
          });
        }
      } catch (err) {
        console.error('Error in match:join:', err);
      }
    });

    socket.on('match:move', async (data) => {
      try {
        const { matchId, from, to, promotion } = data || {};
        if (!matchId || !playerColor) {
          socket.emit('match:error', { message: 'Unauthorized: You are not an active player in this match' });
          return;
        }

        const gm = getGameManager();
        if (!gm) return;

        const result = await gm.makeMove(matchId, { from, to, promotion }, playerColor);
        if (!result.success) {
          socket.emit('match:error', { message: result.error });
        }
      } catch (err) {
        console.error('Error in match:move:', err);
        socket.emit('match:error', { message: 'Move processing error' });
      }
    });

    socket.on('match:resign', async (data) => {
      try {
        const { matchId } = data || {};
        if (!matchId || !playerColor) return;
        const gm = getGameManager();
        if (gm) await gm.handleResign(matchId, playerColor);
      } catch (err) {
        console.error('Error in match:resign:', err);
      }
    });

    socket.on('match:draw-offer', async (data) => {
      try {
        const { matchId } = data || {};
        if (!matchId || !playerColor) return;
        const gm = getGameManager();
        if (gm) await gm.handleDrawOffer(matchId, playerColor);
      } catch (err) {
        console.error('Error in match:draw-offer:', err);
      }
    });

    socket.on('match:draw-accept', async (data) => {
      try {
        const { matchId } = data || {};
        if (!matchId || !playerColor) return;
        const gm = getGameManager();
        if (gm) await gm.handleDrawAccept(matchId, playerColor);
      } catch (err) {
        console.error('Error in match:draw-accept:', err);
      }
    });

    socket.on('match:draw-decline', async (data) => {
      try {
        const { matchId } = data || {};
        if (!matchId || !playerColor) return;
        const gm = getGameManager();
        if (gm) await gm.handleDrawDecline(matchId, playerColor);
      } catch (err) {
        console.error('Error in match:draw-decline:', err);
      }
    });

    socket.on('match:arbiter-action', async (data) => {
      try {
        const { matchId, action, token } = data || {};
        if (!matchId || !action) return;

        // Verify arbiter permission
        if (userRole !== 'arbiter') {
          if (token) {
            try {
              const decoded = jwt.verify(token, JWT_SECRET);
              if (decoded.role !== 'ARBITER' && decoded.role !== 'ADMIN') {
                socket.emit('match:error', { message: 'Unauthorized arbiter action' });
                return;
              }
            } catch {
              socket.emit('match:error', { message: 'Invalid arbiter token' });
              return;
            }
          } else {
            socket.emit('match:error', { message: 'Unauthorized arbiter action' });
            return;
          }
        }

        const gm = getGameManager();
        if (gm) await gm.handleArbiterAction(matchId, action);
      } catch (err) {
        console.error('Error in match:arbiter-action:', err);
      }
    });

    socket.on('match:fair-play-event', async (data) => {
      try {
        const { matchId, eventType, metadata } = data || {};
        if (!matchId || !eventType) return;

        const gm = getGameManager();
        if (gm) {
          const recorded = await gm.recordFairPlayEvent(
            matchId,
            eventType,
            playerColor ? (playerColor === 'white' ? 'w' : 'b') : undefined,
            undefined,
            metadata
          );
        }
      } catch (err) {
        console.error('Error in match:fair-play-event:', err);
      }
    });

    socket.on('disconnect', () => {
      if (currentMatchId && playerColor) {
        const gm = getGameManager();
        if (gm) {
          gm.setConnectionStatus(currentMatchId, playerColor, false);
          gm.recordFairPlayEvent(
            currentMatchId,
            'DISCONNECTED',
            playerColor === 'white' ? 'w' : 'b',
            undefined,
            { disconnectedAt: new Date().toISOString() }
          );
        }
      }
    });
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> ChessArena Server ready on http://${hostname}:${port}`);
  });
});
