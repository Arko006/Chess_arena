import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const report = await prisma.fairPlayReport.findUnique({
      where: { matchId: params.matchId },
      include: {
        match: {
          include: {
            tournament: { select: { name: true } },
            round: { select: { roundNumber: true } },
            moves: { orderBy: { moveNumber: 'asc' } },
            fairPlayEvents: { orderBy: { timestamp: 'asc' } },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Fair play report not yet generated for this match' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error: any) {
    console.error('Error fetching fair play report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const user = verifyToken(authCookie || '');

    if (!user || (user.role !== 'ARBITER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Arbiter or Admin role required' }, { status: 403 });
    }

    const { status, reviewNotes, overturnResult } = await req.json();

    const updateReportData: any = {
      reviewedBy: user.name,
      reviewedAt: new Date(),
    };

    if (status) updateReportData.status = status;
    if (reviewNotes !== undefined) updateReportData.reviewNotes = reviewNotes;

    const updatedReport = await prisma.fairPlayReport.update({
      where: { matchId: params.matchId },
      data: updateReportData,
    });

    // If arbiter overturns result (e.g. forfeit due to fair-play violation)
    if (overturnResult && ['1-0', '0-1', '1/2-1/2', '*'].includes(overturnResult)) {
      await prisma.match.update({
        where: { id: params.matchId },
        data: {
          result: overturnResult,
          resultReason: 'ARBITER_OVERTURNED',
        },
      });
    }

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (error: any) {
    console.error('Error updating fair play report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}