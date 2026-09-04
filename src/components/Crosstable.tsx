'use client';

import React from 'react';
import { Trophy } from 'lucide-react';

interface CrosstablePlayer {
  rank: number;
  name: string;
  rating: number;
  points: number;
}

interface CrosstableProps {
  crosstable: {
    players: CrosstablePlayer[];
    matrix: Record<string, Record<string, string>>;
  } | null;
}

export const Crosstable: React.FC<CrosstableProps> = ({ crosstable }) => {
  if (!crosstable || !crosstable.players || crosstable.players.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 italic bg-[#141824] rounded-2xl border border-gray-800">
        No crosstable data available yet. Pair and complete matches to populate the matrix.
      </div>
    );
  }

  const { players, matrix } = crosstable;

  return (
    <div className="bg-[#141824] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 bg-[#191e2c] border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>FIDE Tournament Crosstable Matrix</span>
        </h3>
        <span className="text-xs text-gray-400">{players.length} Competitors</span>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-center text-xs font-mono">
          <thead className="bg-[#121520] text-gray-400 uppercase tracking-wider border-b border-gray-800">
            <tr>
              <th className="py-3 px-3 text-left w-10">#</th>
              <th className="py-3 px-4 text-left min-w-[140px]">Player</th>
              <th className="py-3 px-2 w-14">Elo</th>
              {players.map((_, idx) => (
                <th key={idx} className="py-3 px-2 w-10 text-center border-l border-gray-800/80">
                  {idx + 1}
                </th>
              ))}
              <th className="py-3 px-3 w-16 font-bold text-indigo-400 border-l border-gray-700">Pts</th>
              <th className="py-3 px-3 w-12 text-gray-300">Rk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/80 text-gray-300">
            {players.map((p, rowIdx) => (
              <tr key={p.name} className="hover:bg-[#191f2e] transition-colors">
                <td className="py-2.5 px-3 text-left font-bold text-gray-400">{rowIdx + 1}</td>
                <td className="py-2.5 px-4 text-left font-sans font-bold text-white truncate max-w-[160px]">
                  {p.name}
                </td>
                <td className="py-2.5 px-2 text-gray-400 text-[11px]">{p.rating}</td>

                {players.map((opp, colIdx) => {
                  if (rowIdx === colIdx) {
                    return (
                      <td
                        key={opp.name}
                        className="py-2.5 px-2 bg-[#0c0e14] border-l border-gray-800/80 text-gray-700 select-none font-bold"
                      >
                        ✕
                      </td>
                    );
                  }

                  const score = matrix[p.name]?.[opp.name];

                  return (
                    <td
                      key={opp.name}
                      className="py-2.5 px-2 border-l border-gray-800/80 font-bold"
                    >
                      {score === '1' && (
                        <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">1</span>
                      )}
                      {score === '0' && (
                        <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">0</span>
                      )}
                      {score === '½' && (
                        <span className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">½</span>
                      )}
                      {!score && <span className="text-gray-600">-</span>}
                    </td>
                  );
                })}

                <td className="py-2.5 px-3 font-bold text-white bg-indigo-950/20 border-l border-gray-700">
                  {p.points}
                </td>
                <td className="py-2.5 px-3 text-gray-400 font-sans font-semibold">
                  {p.rank}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
