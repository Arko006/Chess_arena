import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const user = verifyToken(authCookie || '');

    if (!user || (user.role !== 'ADMIN' && user.role !== 'ARBITER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const [
      totalUsers,
      totalArbiters,
      totalTournaments,
      totalMatches,
      activeMatches,
      flaggedReports,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ARBITER' } }),
      prisma.tournament.count(),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACTIVE' } }),
      prisma.fairPlayReport.count({ where: { status: { in: ['SUSPICIOUS', 'NEEDS_REVIEW'] } } }),
    ]);

    const recentMatches = await prisma.match.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        tournament: { select: { name: true } },
        fairPlayReport: { select: { status: true, accuracyWhite: true, accuracyBlack: true } },
      },
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        totalArbiters,
        totalTournaments,
        totalMatches,
        activeMatches,
        flaggedReports,
      },
      recentMatches,
    });
  } catch (error: any) {
    console.error('Admin system stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}