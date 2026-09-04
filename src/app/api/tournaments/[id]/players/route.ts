import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const players = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: params.id },
      orderBy: [{ score: 'desc' }, { rating: 'desc' }],
    });

    return NextResponse.json({ players });
  } catch (error: any) {
    console.error('Error fetching tournament players:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = verifyToken(authCookie || authHeader || '');

    if (!user || (user.role !== 'ARBITER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Arbiter access required' }, { status: 403 });
    }

    const { players: playerList, name, rating = 1500, seed } = await req.json();

    // Support single player or roster batch array
    const toInsert = playerList && Array.isArray(playerList)
      ? playerList
      : [{ name, rating, seed }];

    const created = [];
    for (let i = 0; i < toInsert.length; i++) {
      const p = toInsert[i];
      if (!p.name || typeof p.name !== 'string' || !p.name.trim()) continue;

      const player = await prisma.tournamentPlayer.upsert({
        where: {
          tournamentId_name: {
            tournamentId: params.id,
            name: p.name.trim(),
          },
        },
        update: {
          rating: p.rating ? parseInt(p.rating, 10) : 1500,
          seed: p.seed ? parseInt(p.seed, 10) : i + 1,
        },
        create: {
          tournamentId: params.id,
          name: p.name.trim(),
          rating: p.rating ? parseInt(p.rating, 10) : 1500,
          seed: p.seed ? parseInt(p.seed, 10) : i + 1,
        },
      });
      created.push(player);
    }

    return NextResponse.json({ success: true, count: created.length, players: created });
  } catch (error: any) {
    console.error('Error adding tournament player:', error);
    return NextResponse.json({ error: error.message || 'Failed to add player' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = verifyToken(authCookie || authHeader || '');

    if (!user || (user.role !== 'ARBITER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { playerId } = await req.json();
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    await prisma.tournamentPlayer.delete({
      where: { id: playerId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
