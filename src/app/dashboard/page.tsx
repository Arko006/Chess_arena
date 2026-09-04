'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trophy, Calendar, Clock, Swords, CheckCircle2, XCircle, MinusCircle,
  TrendingUp, Award, ExternalLink, ShieldCheck, ChevronRight, User, Play, Filter
} from 'lucide-react';

export default function PlayerDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');

  const fetchDashboard = (player?: string) => {
    setLoading(true);
    const url = player ? `/api/dashboard?playerName=${encodeURIComponent(player)}` : '/api/dashboard';
    fetch(url)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        if (resData.player?.name) {
          setSelectedPlayer(resData.player.name);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const target = params.get('playerName') || params.get('player');
      if (target) {
        setSelectedPlayer(target);
        fetchDashboard(target);
        return;
      }
    }
    fetchDashboard();
  }, []);

  const handlePlayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPlayer = e.target.value;
    setSelectedPlayer(nextPlayer);
    fetchDashboard(nextPlayer);
  };

  if (loading && !data) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading scorecard & schedule...</p>
        </div>
      </div>
    );
  }

  const { stats, scorecard = [], upcomingSchedule = [], availablePlayers = [], enrolledTournaments = [] } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header & Player Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Player Performance & Tournament Schedule</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <span>Scorecard Hub:</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              {data?.player?.name || 'Competitor'}
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Review official match scores, upcoming round pairings, and engine accuracy ratings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/schedule"
            className="px-3.5 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Full Schedule</span>
          </Link>

          {/* Competitor Switcher */}
          {availablePlayers.length > 0 && (
            <div className="flex items-center gap-2 bg-[#141824] border border-gray-800 p-1.5 px-3 rounded-2xl shadow-xl">
              <User className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-gray-400">Competitor:</span>
              <select
                value={selectedPlayer}
                onChange={handlePlayerChange}
                className="bg-[#1a1f2e] border border-gray-700 text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                {availablePlayers.map((pName: string) => (
                  <option key={pName} value={pName}>
                    {pName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {/* Total Points */}
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Tournament Points</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats?.points ?? 0}
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">
            from {stats?.played ?? 0} finished games
          </span>
        </div>

        {/* Record (W / D / L) */}
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Record (W / D / L)</span>
            <Swords className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            <span className="text-emerald-400">{stats?.wins ?? 0}</span>
            <span className="text-gray-500 mx-1">/</span>
            <span className="text-amber-400">{stats?.draws ?? 0}</span>
            <span className="text-gray-500 mx-1">/</span>
            <span className="text-rose-400">{stats?.losses ?? 0}</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">
            Win Rate: <strong className="text-gray-300">{stats?.winRate ?? 0}%</strong>
          </span>
        </div>

        {/* Engine Accuracy */}
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Average Accuracy</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {stats?.avgAccuracy ? `${stats.avgAccuracy}%` : 'N/A'}
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">
            Stockfish Fair-Play telemetry
          </span>
        </div>

        {/* Tournaments Enrolled */}
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Tournaments</span>
            <Trophy className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {enrolledTournaments.length}
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">Active championships</span>
        </div>
      </div>

      {/* Main Grid: Upcoming Scheduled Matches & Scorecard Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: Scheduled & Live Matches */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Upcoming & Live Schedule</h2>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                {upcomingSchedule.length} Assigned
              </span>
            </div>

            {upcomingSchedule.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-500 italic bg-[#191e2c] rounded-xl border border-gray-800/80">
                No upcoming matches scheduled. Check back when the Arbiter generates the next round!
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSchedule.map((m: any) => {
                  const isLive = m.status === 'ACTIVE';
                  const isWhite = m.color === 'white';

                  return (
                    <div
                      key={m.matchId}
                      className={`p-4 rounded-xl border transition-all ${
                        isLive
                          ? 'bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border-indigo-500/50 shadow-lg shadow-indigo-600/10'
                          : 'bg-[#191e2c] border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                          Round {m.roundNumber} &bull; {m.timeControl}
                        </span>
                        {isLive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 animate-pulse">
                            ● LIVE NOW
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-400">
                            Scheduled
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-medium text-gray-300 mb-1">
                        {m.tournamentName}
                      </div>

                      <div className="flex items-center justify-between py-2 border-y border-gray-800/60 my-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border ${
                              isWhite ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-600'
                            }`}
                            title={`You play as ${isWhite ? 'White' : 'Black'}`}
                          />
                          <span className="text-xs text-gray-400">vs</span>
                          <span className="text-xs font-bold text-white">{m.opponentName}</span>
                        </div>
                        <span className="text-[11px] font-mono text-gray-400 capitalize">
                          Play as {m.color}
                        </span>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Link
                          href={m.playUrl}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Enter Arena & Play</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Enrolled Tournaments Quick Links */}
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Championships Enrolled</span>
            </h3>

            <div className="space-y-2">
              {enrolledTournaments.map((t: any) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="p-3 rounded-xl bg-[#191e2c] border border-gray-800/80 hover:border-indigo-500/40 hover:bg-[#1f2538] flex items-center justify-between text-xs transition-all group"
                >
                  <div>
                    <span className="font-bold text-white group-hover:text-indigo-300 block">
                      {t.name}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {t.format || 'SWISS'} &bull; {t.timeControl}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Full Match Scorecard Ledger */}
        <div className="lg:col-span-7 bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Match Scorecard Ledger</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Full chronological tournament history for {data?.player?.name}.
              </p>
            </div>
            <span className="text-xs font-mono text-gray-400">{scorecard.length} matches logged</span>
          </div>

          {scorecard.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-500 italic bg-[#191e2c] rounded-xl border border-gray-800/80">
              No completed matches found yet. Results will automatically appear here once games finish.
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#121520] text-gray-400 uppercase tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-3">Rd</th>
                    <th className="py-3 px-3">Opponent</th>
                    <th className="py-3 px-2">Color</th>
                    <th className="py-3 px-2 text-center">Outcome</th>
                    <th className="py-3 px-2 text-center">Score</th>
                    <th className="py-3 px-2 text-center">Accuracy</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/80 text-gray-300">
                  {scorecard.map((m: any) => {
                    const isWin = m.outcome === 'WIN';
                    const isDraw = m.outcome === 'DRAW';
                    const isLoss = m.outcome === 'LOSS';
                    const isWhite = m.color === 'white';

                    return (
                      <tr key={m.matchId} className="hover:bg-[#191f2e] transition-colors">
                        <td className="py-3 px-3 font-bold text-gray-400">R{m.roundNumber}</td>
                        <td className="py-3 px-3 font-sans font-bold text-white truncate max-w-[140px]">
                          {m.opponentName}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-block w-3 h-3 rounded-full border ${
                              isWhite ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-600'
                            }`}
                            title={isWhite ? 'White' : 'Black'}
                          />
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isWin && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              WIN
                            </span>
                          )}
                          {isDraw && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              DRAW
                            </span>
                          )}
                          {isLoss && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              LOSS
                            </span>
                          )}
                          {m.outcome === 'LIVE' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse">
                              LIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-white font-mono">
                          {m.result || '-'}
                        </td>
                        <td className="py-3 px-2 text-center font-mono">
                          {m.accuracy !== undefined ? (
                            <span className={m.accuracy > 85 ? 'text-emerald-400' : 'text-gray-400'}>
                              {m.accuracy}%
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/match/${m.matchId}`}
                            className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold text-indigo-400 hover:text-indigo-300"
                          >
                            <span>Replay</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}