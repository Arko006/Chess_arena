import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, verifyPlayerToken, generatePlayerToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        tournament: { select: { id: true, name: true, createdById: true } },
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
    let assignedPlayerToken: string | null = null;

    if (playerSession && playerSession.matchId === match.id) {
      viewerRole = playerSession.color;
    } else if (authUser?.name) {
      // Check if the authenticated user is one of the players on this board
      const cleanUser = authUser.name.toLowerCase().trim();
      const whiteName = (match.whitePlayerName || '').toLowerCase().trim();
      const blackName = (match.blackPlayerName || '').toLowerCase().trim();

      if (cleanUser === whiteName) {
        viewerRole = 'white';
        assignedPlayerToken = generatePlayerToken({
          matchId: match.id,
          color: 'white',
          playerName: match.whitePlayerName,
        });
      } else if (cleanUser === blackName) {
        viewerRole = 'black';
        assignedPlayerToken = generatePlayerToken({
          matchId: match.id,
          color: 'black',
          playerName: match.blackPlayerName,
        });
      }
    }

    // Arbiter / Admin / Tournament Creator access for non-players
    if (viewerRole === 'spectator' && authUser) {
      if (authUser.role === 'ADMIN') viewerRole = 'admin';
      else if (authUser.role === 'ARBITER' || (match.tournament && match.tournament.createdById === authUser.id)) {
        viewerRole = 'arbiter';
      }
    }

    const response = NextResponse.json({
      match,
      viewerRole,
      playerSession: viewerRole === 'white' || viewerRole === 'black' ? playerSession : null,
      assignedPlayerToken,
    });

    if (assignedPlayerToken) {
      response.cookies.set({
        name: 'chessarena_player_session',
        value: assignedPlayerToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error: any) {
    console.error('Error fetching match details:', error);
    return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 });
  }
}