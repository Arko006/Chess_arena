import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('chessarena_auth')?.value;
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const user = verifyToken(authCookie || authHeader || '');

    const { searchParams } = new URL(req.url);
    let requestedPlayer = searchParams.get('playerName')?.trim();

    // If no player specified in query, use authenticated user's name
    if (!requestedPlayer && user?.name) {
      requestedPlayer = user.name;
    }

    // Collect all distinct player names across tournaments and matches
    const [tournamentPlayers, matches] = await Promise.all([
      prisma.tournamentPlayer.findMany({
        select: { name: true, rating: true, tournamentId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.match.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          tournament: { select: { id: true, name: true, timeControl: true } },
          round: { select: { roundNumber: true } },
          invitations: true,
          fairPlayReport: { select: { accuracyWhite: true, accuracyBlack: true } },
        },
      }),
    ]);

    const playerNamesSet = new Set<string>();
    tournamentPlayers.forEach((p) => playerNamesSet.add(p.name));
    matches.forEach((m) => {
      if (m.whitePlayerName && m.whitePlayerName !== 'White Player') playerNamesSet.add(m.whitePlayerName);
      if (m.blackPlayerName && m.blackPlayerName !== 'Black Player' && m.blackPlayerName !== 'BYE') playerNamesSet.add(m.blackPlayerName);
    });

    const availablePlayers = Array.from(playerNamesSet).sort();

    // Default to first available player if still not set
    if (!requestedPlayer && availablePlayers.length > 0) {
      requestedPlayer = availablePlayers[0];
    }

    if (!requestedPlayer) {
      return NextResponse.json({
        availablePlayers: [],
        player: null,
        stats: null,
        scorecard: [],
        upcomingSchedule: [],
      });
    }

    // Filter matches involving this player
    const playerMatches = matches.filter(
      (m) => m.whitePlayerName === requestedPlayer || m.blackPlayerName === requestedPlayer
    );

    let played = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let points = 0;
    let totalAccuracy = 0;
    let accuracyCount = 0;

    const scorecard = [];
    const upcomingSchedule = [];

    for (const m of playerMatches) {
      const isWhite = m.whitePlayerName === requestedPlayer;
      const opponentName = isWhite ? m.blackPlayerName : m.whitePlayerName;
      const color = isWhite ? 'white' : 'black';

      let outcome: 'WIN' | 'DRAW' | 'LOSS' | 'PENDING' | 'LIVE' = 'PENDING';
      let scoreEarned = 0;

      if (m.status === 'ACTIVE') {
        outcome = 'LIVE';
      } else if (m.status === 'FINISHED' && m.result) {
        played++;
        if (m.result === '1-0') {
          outcome = isWhite ? 'WIN' : 'LOSS';
          scoreEarned = isWhite ? 1 : 0;
        } else if (m.result === '0-1') {
          outcome = isWhite ? 'LOSS' : 'WIN';
          scoreEarned = isWhite ? 0 : 1;
        } else if (m.result === '1/2-1/2') {
          outcome = 'DRAW';
          scoreEarned = 0.5;
        }

        if (outcome === 'WIN') wins++;
        else if (outcome === 'DRAW') draws++;
        else if (outcome === 'LOSS') losses++;
        points += scoreEarned;

        const acc = isWhite
          ? m.fairPlayReport?.accuracyWhite
          : m.fairPlayReport?.accuracyBlack;
        if (typeof acc === 'number') {
          totalAccuracy += acc;
          accuracyCount++;
        }
      }

      // Check for playable invitation link
      const myInvite = m.invitations?.find((i) => i.color === color);
      const playUrl = myInvite?.claimedBy === requestedPlayer || !myInvite?.claimedBy
        ? (myInvite ? `/join/${myInvite.id}` : `/match/${m.id}`)
        : `/match/${m.id}`;

      const cardItem = {
        matchId: m.id,
        tournamentName: m.tournament?.name || 'Invitational Match',
        tournamentId: m.tournamentId,
        roundNumber: m.round?.roundNumber || 1,
        timeControl: m.timeControl,
        whitePlayerName: m.whitePlayerName,
        blackPlayerName: m.blackPlayerName,
        color,
        opponentName,
        status: m.status,
        result: m.result,
        resultReason: m.resultReason,
        outcome,
        scoreEarned,
        accuracy: isWhite ? m.fairPlayReport?.accuracyWhite : m.fairPlayReport?.accuracyBlack,
        createdAt: m.createdAt,
        playUrl: `/match/${m.id}`,
      };

      if (m.status === 'PENDING' || m.status === 'ACTIVE') {
        upcomingSchedule.push(cardItem);
      }
      if (m.status === 'FINISHED' || m.status === 'ACTIVE') {
        scorecard.push(cardItem);
      }
    }

    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
    const avgAccuracy = accuracyCount > 0 ? Math.round((totalAccuracy / accuracyCount) * 10) / 10 : null;

    // Tournaments enrolled
    const enrolledTournamentIds = Array.from(new Set(playerMatches.map((m) => m.tournamentId).filter(Boolean)));
    const enrolledTournaments = await prisma.tournament.findMany({
      where: { id: { in: enrolledTournamentIds as string[] } },
      select: { id: true, name: true, timeControl: true, status: true, format: true },
    });

    return NextResponse.json({
      availablePlayers,
      player: {
        name: requestedPlayer,
        enrolledCount: enrolledTournaments.length,
      },
      stats: {
        played,
        wins,
        draws,
        losses,
        points,
        winRate,
        avgAccuracy,
      },
      enrolledTournaments,
      scorecard,
      upcomingSchedule,
    });
  } catch (error: any) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
