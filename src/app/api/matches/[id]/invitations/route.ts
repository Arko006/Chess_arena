import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, generateInvitationSecret } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        tournament: { select: { id: true, name: true, createdById: true } },
        invitations: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const isAuthorized =
      user.role === 'ARBITER' ||
      user.role === 'ADMIN' ||
      (match.tournament && match.tournament.createdById === user.id);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Arbiter access required' }, { status: 403 });
    }

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https') ? 'https' : 'http');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : 'http://localhost:3000');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Ensure active invitation with rawToken exists for white
    let whiteInv = match.invitations.find((i) => i.color === 'white' && i.rawToken);
    if (!whiteInv) {
      const secret = generateInvitationSecret();
      whiteInv = await prisma.matchInvitation.create({
        data: {
          matchId: match.id,
          color: 'white',
          tokenHash: secret.tokenHash,
          rawToken: secret.rawToken,
          expiresAt,
        },
      });
    }

    // Ensure active invitation with rawToken exists for black (if not a bye)
    let blackInv = null;
    const isBye = match.blackPlayerName === 'BYE';
    if (!isBye) {
      blackInv = match.invitations.find((i) => i.color === 'black' && i.rawToken);
      if (!blackInv) {
        const secret = generateInvitationSecret();
        blackInv = await prisma.matchInvitation.create({
          data: {
            matchId: match.id,
            color: 'black',
            tokenHash: secret.tokenHash,
            rawToken: secret.rawToken,
            expiresAt,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        whitePlayerName: match.whitePlayerName,
        blackPlayerName: match.blackPlayerName,
        timeControl: match.timeControl,
        status: match.status,
        tournamentName: match.tournament?.name || 'Tournament Match',
      },
      white: {
        color: 'white',
        playerName: match.whitePlayerName,
        rawToken: whiteInv.rawToken,
        url: `${baseUrl}/join/${whiteInv.rawToken}`,
        claimedBy: whiteInv.claimedBy,
        isClaimed: !!whiteInv.claimedBy,
      },
      black: blackInv
        ? {
            color: 'black',
            playerName: match.blackPlayerName,
            rawToken: blackInv.rawToken,
            url: `${baseUrl}/join/${blackInv.rawToken}`,
            claimedBy: blackInv.claimedBy,
            isClaimed: !!blackInv.claimedBy,
          }
        : null,
      invitations: [whiteInv, ...(blackInv ? [blackInv] : [])],
    });
  } catch (error: any) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
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

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        tournament: { select: { id: true, createdById: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const isAuthorized =
      user.role === 'ARBITER' ||
      user.role === 'ADMIN' ||
      (match.tournament && match.tournament.createdById === user.id);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Arbiter access required' }, { status: 403 });
    }

    const { color } = await req.json();
    if (color !== 'white' && color !== 'black') {
      return NextResponse.json({ error: 'Valid color (white or black) is required' }, { status: 400 });
    }

    // Revoke old active invitation for this seat
    await prisma.matchInvitation.updateMany({
      where: { matchId: params.id, color, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Generate fresh cryptographic secret
    const secret = generateInvitationSecret();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newInvite = await prisma.matchInvitation.create({
      data: {
        matchId: params.id,
        color,
        tokenHash: secret.tokenHash,
        rawToken: secret.rawToken,
        expiresAt,
      },
    });

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https') ? 'https' : 'http');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : 'http://localhost:3000');

    return NextResponse.json({
      success: true,
      invitation: newInvite,
      rawToken: secret.rawToken,
      url: `${baseUrl}/join/${secret.rawToken}`,
    });
  } catch (error: any) {
    console.error('Error regenerating invitation:', error);
    return NextResponse.json({ error: 'Failed to regenerate invitation' }, { status: 500 });
  }
}