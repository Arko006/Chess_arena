import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, verifyPlayerToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        tournament: { select: { id: true, name: true } },
        round: { select: { id: true, roundNumber: true } },
        moves: { orderBy: { moveNumber: 'asc' } },
        fairPlayReport: true,
        fairPlayEvents: { orderBy: { timestamp: 'desc' }, take: 50 },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Determine viewer role and assigned seat
    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const playerCookie = req.cookies.get('chessarena_player_session')?.value;

    const authUser = authCookie ? verifyToken(authCookie) : null;
    const playerSession = playerCookie ? verifyPlayerToken(playerCookie) : null;

    let viewerRole: 'arbiter' | 'admin' | 'white' | 'black' | 'spectator' = 'spectator';

    if (authUser?.role === 'ADMIN') viewerRole = 'admin';
    else if (authUser?.role === 'ARBITER') viewerRole = 'arbiter';
    else if (playerSession && playerSession.matchId === match.id) {
      viewerRole = playerSession.color;
    }

    return NextResponse.json({
      match,
      viewerRole,
      playerSession: viewerRole === 'white' || viewerRole === 'black' ? playerSession : null,
    });
  } catch (error: any) {
    console.error('Error fetching match details:', error);
    return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 });
  }
}