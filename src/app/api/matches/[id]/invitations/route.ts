import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, generateInvitationSecret } from '@/lib/auth';

export async function GET(
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

    const invitations = await prisma.matchInvitation.findMany({
      where: { matchId: params.id },
      orderBy: { color: 'desc' },
    });

    return NextResponse.json({ invitations });
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
    const user = verifyToken(authCookie || '');

    if (!user || (user.role !== 'ARBITER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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