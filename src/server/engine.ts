import { Chess } from 'chess.js';
import { prisma } from '../lib/prisma';

// Piece-square tables for positional heuristic evaluation (from White perspective)
const PAWN_PST = [
    0,  0,  0,  0,  0,  0,  0,  0,
   50, 50, 50, 50, 50, 50, 50, 50,
   10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_PST = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_PST = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_PST = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_PST = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

function evaluateBoardStatic(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -30000 : 30000;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let whiteScore = 0;
  let blackScore = 0;

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type] || 0;
      let pstVal = 0;
      const index = piece.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;

      if (piece.type === 'p') pstVal = PAWN_PST[index];
      else if (piece.type === 'n') pstVal = KNIGHT_PST[index];
      else if (piece.type === 'b') pstVal = BISHOP_PST[index];
      else if (piece.type === 'r') pstVal = ROOK_PST[index];
      else if (piece.type === 'q') pstVal = QUEEN_PST[index];

      if (piece.color === 'w') {
        whiteScore += val + pstVal;
      } else {
        blackScore += val + pstVal;
      }
    }
  }

  return whiteScore - blackScore;
}

// Alpha-beta minimax tactical search
function searchPosition(chess: Chess, depth: number, alpha: number, beta: number, isMaximizing: boolean): { eval: number; bestMove: any } {
  if (depth === 0 || chess.isGameOver()) {
    return { eval: evaluateBoardStatic(chess), bestMove: null };
  }

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return { eval: evaluateBoardStatic(chess), bestMove: null };
  }

  let bestMove = moves[0];

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const res = searchPosition(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (res.eval > maxEval) {
        maxEval = res.eval;
        bestMove = move;
      }
      alpha = Math.max(alpha, res.eval);
      if (beta <= alpha) break;
    }
    return { eval: maxEval, bestMove };
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const res = searchPosition(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (res.eval < minEval) {
        minEval = res.eval;
        bestMove = move;
      }
      beta = Math.min(beta, res.eval);
      if (beta <= alpha) break;
    }
    return { eval: minEval, bestMove };
  }
}

import { StockfishService } from './stockfishService';

export interface MoveAnalysis {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  bestMoveSan: string;
  evalBefore: number;
  evalAfter: number;
  centipawnLoss: number;
  isEngineMatch: boolean;
  classification: 'BEST' | 'EXCELLENT' | 'GOOD' | 'INACCURACY' | 'MISTAKE' | 'BLUNDER';
  timeSpentMs?: number;
  pv?: string[];
}

