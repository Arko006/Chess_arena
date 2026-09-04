import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        tournament: true,
        round: true,
        moves: { orderBy: { moveNumber: 'asc' } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const eventName = match.tournament?.name || 'ChessArena Match';
    const roundStr = match.round ? `${match.round.roundNumber}` : '1';
    const dateStr = match.createdAt.toISOString().split('T')[0].replace(/-/g, '.');
    const resultStr = match.result || '*';

    // Construct standard FIDE PGN
    let pgnText = `[Event "${eventName}"]\n`;
    pgnText += `[Site "ChessArena Online Platform"]\n`;
    pgnText += `[Date "${dateStr}"]\n`;
    pgnText += `[Round "${roundStr}"]\n`;
    pgnText += `[White "${match.whitePlayerName}"]\n`;
    pgnText += `[Black "${match.blackPlayerName}"]\n`;
    pgnText += `[Result "${resultStr}"]\n`;
    pgnText += `[TimeControl "${match.timeControl}"]\n`;
    if (match.resultReason) {
      pgnText += `[Termination "${match.resultReason}"]\n`;
    }
    pgnText += `\n`;

    if (match.pgn) {
      pgnText += match.pgn + '\n';
    } else {
      let moveNotation = '';
      for (let i = 0; i < match.moves.length; i++) {
        const m = match.moves[i];
        if (m.color === 'w') {
          const moveNum = Math.floor(i / 2) + 1;
          moveNotation += `${moveNum}. ${m.san} `;
        } else {
          moveNotation += `${m.san} `;
        }
      }
      pgnText += (moveNotation.trim() || '*') + ` ${resultStr}\n`;
    }

    return new NextResponse(pgnText, {
      headers: {
        'Content-Type': 'application/x-chess-pgn',
        'Content-Disposition': `attachment; filename="chessarena-match-${match.id}.pgn"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PGN:', error);
    return NextResponse.json({ error: 'Failed to generate PGN' }, { status: 500 });
  }
}