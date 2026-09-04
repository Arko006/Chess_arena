import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeTournamentStandings } from '@/server/tournamentEngine';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        players: {
          orderBy: [{ seed: 'asc' }, { rating: 'desc' }],
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            matches: {
              orderBy: { createdAt: 'desc' },
              include: {
                moves: { select: { id: true } },
                fairPlayReport: { select: { status: true } },
                invitations: true,
              },
            },
          },
        },
        matches: {
          orderBy: { createdAt: 'desc' },
          include: {
            moves: { select: { id: true } },
            fairPlayReport: { select: { status: true, accuracyWhite: true, accuracyBlack: true } },
            invitations: true,
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Determine players list (from registered players or match history)
    const playerList = tournament.players.length > 0
      ? tournament.players.map(p => ({ name: p.name, rating: p.rating, seed: p.seed }))
      : Array.from(new Set(tournament.matches.flatMap(m => [m.whitePlayerName, m.blackPlayerName])))
          .filter(n => n && n !== 'BYE' && n !== 'White Player' && n !== 'Black Player')
          .map((name, idx) => ({ name, rating: 1500, seed: idx + 1 }));

    // Compute FIDE Standings with Buchholz & Sonneborn-Berger
    const standings = computeTournamentStandings(playerList, tournament.matches);

    // Build Crosstable Matrix
    // Map of [playerA][playerB] -> score string ('1', '0', '½')
    const matrix: Record<string, Record<string, string>> = {};
    standings.forEach(p => {
      matrix[p.name] = {};
    });

    tournament.matches.forEach(m => {
      if (!m.result || m.result === '*' || m.result === 'ABORTED') return;
      const w = m.whitePlayerName;
      const b = m.blackPlayerName;

      if (matrix[w] && matrix[b]) {
        if (m.result === '1-0') {
          matrix[w][b] = '1';
          matrix[b][w] = '0';
        } else if (m.result === '0-1') {
          matrix[w][b] = '0';
          matrix[b][w] = '1';
        } else if (m.result === '1/2-1/2') {
          matrix[w][b] = '½';
          matrix[b][w] = '½';
        }
      }
    });

    const crosstable = {
      players: standings.map(s => ({ rank: s.rank, name: s.name, rating: s.rating, points: s.points })),
      matrix,
    };

    return NextResponse.json({ tournament, standings, crosstable });
  } catch (error: any) {
    console.error('Error fetching tournament details:', error);
    return NextResponse.json({ error: 'Failed to fetch tournament' }, { status: 500 });
  }
}