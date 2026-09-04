import { NextRequest, NextResponse } from 'next/server';
import { StockfishService } from '@/server/stockfishService';
import { Chess } from 'chess.js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'evaluate', fen, depth = 10, skillLevel = 10, moveTimeMs = 600 } = body;

    if (!fen || typeof fen !== 'string') {
      return NextResponse.json({ error: 'Valid FEN string is required' }, { status: 400 });
    }

    // Validate FEN with chess.js
    let chess: Chess;
    try {
      chess = new Chess(fen);
    } catch {
      return NextResponse.json({ error: 'Invalid FEN notation' }, { status: 400 });
    }

    const stockfish = StockfishService.getInstance();

    if (action === 'bot-move') {
      if (chess.isGameOver()) {
        return NextResponse.json({
          gameOver: true,
          isCheckmate: chess.isCheckmate(),
          isDraw: chess.isDraw(),
        });
      }

      const res = await stockfish.getBotMove(fen, skillLevel, moveTimeMs);
      let san = res.move;
      // Convert UCI to SAN
      if (res.move && res.move.length >= 4) {
        const from = res.move.substring(0, 2);
        const to = res.move.substring(2, 4);
        const promotion = res.move.length > 4 ? res.move[4] : undefined;
        const legalMoves = chess.moves({ verbose: true });
        const found = legalMoves.find(m => m.from === from && m.to === to && (!promotion || m.promotion === promotion));
        if (found) san = found.san;
      }

      return NextResponse.json({
        success: true,
        move: res.move,
        san,
        ponder: res.ponder,
        eval: res.eval,
      });
    }

    // Default action: 'evaluate'
    const evalResult = await stockfish.evaluatePosition(fen, Math.min(16, Math.max(2, depth)));

    // Format display score: e.g. "+1.4", "-0.8", "M2", "-M1"
    let displayScore = '0.0';
    let winChance = 50; // 0 to 100 for White

    if (evalResult.mate !== undefined) {
      displayScore = evalResult.mate > 0 ? `M${evalResult.mate}` : `-M${Math.abs(evalResult.mate)}`;
      winChance = evalResult.mate > 0 ? 100 : 0;
    } else if (evalResult.cp !== undefined) {
      const pawnVal = evalResult.cp / 100;
      displayScore = pawnVal > 0 ? `+${pawnVal.toFixed(1)}` : pawnVal.toFixed(1);
      // Lichess winning percentage formula: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
      winChance = Math.round(50 + 50 * (2 / (1 + Math.exp(-0.00368208 * evalResult.cp)) - 1));
      winChance = Math.max(2, Math.min(98, winChance));
    }

    return NextResponse.json({
      success: true,
      fen,
      evaluation: {
        cp: evalResult.cp,
        mate: evalResult.mate,
        displayScore,
        winChance,
        bestMove: evalResult.bestMove,
        pv: evalResult.pv,
        depth: evalResult.depth,
      },
    });
  } catch (error: any) {
    console.error('Engine API error:', error);
    return NextResponse.json({ error: error?.message || 'Engine computation failed' }, { status: 500 });
  }
}
