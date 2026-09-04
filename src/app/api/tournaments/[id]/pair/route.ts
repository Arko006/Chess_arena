import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, generateInvitationSecret } from '@/lib/auth';
import {
  generateSwissPairings,
  generateRoundRobinSchedule,
  TournamentPlayerProfile,
  GeneratedPairing,
} from '@/server/tournamentEngine';

function parseTimeControl(tc: string): { initialMs: number; incrementMs: number } {
  const parts = tc.split('+');
  const minutes = parseFloat(parts[0]) || 10;
  const incrementSec = parseFloat(parts[1]) || 5;
  return {
    initialMs: Math.round(minutes * 60 * 1000),
    incrementMs: Math.round(incrementSec * 1000),
  };
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
      return NextResponse.json({ error: 'Unauthorized: Please sign in to generate pairings' }, { status: 401 });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: {
        players: true,
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            matches: {
              include: {
                invitations: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const isAuthorized = user.role === 'ARBITER' || user.role === 'ADMIN' || tournament.createdById === user.id;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Only the Tournament Arbiter or Creator can generate pairings' }, { status: 403 });
    }

    // Determine players: use registered players or derive from existing matches
    let registeredPlayers = tournament.players;

    if (registeredPlayers.length < 2) {
      // Collect unique names from existing matches if not explicitly registered
      const names = new Set<string>();
      tournament.rounds.forEach((r) => {
        r.matches.forEach((m) => {
          if (m.whitePlayerName && m.whitePlayerName !== 'White Player') names.add(m.whitePlayerName);
          if (m.blackPlayerName && m.blackPlayerName !== 'Black Player' && m.blackPlayerName !== 'BYE') names.add(m.blackPlayerName);
        });
      });

      if (names.size >= 2) {
        // Auto-register these players
        let seedCount = 1;
        for (const name of Array.from(names)) {
          const p = await prisma.tournamentPlayer.upsert({
            where: { tournamentId_name: { tournamentId: tournament.id, name } },
            update: {},
            create: {
              tournamentId: tournament.id,
              name,
              rating: 1500,
              seed: seedCount++,
            },
          });
          registeredPlayers.push(p);
        }
      }
    }

    if (registeredPlayers.length < 2) {
      return NextResponse.json({
        error: 'At least 2 players must be registered in the tournament to generate pairings.',
      }, { status: 400 });
    }

    // Determine target round number
    const existingRounds = tournament.rounds;
    let nextRoundNumber = 1;
    let targetRound = existingRounds.find((r) => r.status === 'PENDING' || r.matches.length === 0);

    if (targetRound) {
      nextRoundNumber = targetRound.roundNumber;
    } else {
      nextRoundNumber = existingRounds.length + 1;
      targetRound = await prisma.tournamentRound.create({
        data: {
          tournamentId: tournament.id,
          roundNumber: nextRoundNumber,
          status: 'ACTIVE',
        },
        include: { matches: { include: { invitations: true } } },
      });
    }

    // Check if target round already has matches
    if (targetRound.matches && targetRound.matches.length > 0) {
      return NextResponse.json({
        error: `Round ${nextRoundNumber} already has ${targetRound.matches.length} matches created.`,
      }, { status: 400 });
    }

    // Build Player History profiles
    const playerProfiles: TournamentPlayerProfile[] = registeredPlayers.map((p) => {
      const opponents: string[] = [];
      const colors: ('w' | 'b')[] = [];
      let currentScore = 0;
      let hasHadBye = false;

      existingRounds.forEach((r) => {
        r.matches.forEach((m) => {
          if (m.whitePlayerName === p.name) {
            colors.push('w');
            if (m.blackPlayerName === 'BYE') {
              hasHadBye = true;
              currentScore += 1;
            } else {
              opponents.push(m.blackPlayerName);
              if (m.result === '1-0') currentScore += 1;
              else if (m.result === '1/2-1/2') currentScore += 0.5;
            }
          } else if (m.blackPlayerName === p.name) {
            colors.push('b');
            opponents.push(m.whitePlayerName);
            if (m.result === '0-1') currentScore += 1;
            else if (m.result === '1/2-1/2') currentScore += 0.5;
          }
        });
      });

      return {
        id: p.id,
        name: p.name,
        rating: p.rating,
        seed: p.seed,
        score: currentScore,
        opponents,
        colors,
        hasHadBye,
      };
    });

    let pairings: GeneratedPairing[] = [];

    if (tournament.format === 'ROUND_ROBIN') {
      const schedule = generateRoundRobinSchedule(registeredPlayers.map((p) => p.name));
      const roundSchedule = schedule.find((s) => s.roundNumber === nextRoundNumber);
      pairings = roundSchedule ? roundSchedule.pairings : [];
    } else {
      // Default: Swiss-System
      pairings = generateSwissPairings(playerProfiles);
    }

    if (pairings.length === 0) {
      return NextResponse.json({ error: 'Could not compute valid pairings for this round' }, { status: 400 });
    }

    const { initialMs, incrementMs } = parseTimeControl(tournament.timeControl);

    // Create matches and invitation tokens in DB
    const createdMatches = [];

    for (const pair of pairings) {
      const isBye = pair.isBye || pair.blackPlayerName === 'BYE';

      const match = await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          roundId: targetRound.id,
          whitePlayerName: pair.whitePlayerName,
          blackPlayerName: pair.blackPlayerName,
          timeControl: tournament.timeControl,
          incrementMs,
          whiteTimeRemainingMs: initialMs,
          blackTimeRemainingMs: initialMs,
          status: isBye ? 'FINISHED' : 'PENDING',
          result: isBye ? '1-0' : null,
          resultReason: isBye ? 'BYE' : null,
        },
      });

      let whiteSecret = null;
      let blackSecret = null;

      if (!isBye) {
        whiteSecret = generateInvitationSecret();
        blackSecret = generateInvitationSecret();

        await prisma.matchInvitation.createMany({
          data: [
            {
              matchId: match.id,
              color: 'white',
              tokenHash: whiteSecret.tokenHash,
              rawToken: whiteSecret.rawToken,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            {
              matchId: match.id,
              color: 'black',
              tokenHash: blackSecret.tokenHash,
              rawToken: blackSecret.rawToken,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          ],
        });
      }

      createdMatches.push({
        match,
        isBye,
        invitations: {
          white: whiteSecret ? { rawToken: whiteSecret.rawToken, url: `/join/${whiteSecret.rawToken}` } : null,
          black: blackSecret ? { rawToken: blackSecret.rawToken, url: `/join/${blackSecret.rawToken}` } : null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      roundNumber: nextRoundNumber,
      roundId: targetRound.id,
      matchCount: createdMatches.length,
      matches: createdMatches,
    });
  } catch (error: any) {
    console.error('Error generating pairings:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate pairings' }, { status: 500 });
  }
}
