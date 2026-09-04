import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { Chess } from 'chess.js';

export interface PositionEvaluation {
  cp?: number;          // Centipawns from White perspective (positive = White winning)
  mate?: number;        // Mate in X moves (positive = White mates, negative = Black mates)
  bestMove: string;     // e.g. "e2e4"
  pv: string[];         // Principal variation line: ["e2e4", "c7c5", "g1f3"]
  depth: number;
}

interface QueuedTask {
  fen: string;
  depth: number;
  timeoutMs: number;
  skillLevel?: number;
  moveTimeMs?: number;
  resolve: (res: any) => void;
  reject: (err: any) => void;
}

export class StockfishService {
  private static instance: StockfishService | null = null;
  private process: ChildProcess | null = null;
  private queue: QueuedTask[] = [];
  private isProcessing = false;
  private isReady = false;
  private readyCallbacks: (() => void)[] = [];

  private constructor() {
    this.initProcess();
  }

  public static getInstance(): StockfishService {
    if (!StockfishService.instance) {
      StockfishService.instance = new StockfishService();
    }
    return StockfishService.instance;
  }

  private initProcess() {
    try {
      const workerPath = path.resolve(process.cwd(), 'scripts', 'engine-worker.js');
      this.process = spawn('node', [workerPath], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleOutput(data.toString());
      });

      this.process.on('error', (err) => {
        console.error('[StockfishService] Process error:', err);
      });

      this.process.on('exit', (code) => {
        console.warn(`[StockfishService] Engine process exited with code ${code}. Restarting...`);
        this.process = null;
        this.isReady = false;
        setTimeout(() => this.initProcess(), 1000);
      });

      this.sendCommand('uci');
      this.sendCommand('isready');
    } catch (err) {
      console.error('[StockfishService] Failed to spawn engine worker:', err);
    }
  }

  private sendCommand(cmd: string) {
    if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
      this.process.stdin.write(cmd + '\n');
    }
  }

  private currentTask: QueuedTask | null = null;
  private currentTaskOutput: string[] = [];
  private taskTimeoutTimer: NodeJS.Timeout | null = null;

  private handleOutput(text: string) {
    const lines = text.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line === 'readyok') {
        this.isReady = true;
        while (this.readyCallbacks.length > 0) {
          const cb = this.readyCallbacks.shift();
          if (cb) cb();
        }
      }

      if (this.currentTask) {
        this.currentTaskOutput.push(line);

        if (line.startsWith('bestmove')) {
          this.finishCurrentTask();
        }
      }
    }
  }

  private waitUntilReady(): Promise<void> {
    if (this.isReady) return Promise.resolve();
    return new Promise((resolve) => {
      this.readyCallbacks.push(resolve);
      this.sendCommand('isready');
    });
  }

  public async evaluatePosition(fen: string, depth = 10, timeoutMs = 4000): Promise<PositionEvaluation> {
    // Check if terminal position first
    try {
      const testChess = new Chess(fen);
      if (testChess.isCheckmate()) {
        const isWhiteTurn = testChess.turn() === 'w';
        return {
          mate: isWhiteTurn ? -0 : 0,
          cp: isWhiteTurn ? -30000 : 30000,
          bestMove: '(none)',
          pv: [],
          depth: 0,
        };
      }
      if (testChess.isDraw()) {
        return {
          cp: 0,
          bestMove: '(none)',
          pv: [],
          depth: 0,
        };
      }
    } catch {}

    await this.waitUntilReady();

    return new Promise((resolve, reject) => {
      this.queue.push({
        fen,
        depth,
        timeoutMs,
        resolve,
        reject,
      });
      this.processNextTask();
    });
  }

  public async getBotMove(
    fen: string,
    skillLevel: number = 10,
    moveTimeMs: number = 600
  ): Promise<{ move: string; eval?: number; ponder?: string }> {
    await this.waitUntilReady();

    return new Promise((resolve, reject) => {
      this.queue.push({
        fen,
        depth: Math.min(15, Math.max(3, Math.round(skillLevel / 2) + 2)),
        skillLevel: Math.max(0, Math.min(20, skillLevel)),
        moveTimeMs,
        timeoutMs: moveTimeMs + 3000,
        resolve,
        reject,
      });
      this.processNextTask();
    });
  }

  private processNextTask() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    this.currentTask = this.queue.shift() || null;
    if (!this.currentTask) {
      this.isProcessing = false;
      return;
    }

    this.currentTaskOutput = [];

    // Set timeout in case engine hangs
    this.taskTimeoutTimer = setTimeout(() => {
      console.warn('[StockfishService] Task timed out on position:', this.currentTask?.fen);
      this.finishCurrentTask(true);
    }, this.currentTask.timeoutMs);

    // Configure skill level if requested
    if (this.currentTask.skillLevel !== undefined) {
      this.sendCommand(`setoption name Skill Level value ${this.currentTask.skillLevel}`);
    } else {
      this.sendCommand('setoption name Skill Level value 20');
    }

    this.sendCommand(`position fen ${this.currentTask.fen}`);

    if (this.currentTask.moveTimeMs) {
      this.sendCommand(`go movetime ${this.currentTask.moveTimeMs}`);
    } else {
      this.sendCommand(`go depth ${this.currentTask.depth}`);
    }
  }

  private finishCurrentTask(isTimeout = false) {
    if (this.taskTimeoutTimer) {
      clearTimeout(this.taskTimeoutTimer);
      this.taskTimeoutTimer = null;
    }

    const task = this.currentTask;
    const lines = [...this.currentTaskOutput];

    this.currentTask = null;
    this.currentTaskOutput = [];
    this.isProcessing = false;

    if (!task) return;

    if (isTimeout) {
      // Fallback
      task.resolve({
        cp: 0,
        bestMove: '0000',
        pv: [],
        depth: 0,
      });
      this.processNextTask();
      return;
    }

    // Parse Stockfish output lines
    let bestMove = '';
    let ponder = '';
    let lastCp: number | undefined = undefined;
    let lastMate: number | undefined = undefined;
    let pv: string[] = [];
    let reachedDepth = 0;

    // Detect if turn is Black from FEN
    const isBlackTurn = task.fen.split(' ')[1] === 'b';

    for (const line of lines) {
      if (line.startsWith('info') && line.includes('score')) {
        // Parse depth
        const depthMatch = line.match(/\bdepth\s+(\d+)/);
        if (depthMatch) {
          reachedDepth = parseInt(depthMatch[1], 10);
        }

        // Parse score cp
        const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
        if (cpMatch) {
          let rawCp = parseInt(cpMatch[1], 10);
          // Stockfish scores cp relative to side to move!
          // Convert to absolute White perspective:
          lastCp = isBlackTurn ? -rawCp : rawCp;
          lastMate = undefined;
        }

        // Parse score mate
        const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
        if (mateMatch) {
          let rawMate = parseInt(mateMatch[1], 10);
          lastMate = isBlackTurn ? -rawMate : rawMate;
          lastCp = undefined;
        }

        // Parse pv
        const pvMatch = line.match(/\bpv\s+(.+)$/);
        if (pvMatch) {
          pv = pvMatch[1].trim().split(/\s+/);
        }
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/);
        bestMove = parts[1] || '';
        if (parts[2] === 'ponder') {
          ponder = parts[3] || '';
        }
      }
    }

    task.resolve({
      cp: lastCp,
      mate: lastMate,
      bestMove,
      ponder,
      pv,
      depth: reachedDepth,
      move: bestMove,
      eval: lastCp,
    });

    // Schedule next
    setImmediate(() => this.processNextTask());
  }

  public destroy() {
    if (this.taskTimeoutTimer) {
      clearTimeout(this.taskTimeoutTimer);
    }
    if (this.process) {
      this.sendCommand('quit');
      setTimeout(() => {
        this.process?.kill();
        this.process = null;
      }, 200);
    }
    StockfishService.instance = null;
  }
}
