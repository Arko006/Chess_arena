'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface ChessClockProps {
  timeRemainingMs: number;
  isActive: boolean;
  isPaused: boolean;
  playerName: string;
  color: 'white' | 'black';
  connected?: boolean;
}

export const ChessClock: React.FC<ChessClockProps> = ({
  timeRemainingMs,
  isActive,
  isPaused,
  playerName,
  color,
  connected = true,
}) => {
  const [displayTimeMs, setDisplayTimeMs] = useState(timeRemainingMs);

  useEffect(() => {
    setDisplayTimeMs(timeRemainingMs);
  }, [timeRemainingMs]);

  // Smooth local ticking countdown when it is this clock's active turn
  useEffect(() => {
    if (!isActive || isPaused || displayTimeMs <= 0) return;

    const interval = setInterval(() => {
      setDisplayTimeMs((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  // Format time display
  const totalSeconds = Math.max(0, Math.floor(displayTimeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((displayTimeMs % 1000) / 100);

  const formattedTime =
    displayTimeMs < 10000 && displayTimeMs > 0
      ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isLowTime = displayTimeMs > 0 && displayTimeMs <= 30000;
  const isCriticalTime = displayTimeMs > 0 && displayTimeMs <= 10000;
  const isTimeOut = displayTimeMs <= 0;

  let bgClass = 'bg-[#1e2330] border-gray-800 text-gray-300';
  if (isTimeOut) {
    bgClass = 'bg-red-950/60 border-red-800 text-red-400';
  } else if (isCriticalTime && isActive) {
    bgClass = 'bg-red-900/50 border-red-500 text-red-300 animate-pulse';
  } else if (isLowTime && isActive) {
    bgClass = 'bg-amber-900/40 border-amber-500 text-amber-300';
  } else if (isActive) {
    bgClass = 'bg-[#283248] border-indigo-500 text-white shadow-lg shadow-indigo-500/10';
  }

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${bgClass}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-3.5 h-3.5 rounded-full border ${
            color === 'white' ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-600'
          }`}
        />
        <div className="truncate">
          <div className="font-semibold text-sm truncate flex items-center gap-1.5">
            <span className="truncate">{playerName}</span>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                connected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
              }`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <div className="text-[11px] text-gray-400 capitalize">{color}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-3">
        <Clock className={`w-4 h-4 ${isActive ? 'text-indigo-400 animate-spin-slow' : 'text-gray-500'}`} />
        <span
          className={`font-mono font-black text-2xl tracking-wider ${
            isTimeOut
              ? 'text-red-500'
              : isCriticalTime
              ? 'text-red-400'
              : isLowTime
              ? 'text-amber-400'
              : isActive
              ? 'text-white'
              : 'text-gray-300'
          }`}
        >
          {formattedTime}
        </span>
      </div>
    </div>
  );
};