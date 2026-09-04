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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const body = await req.json();
    const { players: playerList, name, rating = 1500, seed, joinSelf } = body;

    // Self-join: any logged in player can register themselves into the tournament
    if (joinSelf) {
      const playerName = (name || user.name || '').trim();
      if (!playerName) {
        return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
      }

      const existingPlayer = await prisma.tournamentPlayer.findUnique({
        where: {
          tournamentId_name: {
            tournamentId: params.id,
            name: playerName,
          },
        },
      });

      if (existingPlayer) {
        return NextResponse.json({ success: true, message: 'Already registered in this tournament', player: existingPlayer });
      }

      const count = await prisma.tournamentPlayer.count({ where: { tournamentId: params.id } });
      const player = await prisma.tournamentPlayer.create({
        data: {
          tournamentId: params.id,
          name: playerName,
          rating: rating ? parseInt(rating as any, 10) : 1500,
          seed: count + 1,
        },
      });

      return NextResponse.json({ success: true, player });
    }

    // Administrative roster management requires Arbiter, Admin, or Tournament Creator
    const isAuthorized = user.role === 'ARBITER' || user.role === 'ADMIN' || tournament.createdById === user.id;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Arbiter or Tournament Creator required' }, { status: 403 });
    }

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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const isAuthorized = user.role === 'ARBITER' || user.role === 'ADMIN' || tournament.createdById === user.id;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Arbiter or Creator required' }, { status: 403 });
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
