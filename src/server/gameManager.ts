import { Chess } from 'chess.js';
import { prisma } from '../lib/prisma';
import { analyzeMatchFairPlay } from './engine';

export interface ActiveMatchState {
  matchId: string;
  chess: Chess;
  whiteTimeRemainingMs: number;
  blackTimeRemainingMs: number;
  activeColor: 'w' | 'b';
  lastMoveTimestamp: number;
  incrementMs: number;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
  result?: string;
  resultReason?: string;
  isPaused: boolean;
  whitePlayerName: string;
  blackPlayerName: string;
  whiteConnected: boolean;
  blackConnected: boolean;
  drawOfferedBy: 'w' | 'b' | null;
  startedAt?: Date;
  endedAt?: Date;
}

export class GameManager {
  private static instance: GameManager;
  private matches: Map<string, ActiveMatchState> = new Map();
  private timeoutInterval: NodeJS.Timeout | null = null;
  private ioServer: any = null;

  private constructor() {
    this.startClockTicker();
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  public setIoServer(io: any) {
    this.ioServer = io;
  }

  private startClockTicker() {
    if (this.timeoutInterval) return;
    this.timeoutInterval = setInterval(() => {
      this.checkTimeouts();
    }, 500);
  }

  private async checkTimeouts() {
    const now = Date.now();
    this.matches.forEach(async (match, matchId) => {
      if (match.status !== 'ACTIVE' || match.isPaused || !match.lastMoveTimestamp) {
        return;
      }

      const elapsed = now - match.lastMoveTimestamp;
      if (match.activeColor === 'w') {
        const currentWhiteTime = match.whiteTimeRemainingMs - elapsed;
        if (currentWhiteTime <= 0) {
          await this.handleTimeout(matchId, 'w');
        }
      } else {
        const currentBlackTime = match.blackTimeRemainingMs - elapsed;
        if (currentBlackTime <= 0) {
          await this.handleTimeout(matchId, 'b');
        }
      }
    });
  }

  private async handleTimeout(matchId: string, timedOutColor: 'w' | 'b') {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'ACTIVE') return;

    match.status = 'FINISHED';
    if (timedOutColor === 'w') {
      match.whiteTimeRemainingMs = 0;
      match.result = '0-1';
      match.resultReason = 'TIMEOUT';
    } else {
      match.blackTimeRemainingMs = 0;
      match.result = '1-0';
      match.resultReason = 'TIMEOUT';
    }
    match.endedAt = new Date();

    try {
      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: 'FINISHED',
          result: match.result,
          resultReason: match.resultReason,
          whiteTimeRemainingMs: match.whiteTimeRemainingMs,
          blackTimeRemainingMs: match.blackTimeRemainingMs,
          endedAt: match.endedAt,
        },
      });

      if (this.ioServer) {
        this.ioServer.to(`match:${matchId}`).emit('match:state', this.getClientState(matchId));
        this.ioServer.to(`match:${matchId}`).emit('match:finish', {
          result: match.result,
          resultReason: match.resultReason,
        });
      }

      // Trigger Fair Play Engine Analysis in background
      analyzeMatchFairPlay(matchId).catch(err => {
        console.error(`FairPlay analysis error for match ${matchId}:`, err);
      });
    } catch (err) {
      console.error(`Error saving timeout for match ${matchId}:`, err);
    }
  }

  public async getMatch(matchId: string): Promise<ActiveMatchState | null> {
    if (this.matches.has(matchId)) {
      return this.matches.get(matchId)!;
    }

    const dbMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: { moves: { orderBy: { moveNumber: 'asc' } } },
    });

    if (!dbMatch) return null;

    const chess = new Chess();
    if (dbMatch.fen) {
      try {
        chess.load(dbMatch.fen);
      } catch {
        chess.reset();
      }
    }

    const matchState: ActiveMatchState = {
      matchId: dbMatch.id,
      chess,
      whiteTimeRemainingMs: dbMatch.whiteTimeRemainingMs,
      blackTimeRemainingMs: dbMatch.blackTimeRemainingMs,
      activeColor: dbMatch.activeColor as 'w' | 'b',
      lastMoveTimestamp: dbMatch.lastMoveTimestamp ? new Date(dbMatch.lastMoveTimestamp).getTime() : 0,
      incrementMs: dbMatch.incrementMs,
      status: dbMatch.status as any,
      result: dbMatch.result || undefined,
      resultReason: dbMatch.resultReason || undefined,
      isPaused: dbMatch.isPaused,
      whitePlayerName: dbMatch.whitePlayerName,
      blackPlayerName: dbMatch.blackPlayerName,
      whiteConnected: false,
      blackConnected: false,
      drawOfferedBy: (dbMatch.drawOfferedBy as 'w' | 'b') || null,
      startedAt: dbMatch.startedAt || undefined,
      endedAt: dbMatch.endedAt || undefined,
    };

    this.matches.set(matchId, matchState);
    return matchState;
  }

  public getClientState(matchId: string) {
    const match = this.matches.get(matchId);
    if (!match) return null;

    let currentWhiteTime = match.whiteTimeRemainingMs;
    let currentBlackTime = match.blackTimeRemainingMs;

    if (match.status === 'ACTIVE' && !match.isPaused && match.lastMoveTimestamp > 0) {
      const elapsed = Date.now() - match.lastMoveTimestamp;
      if (match.activeColor === 'w') {
        currentWhiteTime = Math.max(0, match.whiteTimeRemainingMs - elapsed);
      } else {
        currentBlackTime = Math.max(0, match.blackTimeRemainingMs - elapsed);
      }
    }

    return {
      matchId: match.matchId,
      fen: match.chess.fen(),
      pgn: match.chess.pgn(),
      turn: match.chess.turn(),
      activeColor: match.activeColor,
      isCheck: match.chess.isCheck(),
      isCheckmate: match.chess.isCheckmate(),
      isDraw: match.chess.isDraw(),
      isGameOver: match.chess.isGameOver(),
      whiteTimeRemainingMs: currentWhiteTime,
      blackTimeRemainingMs: currentBlackTime,
      incrementMs: match.incrementMs,
      status: match.status,
      result: match.result,
      resultReason: match.resultReason,
      isPaused: match.isPaused,
      whitePlayerName: match.whitePlayerName,
      blackPlayerName: match.blackPlayerName,
      whiteConnected: match.whiteConnected,
      blackConnected: match.blackConnected,
      drawOfferedBy: match.drawOfferedBy,
      history: match.chess.history({ verbose: true }),
    };
  }

  public async startMatch(matchId: string): Promise<boolean> {
    const match = await this.getMatch(matchId);
    if (!match || match.status !== 'PENDING') return false;

    match.status = 'ACTIVE';
    match.startedAt = new Date();
    match.lastMoveTimestamp = Date.now();

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'ACTIVE',
        startedAt: match.startedAt,
        lastMoveTimestamp: new Date(match.lastMoveTimestamp),
      },
    });

    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:state', this.getClientState(matchId));
    }
    return true;
  }

  public async makeMove(
    matchId: string,
    moveData: { from: string; to: string; promotion?: string },
    playerColor: 'white' | 'black',
    playerId?: string
  ): Promise<{ success: boolean; error?: string; state?: any }> {
    const match = await this.getMatch(matchId);
    if (!match) return { success: false, error: 'Match not found' };

    if (match.status === 'PENDING') {
      await this.startMatch(matchId);
    }

    if (match.status !== 'ACTIVE') {
      return { success: false, error: `Match is currently ${match.status.toLowerCase()}` };
    }

    if (match.isPaused) {
      return { success: false, error: 'Match is currently paused by the arbiter' };
    }

    const expectedColor = match.chess.turn() === 'w' ? 'white' : 'black';
    if (playerColor !== expectedColor) {
      return { success: false, error: `Not your turn. It is ${expectedColor}'s turn.` };
    }

    const now = Date.now();
    const elapsed = match.lastMoveTimestamp ? now - match.lastMoveTimestamp : 0;

    // Deduct elapsed clock time
    if (playerColor === 'white') {
      match.whiteTimeRemainingMs = Math.max(0, match.whiteTimeRemainingMs - elapsed);
      if (match.whiteTimeRemainingMs <= 0) {
        await this.handleTimeout(matchId, 'w');
        return { success: false, error: 'Time expired' };
      }
      match.whiteTimeRemainingMs += match.incrementMs;
    } else {
      match.blackTimeRemainingMs = Math.max(0, match.blackTimeRemainingMs - elapsed);
      if (match.blackTimeRemainingMs <= 0) {
        await this.handleTimeout(matchId, 'b');
        return { success: false, error: 'Time expired' };
      }
      match.blackTimeRemainingMs += match.incrementMs;
    }

    let moveResult: any;
    try {
      moveResult = match.chess.move({
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion || 'q',
      });
    } catch {
      return { success: false, error: 'Illegal move rejected by server' };
    }

    if (!moveResult) {
      return { success: false, error: 'Illegal move rejected by server' };
    }

    // Move is valid! Update match state
    match.lastMoveTimestamp = now;
    match.activeColor = match.chess.turn();
    match.drawOfferedBy = null; // Clear draw offer on move

    const moveCount = match.chess.history().length;

    // Check game termination conditions
    if (match.chess.isGameOver()) {
      match.status = 'FINISHED';
      match.endedAt = new Date();

      if (match.chess.isCheckmate()) {
        match.result = playerColor === 'white' ? '1-0' : '0-1';
        match.resultReason = 'CHECKMATE';
      } else if (match.chess.isStalemate()) {
        match.result = '1/2-1/2';
        match.resultReason = 'STALEMATE';
      } else if (match.chess.isInsufficientMaterial()) {
        match.result = '1/2-1/2';
        match.resultReason = 'INSUFFICIENT_MATERIAL';
      } else if (match.chess.isThreefoldRepetition()) {
        match.result = '1/2-1/2';
        match.resultReason = 'THREEFOLD_REPETITION';
      } else {
        match.result = '1/2-1/2';
        match.resultReason = 'DRAW_RULE';
      }
    }

    // Persist move & updated match in database
    await prisma.$transaction([
      prisma.move.create({
        data: {
          matchId,
          moveNumber: moveCount,
          color: playerColor === 'white' ? 'w' : 'b',
          fromSquare: moveData.from,
          toSquare: moveData.to,
          promotion: moveData.promotion || null,
          san: moveResult.san,
          fenAfter: match.chess.fen(),
          pgn: match.chess.pgn(),
          timeSpentMs: elapsed,
          playerId: playerId || null,
        },
      }),
      prisma.match.update({
        where: { id: matchId },
        data: {
          fen: match.chess.fen(),
          pgn: match.chess.pgn(),
          status: match.status,
          result: match.result || null,
          resultReason: match.resultReason || null,
          whiteTimeRemainingMs: match.whiteTimeRemainingMs,
          blackTimeRemainingMs: match.blackTimeRemainingMs,
          activeColor: match.activeColor,
          lastMoveTimestamp: new Date(match.lastMoveTimestamp),
          drawOfferedBy: null,
          endedAt: match.endedAt || null,
        },
      }),
    ]);

    const clientState = this.getClientState(matchId);

    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:move', {
        move: moveResult,
        state: clientState,
      });

      if (match.status === 'FINISHED') {
        this.ioServer.to(`match:${matchId}`).emit('match:finish', {
          result: match.result,
          resultReason: match.resultReason,
        });

        // Trigger Fair Play Engine Analysis in background
        analyzeMatchFairPlay(matchId).catch(err => {
          console.error(`FairPlay analysis error for match ${matchId}:`, err);
        });
      }
    }

    return { success: true, state: clientState };
  }

  public async handleResign(matchId: string, playerColor: 'white' | 'black') {
    const match = await this.getMatch(matchId);
    if (!match || match.status !== 'ACTIVE') return false;

    match.status = 'FINISHED';
    match.result = playerColor === 'white' ? '0-1' : '1-0';
    match.resultReason = 'RESIGNATION';
    match.endedAt = new Date();

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'FINISHED',
        result: match.result,
        resultReason: match.resultReason,
        endedAt: match.endedAt,
      },
    });

    const clientState = this.getClientState(matchId);
    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:state', clientState);
      this.ioServer.to(`match:${matchId}`).emit('match:finish', {
        result: match.result,
        resultReason: match.resultReason,
      });
    }

    analyzeMatchFairPlay(matchId).catch(console.error);
    return true;
  }

  public async handleDrawOffer(matchId: string, playerColor: 'white' | 'black') {
    const match = await this.getMatch(matchId);
    if (!match || match.status !== 'ACTIVE') return false;

    match.drawOfferedBy = playerColor === 'white' ? 'w' : 'b';

    await prisma.match.update({
      where: { id: matchId },
      data: { drawOfferedBy: match.drawOfferedBy },
    });

    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:draw-offer', {
        color: playerColor,
      });
    }
    return true;
  }

  public async handleDrawAccept(matchId: string, playerColor: 'white' | 'black') {
    const match = await this.getMatch(matchId);
    if (!match || match.status !== 'ACTIVE' || !match.drawOfferedBy) return false;

    const offererColor = match.drawOfferedBy === 'w' ? 'white' : 'black';
    if (playerColor === offererColor) return false; // Cannot accept own offer

    match.status = 'FINISHED';
    match.result = '1/2-1/2';
    match.resultReason = 'DRAW_AGREEMENT';
    match.endedAt = new Date();
    match.drawOfferedBy = null;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'FINISHED',
        result: match.result,
        resultReason: match.resultReason,
        drawOfferedBy: null,
        endedAt: match.endedAt,
      },
    });

    const clientState = this.getClientState(matchId);
    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:state', clientState);
      this.ioServer.to(`match:${matchId}`).emit('match:finish', {
        result: match.result,
        resultReason: match.resultReason,
      });
    }

    analyzeMatchFairPlay(matchId).catch(console.error);
    return true;
  }

  public async handleDrawDecline(matchId: string, playerColor: 'white' | 'black') {
    const match = await this.getMatch(matchId);
    if (!match || !match.drawOfferedBy) return false;

    match.drawOfferedBy = null;
    await prisma.match.update({
      where: { id: matchId },
      data: { drawOfferedBy: null },
    });

    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:draw-decline', { color: playerColor });
    }
    return true;
  }

  public async handleArbiterAction(
    matchId: string,
    action: 'PAUSE' | 'RESUME' | 'AWARD_WHITE' | 'AWARD_BLACK' | 'AWARD_DRAW' | 'ABORT'
  ) {
    const match = await this.getMatch(matchId);
    if (!match) return false;

    const now = Date.now();

    if (action === 'PAUSE' && match.status === 'ACTIVE' && !match.isPaused) {
      const elapsed = match.lastMoveTimestamp ? now - match.lastMoveTimestamp : 0;
      if (match.activeColor === 'w') {
        match.whiteTimeRemainingMs = Math.max(0, match.whiteTimeRemainingMs - elapsed);
      } else {
        match.blackTimeRemainingMs = Math.max(0, match.blackTimeRemainingMs - elapsed);
      }
      match.isPaused = true;
      match.status = 'PAUSED';
    } else if (action === 'RESUME' && match.status === 'PAUSED' && match.isPaused) {
      match.isPaused = false;
      match.status = 'ACTIVE';
      match.lastMoveTimestamp = now;
    } else if (action === 'AWARD_WHITE') {
      match.status = 'FINISHED';
      match.result = '1-0';
      match.resultReason = 'ARBITER_DECISION';
      match.endedAt = new Date();
    } else if (action === 'AWARD_BLACK') {
      match.status = 'FINISHED';
      match.result = '0-1';
      match.resultReason = 'ARBITER_DECISION';
      match.endedAt = new Date();
    } else if (action === 'AWARD_DRAW') {
      match.status = 'FINISHED';
      match.result = '1/2-1/2';
      match.resultReason = 'ARBITER_DECISION';
      match.endedAt = new Date();
    } else if (action === 'ABORT') {
      match.status = 'FINISHED';
      match.result = '*';
      match.resultReason = 'ABORTED';
      match.endedAt = new Date();
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: match.status,
        result: match.result || null,
        resultReason: match.resultReason || null,
        isPaused: match.isPaused,
        whiteTimeRemainingMs: match.whiteTimeRemainingMs,
        blackTimeRemainingMs: match.blackTimeRemainingMs,
        lastMoveTimestamp: match.lastMoveTimestamp ? new Date(match.lastMoveTimestamp) : null,
        endedAt: match.endedAt || null,
      },
    });

    const clientState = this.getClientState(matchId);
    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:state', clientState);
      if (match.status === 'FINISHED') {
        this.ioServer.to(`match:${matchId}`).emit('match:finish', {
          result: match.result,
          resultReason: match.resultReason,
        });
      }
    }
    return true;
  }

  public setConnectionStatus(matchId: string, color: 'white' | 'black', connected: boolean) {
    const match = this.matches.get(matchId);
    if (!match) return;

    if (color === 'white') match.whiteConnected = connected;
    if (color === 'black') match.blackConnected = connected;

    if (this.ioServer) {
      this.ioServer.to(`match:${matchId}`).emit('match:connection-status', {
        color,
        connected,
      });
    }
  }

  public async recordFairPlayEvent(
    matchId: string,
    eventType: string,
    color?: string,
    playerId?: string,
    metadata?: any
  ) {
    try {
      const event = await prisma.fairPlayEvent.create({
        data: {
          matchId,
          eventType,
          color: color || null,
          playerId: playerId || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      if (this.ioServer) {
        this.ioServer.to(`match:${matchId}`).emit('match:fair-play-event', event);
      }
      return event;
    } catch (err) {
      console.error('Failed to log fair-play event:', err);
      return null;
    }
  }
}
