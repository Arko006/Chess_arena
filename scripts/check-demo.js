const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const matches = await prisma.match.findMany({
    include: {
      invitations: true,
      tournament: true,
      moves: true,
    }
  });
  console.log('MATCHES FOUND:', matches.length);
  for (const m of matches) {
    console.log(JSON.stringify({
      id: m.id,
      white: m.whitePlayerName,
      black: m.blackPlayerName,
      status: m.status,
      timeControl: m.timeControl,
      invitations: m.invitations.map(i => ({ id: i.id, color: i.color, claimed: i.claimed })),
      moveCount: m.moves.length
    }, null, 2));
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
