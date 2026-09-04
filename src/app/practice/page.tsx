'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from '@/components/Chessboard';
import { EvaluationBar, EvaluationData } from '@/components/EvaluationBar';
import { MoveHistory } from '@/components/MoveHistory';
import { sounds } from '@/lib/sounds';
import {
  Cpu, RotateCcw, ArrowLeftRight, Play, Trophy, Shield,
  Sparkles, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';

interface BotLevel {
  id: string;
  name: string;
  rating: number;
  skillLevel: number;
  depth: number;
  description: string;
  badge: string;
}

const BOT_LEVELS: BotLevel[] = [
  { id: 'club', name: 'Club Sparring', rating: 1200, skillLevel: 3, depth: 4, description: 'Forgiving tactical play for casual games.', badge: '🥉 Club' },
  { id: 'intermediate', name: 'Intermediate Bot', rating: 1600, skillLevel: 7, depth: 6, description: 'Solid fundamentals, punishes major mistakes.', badge: '🥈 Inter' },
  { id: 'master', name: 'Master Engine', rating: 2100, skillLevel: 14, depth: 10, description: 'Strong positional play with minimal tactical oversights.', badge: '🥇 Master' },
  { id: 'grandmaster', name: 'Grandmaster Stockfish', rating: 2850, skillLevel: 20, depth: 14, description: 'Near-optimal moves, calculated deep tactical lines.', badge: '🏆 GM' },
];

export default function PracticeArenaPage() {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [selectedBot, setSelectedBot] = useState<BotLevel>(BOT_LEVELS[1]);
  const [history, setHistory] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [gameResultReason, setGameResultReason] = useState<string | null>(null);

  // Sound and check indicator
  const isCheck = chess.inCheck();
  const turn = chess.turn();

  // Evaluate position whenever FEN updates
  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      fetch('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate', fen, depth: 8 }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (active && data.evaluation) {
            setEvaluation(data.evaluation);
          }
        })
        .catch(() => {});
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fen]);

  // Trigger engine move when it is engine's turn
  useEffect(() => {
    const isBotTurn = (turn === 'w' && playerColor === 'black') || (turn === 'b' && playerColor === 'white');

    if (isBotTurn && !chess.isGameOver()) {
      setIsEngineThinking(true);

      const timer = setTimeout(async () => {
        try {
          const res = await fetch('/api/engine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'bot-move',
              fen: chess.fen(),
              skillLevel: selectedBot.skillLevel,
              moveTimeMs: 500,
            }),
          });

          const data = await res.json();
          if (data.move) {
            const from = data.move.substring(0, 2);
            const to = data.move.substring(2, 4);
            const promotion = data.move.length > 4 ? data.move[4] : undefined;

            const executed = chess.move({ from, to, promotion });
            if (executed) {
              if (executed.captured) sounds.playCapture();
              else sounds.playMove();

              if (chess.inCheck()) sounds.playCheck();

              setFen(chess.fen());
              setHistory(chess.history({ verbose: true }));

              checkGameEnd();
            }
          }
        } catch (err) {
          console.error('Bot move error:', err);
        } finally {
          setIsEngineThinking(false);
        }
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [fen, turn, playerColor, selectedBot]);

  const checkGameEnd = () => {
    if (chess.isCheckmate()) {
      sounds.playGameOver();
      const winner = chess.turn() === 'w' ? 'Black' : 'White';
      setGameResult(winner === (playerColor === 'white' ? 'White' : 'Black') ? 'Victory!' : 'Defeat');
      setGameResultReason(`Checkmate - ${winner} wins`);
    } else if (chess.isDraw()) {
      sounds.playGameOver();
      setGameResult('Draw');
      if (chess.isStalemate()) setGameResultReason('Stalemate');
      else if (chess.isThreefoldRepetition()) setGameResultReason('Threefold Repetition');
      else if (chess.isInsufficientMaterial()) setGameResultReason('Insufficient Material');
      else setGameResultReason('50-move rule');
    }
  };

  // Player move handler
  const handlePlayerMove = (from: string, to: string, promotion?: string) => {
    const isPlayerTurn = (turn === 'w' && playerColor === 'white') || (turn === 'b' && playerColor === 'black');
    if (!isPlayerTurn || chess.isGameOver() || isEngineThinking) return;

    try {
      const executed = chess.move({ from, to, promotion });
      if (executed) {
        if (executed.captured) sounds.playCapture();
        else sounds.playMove();

        if (chess.inCheck()) sounds.playCheck();

        setFen(chess.fen());
        setHistory(chess.history({ verbose: true }));

        checkGameEnd();
      }
    } catch {
      // Invalid move rejected by local chess
    }
  };

  const handleResetGame = () => {
    chess.reset();
    setFen(chess.fen());
    setHistory([]);
    setGameResult(null);
    setGameResultReason(null);
    setEvaluation(null);
  };

  const handleFlipColor = () => {
    const nextColor = playerColor === 'white' ? 'black' : 'white';
    setPlayerColor(nextColor);
    setOrientation(nextColor);
    handleResetGame();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Integrated Stockfish Engine Sparring</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Stockfish Practice Arena</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Test your opening preparation and tactical resilience against Stockfish with live evaluation telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleFlipColor}
            className="px-3.5 py-2 rounded-xl bg-[#1a1f2e] hover:bg-[#252b3e] text-gray-300 hover:text-white border border-gray-700 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
            <span>Play as {playerColor === 'white' ? 'Black' : 'White'}</span>
          </button>

          <button
            onClick={handleResetGame}
            className="px-3.5 py-2 rounded-xl bg-[#1a1f2e] hover:bg-[#252b3e] text-gray-300 hover:text-white border border-gray-700 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>New Game</span>
          </button>
        </div>
      </div>

      {/* Main Practice Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Evaluation Bar + Interactive Board */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {/* Opponent (Bot) Status Card */}
          <div className="w-full max-w-[560px] mb-3 px-4 py-3 rounded-2xl bg-[#141824] border border-gray-800 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{selectedBot.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Elo ~{selectedBot.rating}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{selectedBot.badge} &bull; Depth {selectedBot.depth}</span>
              </div>
            </div>

            {isEngineThinking && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Thinking...</span>
              </div>
            )}
          </div>

          {/* Board + Evaluation Bar */}
          <div className="flex items-center justify-center gap-3 w-full max-w-[560px]">
            <EvaluationBar
              evaluation={evaluation}
              orientation={orientation}
              isThinking={isEngineThinking}
            />
            <div className="flex-1">
              <Chessboard
                fen={fen}
                orientation={orientation}
                playerColor={playerColor}
                disabled={chess.isGameOver() || isEngineThinking}
                isCheck={isCheck}
                turn={turn}
                onMove={handlePlayerMove}
              />
            </div>
          </div>

          {/* Player Status Card */}
          <div className="w-full max-w-[560px] mt-3 px-4 py-3 rounded-2xl bg-[#141824] border border-gray-800 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                <span className={`w-4 h-4 rounded-full ${playerColor === 'white' ? 'bg-white' : 'bg-gray-900 border border-gray-600'}`} />
              </div>
              <div>
                <span className="font-bold text-sm text-white">You ({playerColor === 'white' ? 'White' : 'Black'})</span>
                <div className="text-xs text-gray-400">
                  {turn === (playerColor === 'white' ? 'w' : 'b') ? (
                    <span className="text-emerald-400 font-semibold">Your turn to move</span>
                  ) : (
                    <span>Waiting for engine...</span>
                  )}
                </div>
              </div>
            </div>

            {evaluation && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Evaluation</div>
                <div className="font-mono font-bold text-sm text-indigo-300">{evaluation.displayScore}</div>
              </div>
            )}
          </div>

          {/* Game Over Banner */}
          {gameResult && (
            <div className="w-full max-w-[560px] mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/40 text-center shadow-2xl">
              <h2 className="text-lg font-black text-white">{gameResult}</h2>
              <p className="text-xs text-gray-300 mt-0.5">{gameResultReason}</p>
              <button
                onClick={handleResetGame}
                className="mt-3 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                Play Another Match
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Engine Difficulty & Move History */}
        <div className="lg:col-span-4 space-y-6">
          {/* Bot Level Selector */}
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Engine Difficulty Tier</span>
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              {BOT_LEVELS.map((bot) => {
                const isSelected = selectedBot.id === bot.id;
                return (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBot(bot)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md shadow-indigo-600/10'
                        : 'bg-[#191e2c] border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">{bot.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isSelected ? 'bg-indigo-500/30 text-indigo-200' : 'bg-gray-800 text-gray-400'}`}>
                        Elo ~{bot.rating}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">{bot.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Engine Advice & Suggestion */}
          {evaluation?.bestMove && (
            <div className="bg-[#141824] border border-indigo-500/30 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Stockfish Top Recommended Line</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 font-mono font-bold text-xs text-white">
                  {evaluation.bestMove}
                </span>
                {evaluation.pv && evaluation.pv.length > 1 && (
                  <span className="text-xs font-mono text-gray-400 truncate">
                    {evaluation.pv.slice(1, 4).join(' ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Move History Ledger */}
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-3">
              Move Ledger ({history.length} ply)
            </h3>
            <div className="max-h-64 overflow-y-auto scrollbar-thin">
              <MoveHistory history={history} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
