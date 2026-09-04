import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashInvitationToken, generatePlayerToken, verifyPlayerToken, verifyToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params.token;
    if (!rawToken || rawToken.length < 16) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 400 });
    }

    const tokenHash = hashInvitationToken(rawToken);

    const invitation = await prisma.matchInvitation.findUnique({
      where: { tokenHash },
      include: {
        match: {
          include: {
            tournament: { select: { name: true } },
            round: { select: { roundNumber: true } },
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation link not found or has expired' }, { status: 404 });
    }

    if (invitation.revokedAt) {
      return NextResponse.json({ error: 'This invitation link has been revoked by the arbiter' }, { status: 410 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'This invitation link has expired' }, { status: 410 });
    }

    const existingPlayerCookie = req.cookies.get('chessarena_player_session')?.value;
    let existingSession = existingPlayerCookie ? verifyPlayerToken(existingPlayerCookie) : null;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        matchId: invitation.matchId,
        color: invitation.color,
        claimedBy: invitation.claimedBy,
        isClaimed: !!invitation.claimedBy,
        tournamentName: invitation.match.tournament?.name || 'Open Invitational Match',
        roundNumber: invitation.match.round?.roundNumber || 1,
        opponentName: invitation.color === 'white' ? invitation.match.blackPlayerName : invitation.match.whitePlayerName,
        assignedName: invitation.color === 'white' ? invitation.match.whitePlayerName : invitation.match.blackPlayerName,
        timeControl: invitation.match.timeControl,
        status: invitation.match.status,
      },
      currentSession: existingSession?.matchId === invitation.matchId ? existingSession : null,
    });
  } catch (error: any) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params.token;
    const body = await req.json().catch(() => ({}));
    const playerName = (body.playerName || '').trim();

    if (!rawToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const tokenHash = hashInvitationToken(rawToken);

    const invitation = await prisma.matchInvitation.findUnique({
      where: { tokenHash },
      include: { match: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.revokedAt) {
      return NextResponse.json({ error: 'Invitation has been revoked by the arbiter' }, { status: 410 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'Invitation link has expired' }, { status: 410 });
    }

    const existingCookie = req.cookies.get('chessarena_player_session')?.value;
    const existingPlayerSession = existingCookie ? verifyPlayerToken(existingCookie) : null;

    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const authUser = authCookie ? verifyToken(authCookie) : null;

    const finalPlayerName = playerName || authUser?.name || invitation.claimedBy || (invitation.color === 'white' ? 'White Player' : 'Black Player');

    if (invitation.claimedBy && invitation.claimedBy !== finalPlayerName && (!existingPlayerSession || existingPlayerSession.color !== invitation.color)) {
      return NextResponse.json({
        error: 'This seat has already been claimed by another player',
      }, { status: 409 });
    }

    if (existingPlayerSession && existingPlayerSession.matchId === invitation.matchId && existingPlayerSession.color !== invitation.color) {
      return NextResponse.json({
        error: 'Security violation: A player cannot claim both White and Black seats in the same match.',
      }, { status: 403 });
    }

    const updateData: any = {};
    if (invitation.color === 'white') {
      updateData.whitePlayerName = finalPlayerName;
      if (authUser) updateData.whitePlayerId = authUser.id;
    } else {
      updateData.blackPlayerName = finalPlayerName;
      if (authUser) updateData.blackPlayerId = authUser.id;
    }

    await prisma.$transaction([
      prisma.matchInvitation.update({
        where: { id: invitation.id },
        data: {
          claimedBy: finalPlayerName,
          claimedAt: invitation.claimedAt || new Date(),
        },
      }),
      prisma.match.update({
        where: { id: invitation.matchId },
        data: updateData,
      }),
    ]);

    const sessionPayload = {
      matchId: invitation.matchId,
      color: invitation.color as 'white' | 'black',
      playerName: finalPlayerName,
      playerId: authUser?.id,
    };

    const playerToken = generatePlayerToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      matchId: invitation.matchId,
      color: invitation.color,
      playerName: finalPlayerName,
      token: playerToken,
    });

    response.cookies.set({
      name: 'chessarena_player_session',
      value: playerToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Error claiming invitation:', error);
    return NextResponse.json({ error: 'Failed to claim invitation' }, { status: 500 });
  }
}
