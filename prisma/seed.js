const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ChessArena database...');

  // Create default Admin
  const adminPassword = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@chessarena.com' },
    update: {},
    create: {
      name: 'Grandmaster Admin',
      email: 'admin@chessarena.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Created Admin:', admin.email);

  // Create default Arbiter
  const arbiterPassword = await bcrypt.hash('arbiter1234', 10);
  const arbiter = await prisma.user.upsert({
    where: { email: 'arbiter@chessarena.com' },
    update: {},
    create: {
      name: 'FIDE Arbiter Magnus',
      email: 'arbiter@chessarena.com',
      passwordHash: arbiterPassword,
      role: 'ARBITER',
      status: 'ACTIVE',
    },
  });
  console.log('Created Arbiter:', arbiter.email);

  // Create default Player
  const playerPassword = await bcrypt.hash('player1234', 10);
  const player = await prisma.user.upsert({
    where: { email: 'player@chessarena.com' },
    update: {},
    create: {
      name: 'Hikaru Nakamura',
      email: 'player@chessarena.com',
      passwordHash: playerPassword,
      role: 'PLAYER',
      status: 'ACTIVE',
    },
  });
  console.log('Created Demo Player:', player.email);

  // Check if sample tournament already exists
  const existingTournament = await prisma.tournament.findFirst({
    where: { name: 'ChessArena Masters Championship 2026' },
  });

  if (!existingTournament) {
    // Create sample Tournament
    const tournament = await prisma.tournament.create({
      data: {
        name: 'ChessArena Masters Championship 2026',
        description: 'Official online championship with server-authoritative engine validation and fair-play surveillance.',
        timeControl: '10+5',
        status: 'ACTIVE',
        createdById: arbiter.id,
        rounds: {
          create: [
            { roundNumber: 1, status: 'ACTIVE' },
            { roundNumber: 2, status: 'PENDING' },
          ],
        },
      },
      include: { rounds: true },
    });
    console.log('Created Tournament:', tournament.name);

  // Create sample Match in Round 1
  const round1 = tournament.rounds[0];
  const sampleMatch = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      roundId: round1.id,
      whitePlayerName: 'Hikaru N.',
      blackPlayerName: 'Fabiano C.',
      timeControl: '10+5',
      incrementMs: 5000,
      whiteTimeRemainingMs: 600000,
      blackTimeRemainingMs: 600000,
      status: 'PENDING',
    },
  });

  // Generate cryptographic invitation links for sample match
  const whiteRawToken = crypto.randomBytes(32).toString('hex');
  const whiteTokenHash = crypto.createHash('sha256').update(whiteRawToken).digest('hex');

  const blackRawToken = crypto.randomBytes(32).toString('hex');
  const blackTokenHash = crypto.createHash('sha256').update(blackRawToken).digest('hex');

  await prisma.matchInvitation.createMany({
    data: [
      {
        matchId: sampleMatch.id,
        color: 'white',
        tokenHash: whiteTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        matchId: sampleMatch.id,
        color: 'black',
        tokenHash: blackTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('\n--- SAMPLE MATCH CREATED ---');
  console.log('Match ID:', sampleMatch.id);
  console.log('White Invite Token:', whiteRawToken);
  console.log('White Join URL: /join/' + whiteRawToken);
  console.log('Black Invite Token:', blackRawToken);
  console.log('Black Join URL: /join/' + blackRawToken);
  console.log('----------------------------\n');
  } else {
    console.log('Sample Tournament already exists, skipping sample match creation.');
  }

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
