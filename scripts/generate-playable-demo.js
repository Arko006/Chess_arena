const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function run() {
  const arbiter = await prisma.user.findFirst({ where: { role: 'ARBITER' } });
  let tournament = await prisma.tournament.findFirst({ where: { name: 'ChessArena Live Showcase' } });

  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: 'ChessArena Live Showcase',
        description: 'Interactive demonstration of real-time server-authoritative chess, clock sync, and anti-cheat telemetry.',
        timeControl: '5+3',
        status: 'ACTIVE',
        createdById: arbiter.id,
        rounds: {
          create: [{ roundNumber: 1, status: 'ACTIVE' }]
        }
      },
      include: { rounds: true }
    });
  }

  const rounds = await prisma.tournamentRound.findMany({ where: { tournamentId: tournament.id } });
  const round1 = rounds[0];

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      roundId: round1.id,
      whitePlayerName: 'Player White',
      blackPlayerName: 'Player Black',
      timeControl: '5+3',
      incrementMs: 3000,
      whiteTimeRemainingMs: 300000,
      blackTimeRemainingMs: 300000,
      status: 'PENDING',
      activeColor: 'w'
    }
  });

  const whiteRawToken = crypto.randomBytes(32).toString('hex');
  const whiteTokenHash = crypto.createHash('sha256').update(whiteRawToken).digest('hex');

  const blackRawToken = crypto.randomBytes(32).toString('hex');
  const blackTokenHash = crypto.createHash('sha256').update(blackRawToken).digest('hex');

  await prisma.matchInvitation.createMany({
    data: [
      {
        matchId: match.id,
        color: 'white',
        tokenHash: whiteTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        matchId: match.id,
        color: 'black',
        tokenHash: blackTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  console.log('PLAYABLE DEMO SETUP COMPLETE:');
  console.log('MATCH_ID:', match.id);
  console.log('WHITE_JOIN_URL:', `http://localhost:3000/join/${whiteRawToken}`);
  console.log('BLACK_JOIN_URL:', `http://localhost:3000/join/${blackRawToken}`);
  console.log('ARBITER_MATCH_URL:', `http://localhost:3000/arbiter/match/${match.id}`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
