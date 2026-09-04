'use client';

import React, { useEffect, useRef } from 'react';
import { Copy, Check, Download } from 'lucide-react';

interface MoveHistoryProps {
  history: Array<{ san: string; from: string; to: string; piece: string; color: string }>;
  matchId?: string;
  result?: string;
  resultReason?: string;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  history = [],
  matchId,
  result,
  resultReason,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history]);

  // Pair up moves by turn: [White, Black]
  const movePairs: Array<{ number: number; white: string; black?: string }> = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: history[i]?.san || '',
      black: history[i + 1]?.san,
    });
  }

  const handleCopyPgn = () => {
    let pgnStr = '';
    movePairs.forEach((pair) => {
      pgnStr += `${pair.number}. ${pair.white} ${pair.black ? pair.black + ' ' : ''}`;
    });
    if (result) pgnStr += ` ${result}`;
    navigator.clipboard.writeText(pgnStr.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#171b26] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e2332] border-b border-gray-800">
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Move Ledger</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyPgn}
            className="p-1.5 rounded-lg bg-[#283044] hover:bg-[#343e58] text-gray-300 hover:text-white transition-colors"
            title="Copy notation"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {matchId && (
            <a
              href={`/api/matches/${matchId}/pgn`}
              download
              className="p-1.5 rounded-lg bg-[#283044] hover:bg-[#343e58] text-gray-300 hover:text-white transition-colors"
              title="Download PGN"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-1 text-sm font-mono scrollbar-thin">
        {movePairs.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 italic">Game has not started yet</div>
        ) : (
          movePairs.map((pair) => (
            <div
              key={pair.number}
              className="grid grid-cols-12 py-1 px-2 rounded hover:bg-[#202738] transition-colors items-center"
            >
              <span className="col-span-3 text-xs text-gray-500 font-semibold">{pair.number}.</span>
              <span className="col-span-4 text-gray-200 font-medium">{pair.white}</span>
              <span className="col-span-5 text-gray-300 font-medium">{pair.black || ''}</span>
            </div>
          ))
        )}

        {result && (
          <div className="mt-3 pt-3 border-t border-gray-800 text-center">
            <div className="text-base font-bold text-indigo-400">{result}</div>
            {resultReason && (
              <div className="text-[11px] text-gray-400 font-sans uppercase tracking-wider mt-0.5">
                {resultReason.replace(/_/g, ' ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};