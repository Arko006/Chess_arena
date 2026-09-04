import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, generateInvitationSecret } from '@/lib/auth';

function parseTimeControl(tc: string): { initialMs: number; incrementMs: number } {
  const parts = tc.split('+');
  const minutes = parseFloat(parts[0]) || 10;
  const incrementSec = parseFloat(parts[1]) || 5;
  return {
    initialMs: Math.round(minutes * 60 * 1000),
    incrementMs: Math.round(incrementSec * 1000),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');
    const status = searchParams.get('status');

    const where: any = {};
    if (tournamentId) where.tournamentId = tournamentId;
    if (status) where.status = status;

    const matches = await prisma.match.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tournament: { select: { id: true, name: true } },
        round: { select: { id: true, roundNumber: true } },
        fairPlayReport: { select: { status: true, accuracyWhite: true, accuracyBlack: true } },
        _count: { select: { moves: true, fairPlayEvents: true } },
      },
    });

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = verifyToken(authCookie || authHeader || '');

    if (!user || (user.role !== 'ARBITER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Arbiter or Admin role required' }, { status: 403 });
    }

    const {
      tournamentId,
      roundId,
      whitePlayerName,
      blackPlayerName,
      timeControl = '10+5',
    } = await req.json();

    const { initialMs, incrementMs } = parseTimeControl(timeControl);

    // Create Match
    const match = await prisma.match.create({
      data: {
        tournamentId: tournamentId || null,
        roundId: roundId || null,
        whitePlayerName: (whitePlayerName || 'White Player').trim(),
        blackPlayerName: (blackPlayerName || 'Black Player').trim(),
        timeControl,
        incrementMs,
        whiteTimeRemainingMs: initialMs,
        blackTimeRemainingMs: initialMs,
        status: 'PENDING',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
      },
    });

    // Generate cryptographic tokens for White and Black
    const whiteSecret = generateInvitationSecret();
    const blackSecret = generateInvitationSecret();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.matchInvitation.createMany({
      data: [
        {
          matchId: match.id,
          color: 'white',
          tokenHash: whiteSecret.tokenHash,
          expiresAt,
        },
        {
          matchId: match.id,
          color: 'black',
          tokenHash: blackSecret.tokenHash,
          expiresAt,
        },
      ],
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      success: true,
      match,
      invitations: {
        white: {
          rawToken: whiteSecret.rawToken,
          url: `${baseUrl}/join/${whiteSecret.rawToken}`,
          color: 'white',
        },
        black: {
          rawToken: blackSecret.rawToken,
          url: `${baseUrl}/join/${blackSecret.rawToken}`,
          color: 'black',
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating match:', error);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }
}