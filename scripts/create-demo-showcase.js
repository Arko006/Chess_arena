const { PrismaClient } = require('@prisma/client');
const { Chess } = require('chess.js');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'chessarena_super_secure_jwt_secret_key_2026_dev_env';

async function createDemoShowcase() {
  console.log('Creating rich demo match showcase...');

  const arbiter = await prisma.user.findFirst({ where: { role: 'ARBITER' } });
  if (!arbiter) throw new Error('No Arbiter found');

  // Find or create tournament
  let tournament = await prisma.tournament.findFirst({
    where: { name: 'FIDE Candidates Tournament 2026' }
  });

  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: 'FIDE Candidates Tournament 2026',
        description: 'Elite 8-player double round-robin tournament featuring real-time anti-cheat telemetry and server clock synchronization.',
        timeControl: '5+3',
        status: 'ACTIVE',
        createdById: arbiter.id,
        rounds: {
          create: [
            { roundNumber: 1, status: 'ACTIVE' },
            { roundNumber: 2, status: 'PENDING' }
          ]
        }
      },
      include: { rounds: true }
    });
  }

  const rounds = await prisma.tournamentRound.findMany({ where: { tournamentId: tournament.id } });
  const round1 = rounds[0];

  // Create match
  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      roundId: round1.id,
      whitePlayerName: 'Magnus Carlsen',
      blackPlayerName: 'Hikaru Nakamura',
      timeControl: '5+3',
      incrementMs: 3000,
      whiteTimeRemainingMs: 284000,
      blackTimeRemainingMs: 279000,
      status: 'ACTIVE',
      activeColor: 'w',
      fen: 'r1bqkb1r/1p2pppp/p1np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 1 6'
    }
  });

  // Invitation tokens
  const whiteTokenRaw = crypto.randomBytes(32).toString('hex');
  const whiteHash = crypto.createHash('sha256').update(whiteTokenRaw).digest('hex');
  const blackTokenRaw = crypto.randomBytes(32).toString('hex');
  const blackHash = crypto.createHash('sha256').update(blackTokenRaw).digest('hex');

  await prisma.matchInvitation.createMany({
    data: [
      {
        matchId: match.id,
        color: 'white',
        tokenHash: whiteHash,
        claimedBy: 'Magnus Carlsen',
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
      },
      {
        matchId: match.id,
        color: 'black',
        tokenHash: blackHash,
        claimedBy: 'Hikaru Nakamura',
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
      }
    ]
  });

  // Add Sicilian moves into Move table
  const moves = [
    { num: 1, color: 'w', from: 'e2', to: 'e4', san: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
    { num: 1, color: 'b', from: 'c7', to: 'c5', san: 'c5', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2' },
    { num: 2, color: 'w', from: 'g1', to: 'f3', san: 'Nf3', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
    { num: 2, color: 'b', from: 'd7', to: 'd6', san: 'd6', fen: 'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3' },
    { num: 3, color: 'w', from: 'd2', to: 'd4', san: 'd4', fen: 'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3' },
    { num: 3, color: 'b', from: 'c5', to: 'd4', san: 'cxd4', fen: 'rnbqkbnr/pp2pppp/3p4/8/3nP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4' },
    { num: 4, color: 'w', from: 'f3', to: 'd4', san: 'Nxd4', fen: 'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4' },
    { num: 4, color: 'b', from: 'g8', to: 'f6', san: 'Nf6', fen: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5' },
    { num: 5, color: 'w', from: 'b1', to: 'c3', san: 'Nc3', fen: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5' },
    { num: 5, color: 'b', from: 'a7', to: 'a6', san: 'a6', fen: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6' }
  ];

  for (const m of moves) {
    await prisma.move.create({
      data: {
        matchId: match.id,
        moveNumber: m.num,
        color: m.color,
        fromSquare: m.from,
        toSquare: m.to,
        san: m.san,
        fenAfter: m.fen,
        pgn: '',
        timeSpentMs: 2500
      }
    });
  }

  // Record realistic fair-play telemetry events
  await prisma.fairPlayEvent.createMany({
    data: [
      {
        matchId: match.id,
        color: 'b',
        eventType: 'TAB_HIDDEN',
        metadata: JSON.stringify({ tabHiddenAt: new Date(Date.now() - 60000).toISOString() }),
        timestamp: new Date(Date.now() - 60000)
      },
      {
        matchId: match.id,
        color: 'b',
        eventType: 'TAB_VISIBLE',
        metadata: JSON.stringify({ returnedAfterMs: 1820 }),
        timestamp: new Date(Date.now() - 58000)
      }
    ]
  });

  const whiteJwt = jwt.sign(
    { matchId: match.id, color: 'white', playerName: 'Magnus Carlsen', role: 'player' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log('\n=== SHOWCASE DEMO MATCH READY ===');
  console.log('Match ID:', match.id);
  console.log('White Player (Magnus): /match/' + match.id);
  console.log('Arbiter Live View: /arbiter/match/' + match.id);
  console.log('White Player Session Token:', whiteJwt);
  console.log('=================================\n');
}

createDemoShowcase()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
