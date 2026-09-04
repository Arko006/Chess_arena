'use client';

import React from 'react';
import { Cpu } from 'lucide-react';

export interface EvaluationData {
  cp?: number;
  mate?: number;
  displayScore?: string;
  winChance?: number; // 0 to 100 for White
  bestMove?: string;
  pv?: string[];
  depth?: number;
}

interface EvaluationBarProps {
  evaluation: EvaluationData | null;
  orientation?: 'white' | 'black';
  isThinking?: boolean;
  className?: string;
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({
  evaluation,
  orientation = 'white',
  isThinking = false,
  className = '',
}) => {
  // Default to 50/50 if not evaluated yet
  const whitePercent = evaluation?.winChance ?? 50;
  // If orientation is black, flip the bar so black is at top
  const topPercent = orientation === 'white' ? (100 - whitePercent) : whitePercent;
  const bottomPercent = 100 - topPercent;

  const scoreText = evaluation?.displayScore ?? '0.0';
  const isWhiteWinning = (evaluation?.mate && evaluation.mate > 0) || (evaluation?.cp && evaluation.cp > 0);
  const isBlackWinning = (evaluation?.mate && evaluation.mate < 0) || (evaluation?.cp && evaluation.cp < 0);

  return (
    <div
      className={`relative flex flex-col items-center select-none ${className}`}
      title={`Engine Evaluation: ${scoreText}${evaluation?.bestMove ? ` | Best: ${evaluation.bestMove}` : ''}`}
    >
      {/* Outer Bar Shell */}
      <div className="relative w-8 sm:w-9 h-full min-h-[420px] rounded-xl overflow-hidden shadow-2xl border border-gray-700/60 bg-[#1e2330] flex flex-col">
        {/* Top Segment (Black if orientation=white, White if orientation=black) */}
        <div
          className="w-full bg-[#181a20] transition-all duration-500 ease-out flex flex-col justify-start items-center pt-2 relative"
          style={{ height: `${topPercent}%` }}
        >
          {/* Black score text when Black has distinct advantage */}
          {(orientation === 'white' ? isBlackWinning : isWhiteWinning) && topPercent > 18 && (
            <span className="text-[11px] font-black text-gray-300 tracking-tight font-mono px-1 py-0.5 rounded bg-black/40 backdrop-blur-sm">
              {scoreText}
            </span>
          )}
        </div>

        {/* Advantage Divider Line */}
        <div className="w-full h-0.5 bg-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.8)] z-10 shrink-0" />

        {/* Bottom Segment (White if orientation=white, Black if orientation=black) */}
        <div
          className="w-full bg-gradient-to-t from-gray-100 to-gray-200 transition-all duration-500 ease-out flex flex-col justify-end items-center pb-2 relative shadow-inner"
          style={{ height: `${bottomPercent}%` }}
        >
          {/* White score text when White has distinct advantage or equal */}
          {(orientation === 'white' ? !isBlackWinning : !isWhiteWinning) && bottomPercent > 18 && (
            <span className="text-[11px] font-black text-gray-900 tracking-tight font-mono px-1 py-0.5 rounded bg-white/70 backdrop-blur-sm shadow-sm">
              {scoreText}
            </span>
          )}
        </div>

        {/* Center score indicator for close games (<18% height) */}
        {topPercent <= 18 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-white px-1 py-0.5 rounded bg-gray-900/90 border border-gray-700 font-mono shadow-md">
              {scoreText}
            </span>
          </div>
        )}

        {/* Engine Activity Pulse */}
        {isThinking && (
          <div className="absolute top-1.5 right-1.5 z-20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
        )}
      </div>

      {/* Engine Depth Badge below the bar */}
      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-gray-400">
        <Cpu className="w-3 h-3 text-indigo-400" />
        <span>d{evaluation?.depth ?? 8}</span>
      </div>
    </div>
  );
};
