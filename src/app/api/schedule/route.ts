import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');
    const playerQuery = searchParams.get('player')?.toLowerCase();

    const whereTournament: any = {};
    if (tournamentId) whereTournament.id = tournamentId;

    const tournaments = await prisma.tournament.findMany({
      where: whereTournament,
      orderBy: { createdAt: 'desc' },
      include: {
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            matches: {
              orderBy: { createdAt: 'asc' },
              include: {
                invitations: true,
                fairPlayReport: { select: { accuracyWhite: true, accuracyBlack: true } },
              },
            },
          },
        },
        players: {
          orderBy: [{ score: 'desc' }, { rating: 'desc' }],
        },
      },
    });

    // Flatten matches for global schedule overview
    let allMatches = tournaments.flatMap((t) =>
      t.rounds.flatMap((r) =>
        r.matches.map((m) => ({
          ...m,
          tournamentName: t.name,
          tournamentId: t.id,
          timeControl: t.timeControl,
          roundNumber: r.roundNumber,
        }))
      )
    );

    if (playerQuery) {
      allMatches = allMatches.filter(
        (m) =>
          m.whitePlayerName.toLowerCase().includes(playerQuery) ||
          m.blackPlayerName.toLowerCase().includes(playerQuery)
      );
    }

    const liveMatches = allMatches.filter((m) => m.status === 'ACTIVE');
    const upcomingMatches = allMatches.filter((m) => m.status === 'PENDING');
    const finishedMatches = allMatches.filter((m) => m.status === 'FINISHED');

    return NextResponse.json({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        timeControl: t.timeControl,
        format: t.format,
        roundsCount: t.rounds.length,
        playersCount: t.players.length,
        status: t.status,
      })),
      stats: {
        totalMatches: allMatches.length,
        liveCount: liveMatches.length,
        upcomingCount: upcomingMatches.length,
        finishedCount: finishedMatches.length,
      },
      matches: {
        live: liveMatches,
        upcoming: upcomingMatches,
        finished: finishedMatches,
      },
    });
  } catch (error: any) {
    console.error('Error in schedule API:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
