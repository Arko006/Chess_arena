import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { name: true, email: true } },
        rounds: {
          select: {
            id: true,
            roundNumber: true,
            status: true,
            _count: { select: { matches: true } },
          },
        },
        _count: { select: { matches: true } },
      },
    });

    return NextResponse.json({ tournaments });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
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

    const { name, description, timeControl, roundsCount } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const numRounds = Math.max(1, Math.min(20, parseInt(roundsCount || '3', 10)));

    const tournament = await prisma.tournament.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        timeControl: timeControl || '10+5',
        status: 'ACTIVE',
        createdById: user.id,
        rounds: {
          create: Array.from({ length: numRounds }, (_, i) => ({
            roundNumber: i + 1,
            status: i === 0 ? 'ACTIVE' : 'PENDING',
          })),
        },
      },
      include: { rounds: true },
    });

    return NextResponse.json({ success: true, tournament });
  } catch (error: any) {
    console.error('Error creating tournament:', error);
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}