function uciToSan(chess: Chess, uci: string): string {
  if (!uci || uci.length < 4 || uci === '(none)') return uci;
  const from = uci.substring(0, 2);
  const to = uci.substring(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  const moves = chess.moves({ verbose: true });
  const found = moves.find(m => m.from === from && m.to === to && (!promotion || m.promotion === promotion));
  return found ? found.san : uci;
}

function classifyCpl(cpl: number, isEngineMatch: boolean): 'BEST' | 'EXCELLENT' | 'GOOD' | 'INACCURACY' | 'MISTAKE' | 'BLUNDER' {
  if (isEngineMatch || cpl <= 5) return 'BEST';
  if (cpl <= 25) return 'EXCELLENT';
  if (cpl <= 60) return 'GOOD';
  if (cpl <= 120) return 'INACCURACY';
  if (cpl <= 250) return 'MISTAKE';
  return 'BLUNDER';
}

export async function analyzeMatchFairPlay(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      moves: { orderBy: { moveNumber: 'asc' } },
      fairPlayEvents: { orderBy: { timestamp: 'asc' } },
    },
  });

  if (!match || match.moves.length === 0) return null;

  const simChess = new Chess();
  const analyses: MoveAnalysis[] = [];
  const stockfish = StockfishService.getInstance();

  let whiteCplTotal = 0;
  let whiteMoveCount = 0;
  let whiteEngineMatches = 0;

  let blackCplTotal = 0;
  let blackMoveCount = 0;
  let blackEngineMatches = 0;

  let rapidDifficultMovesWhite = 0;
  let rapidDifficultMovesBlack = 0;

  for (const moveRecord of match.moves) {
    const isWhite = moveRecord.color === 'w';
    const fenBefore = simChess.fen();

    let evalBefore = 0;
    let bestMoveSan = moveRecord.san;
    let pvList: string[] = [];

    // Try Stockfish evaluation first
    try {
      const sfEval = await stockfish.evaluatePosition(fenBefore, 8, 2000);
      evalBefore = sfEval.cp ?? (sfEval.mate !== undefined ? (sfEval.mate > 0 ? 30000 : -30000) : evaluateBoardStatic(simChess));
      if (sfEval.bestMove && sfEval.bestMove !== '(none)') {
        bestMoveSan = uciToSan(simChess, sfEval.bestMove);
      }
      pvList = sfEval.pv || [];
    } catch {
      // Fallback to static heuristic
      const searchRes = searchPosition(simChess, 2, -Infinity, Infinity, isWhite);
      evalBefore = searchRes.eval;
      bestMoveSan = searchRes.bestMove ? searchRes.bestMove.san : moveRecord.san;
    }

    // Execute actual move
    let playedMove: any;
    try {
      playedMove = simChess.move({
        from: moveRecord.fromSquare,
        to: moveRecord.toSquare,
        promotion: moveRecord.promotion || undefined,
      });
    } catch {
      continue;
    }

    if (!playedMove) continue;

    const fenAfter = simChess.fen();
    let evalAfter = 0;
    try {
      const sfEvalAfter = await stockfish.evaluatePosition(fenAfter, 8, 2000);
      evalAfter = sfEvalAfter.cp ?? (sfEvalAfter.mate !== undefined ? (sfEvalAfter.mate > 0 ? 30000 : -30000) : evaluateBoardStatic(simChess));
    } catch {
      evalAfter = evaluateBoardStatic(simChess);
    }

    // Calculate Centipawn Loss (CPL)
    let cpl = 0;
    const isMatch = playedMove.san === bestMoveSan;

    if (isWhite) {
      cpl = isMatch ? 0 : Math.max(0, evalBefore - evalAfter);
      whiteCplTotal += cpl;
      whiteMoveCount++;
      if (isMatch) whiteEngineMatches++;
      if (cpl < 15 && moveRecord.timeSpentMs && moveRecord.timeSpentMs < 1500) {
        rapidDifficultMovesWhite++;
      }
    } else {
      cpl = isMatch ? 0 : Math.max(0, evalAfter - evalBefore);
      blackCplTotal += cpl;
      blackMoveCount++;
      if (isMatch) blackEngineMatches++;
      if (cpl < 15 && moveRecord.timeSpentMs && moveRecord.timeSpentMs < 1500) {
        rapidDifficultMovesBlack++;
      }
    }

    const classification = classifyCpl(cpl, isMatch);

    analyses.push({
      moveNumber: moveRecord.moveNumber,
      color: moveRecord.color as 'w' | 'b',
      san: playedMove.san,
      bestMoveSan,
      evalBefore,
      evalAfter,
      centipawnLoss: cpl,
      isEngineMatch: isMatch,
      classification,
      timeSpentMs: moveRecord.timeSpentMs || undefined,
      pv: pvList.slice(0, 4),
    });
  }

  const acplWhite = whiteMoveCount > 0 ? Math.round(whiteCplTotal / whiteMoveCount) : 0;
  const acplBlack = blackMoveCount > 0 ? Math.round(blackCplTotal / blackMoveCount) : 0;

  // Accuracy formula mapped to 0-100
  const accuracyWhite = Math.round(Math.max(10, Math.min(99.5, 103.1668 * Math.exp(-0.038 * acplWhite) - 3.1669)) * 10) / 10;
  const accuracyBlack = Math.round(Math.max(10, Math.min(99.5, 103.1668 * Math.exp(-0.038 * acplBlack) - 3.1669)) * 10) / 10;

  const topEngineAgreementWhite = whiteMoveCount > 0 ? Math.round((whiteEngineMatches / whiteMoveCount) * 1000) / 10 : 0;
  const topEngineAgreementBlack = blackMoveCount > 0 ? Math.round((blackEngineMatches / blackMoveCount) * 1000) / 10 : 0;

  // Check fair-play signals
  const focusLossEventsWhite = match.fairPlayEvents.filter(e => e.color === 'w' && (e.eventType === 'FOCUS_LOST' || e.eventType === 'TAB_HIDDEN')).length;
  const focusLossEventsBlack = match.fairPlayEvents.filter(e => e.color === 'b' && (e.eventType === 'FOCUS_LOST' || e.eventType === 'TAB_HIDDEN')).length;

  let status: 'CLEAN' | 'SUSPICIOUS' | 'NEEDS_REVIEW' = 'CLEAN';
  const signals: string[] = [];

  if (topEngineAgreementWhite > 80 && whiteMoveCount >= 8) {
    status = 'NEEDS_REVIEW';
    signals.push('White: Exceptionally high engine agreement (>80%)');
  }
  if (topEngineAgreementBlack > 80 && blackMoveCount >= 8) {
    status = 'NEEDS_REVIEW';
    signals.push('Black: Exceptionally high engine agreement (>80%)');
  }
  if (acplWhite < 15 && whiteMoveCount >= 10) {
    if (status !== 'NEEDS_REVIEW') status = 'SUSPICIOUS';
    signals.push('White: Master-level low centipawn loss (<15 ACPL)');
  }
  if (acplBlack < 15 && blackMoveCount >= 10) {
    if (status !== 'NEEDS_REVIEW') status = 'SUSPICIOUS';
    signals.push('Black: Master-level low centipawn loss (<15 ACPL)');
  }
  if (focusLossEventsWhite > 3 && topEngineAgreementWhite > 65) {
    status = 'NEEDS_REVIEW';
    signals.push(`White: Multiple focus loss events (${focusLossEventsWhite}) correlated with high accuracy`);
  }
  if (focusLossEventsBlack > 3 && topEngineAgreementBlack > 65) {
    status = 'NEEDS_REVIEW';
    signals.push(`Black: Multiple focus loss events (${focusLossEventsBlack}) correlated with high accuracy`);
  }

  const reviewNotes = signals.length > 0 ? signals.join('; ') : 'No anomalous fair-play indicators detected.';

  const report = await prisma.fairPlayReport.upsert({
    where: { matchId },
    create: {
      matchId,
      status,
      accuracyWhite,
      accuracyBlack,
      acplWhite,
      acplBlack,
      topEngineAgreementWhite,
      topEngineAgreementBlack,
      engineAnalysis: JSON.stringify(analyses),
      reviewNotes,
    },
    update: {
      status,
      accuracyWhite,
      accuracyBlack,
      acplWhite,
      acplBlack,
      topEngineAgreementWhite,
      topEngineAgreementBlack,
      engineAnalysis: JSON.stringify(analyses),
      reviewNotes,
    },
  });

  return report;
}
