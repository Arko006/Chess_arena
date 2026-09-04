'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar, Clock, Swords, Search, Filter, Play, ExternalLink,
  Trophy, CheckCircle2, ChevronRight, Eye
} from 'lucide-react';

export default function GlobalSchedulePage() {
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'FINISHED'>('ALL');
  const [tournamentFilter, setTournamentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSchedule = (overrideTournament?: string, overrideSearch?: string) => {
    setLoading(true);
    let url = '/api/schedule';
    const params = new URLSearchParams();
    const effectiveTournament = overrideTournament !== undefined ? overrideTournament : tournamentFilter;
    const effectiveSearch = overrideSearch !== undefined ? overrideSearch : searchQuery;
    if (effectiveTournament && effectiveTournament !== 'ALL') params.set('tournamentId', effectiveTournament);
    if (effectiveSearch && effectiveSearch.trim()) params.set('player', effectiveSearch.trim());
    if (params.toString()) url += `?${params.toString()}`;

    Promise.all([
      fetch(url).then((res) => res.json()),
      fetch('/api/auth/me').then((res) => res.json()).catch(() => ({})),
    ])
      .then(([sData, uData]) => {
        setScheduleData(sData);
        if (uData?.user) setCurrentUser(uData.user);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const tId = sp.get('tournamentId');
      const p = sp.get('player') || sp.get('playerName');
      if (tId || p) {
        if (tId) setTournamentFilter(tId);
        if (p) setSearchQuery(p);
        fetchSchedule(tId || undefined, p || undefined);
        return;
      }
    }
    fetchSchedule();
  }, [tournamentFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSchedule();
  };

  const { tournaments = [], stats = {}, matches = {} } = scheduleData || {};
  const { live = [], upcoming = [], finished = [] } = matches;

  let displayedMatches: any[] = [];
  if (statusFilter === 'ALL') {
    displayedMatches = [...live, ...upcoming, ...finished];
  } else if (statusFilter === 'LIVE') {
    displayedMatches = live;
  } else if (statusFilter === 'UPCOMING') {
    displayedMatches = upcoming;
  } else if (statusFilter === 'FINISHED') {
    displayedMatches = finished;
  }

  const isArbiter = currentUser?.role === 'ARBITER' || currentUser?.role === 'ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Master Timetable & Fixtures</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Tournament Schedule</h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time schedule of live matches, upcoming round pairings, and completed fixtures.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#141824] border border-gray-800 text-center">
            <div className="text-xs text-gray-400">Total Games</div>
            <div className="text-base font-black text-white font-mono">{stats.totalMatches ?? 0}</div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-center">
            <div className="text-xs text-indigo-300">Live Active</div>
            <div className="text-base font-black text-indigo-400 font-mono">{stats.liveCount ?? 0}</div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-[#141824] border border-gray-800 text-center">
            <div className="text-xs text-gray-400">Scheduled</div>
            <div className="text-base font-black text-amber-300 font-mono">{stats.upcomingCount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#141824] border border-gray-800 rounded-2xl p-4 mb-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'LIVE', 'UPCOMING', 'FINISHED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-[#191e2c] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {st === 'ALL' && 'All Fixtures'}
              {st === 'LIVE' && `● Live (${stats.liveCount ?? 0})`}
              {st === 'UPCOMING' && `Upcoming (${stats.upcomingCount ?? 0})`}
              {st === 'FINISHED' && `Results (${stats.finishedCount ?? 0})`}
            </button>
          ))}
        </div>

        {/* Search & Tournament Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tournament filter dropdown */}
          <select
            value={tournamentFilter}
            onChange={(e) => setTournamentFilter(e.target.value)}
            className="bg-[#191e2c] border border-gray-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Tournaments</option>
            {tournaments.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search player name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#191e2c] border border-gray-700 text-xs text-white placeholder-gray-500 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </form>
        </div>
      </div>

      {/* Fixtures List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading schedule...</p>
        </div>
      ) : displayedMatches.length === 0 ? (
        <div className="p-16 text-center bg-[#141824] border border-gray-800 rounded-3xl">
          <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Matches Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            No fixtures match the selected filter criteria. Try selecting "All Fixtures" or clear your search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedMatches.map((m: any) => {
            const isLive = m.status === 'ACTIVE';
            const isFinished = m.status === 'FINISHED';
            const isBye = m.blackPlayerName === 'BYE' || m.resultReason === 'BYE';

            return (
              <div
                key={m.id}
                className={`bg-[#141824] border rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between ${
                  isLive
                    ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-950/20 to-[#141824] shadow-indigo-600/10'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider truncate max-w-[180px]">
                      {m.tournamentName}
                    </span>

                    {isLive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse">
                        ● LIVE NOW
                      </span>
                    )}
                    {isFinished && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {m.result}
                      </span>
                    )}
                    {!isLive && !isFinished && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-400">
                        Round {m.roundNumber}
                      </span>
                    )}
                  </div>

                  {/* Competitors Strip */}
                  <div className="space-y-2.5 py-3 border-y border-gray-800/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-400" />
                        <span className="font-bold text-sm text-white">{m.whitePlayerName}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-gray-300">
                        {m.result ? m.result.split('-')[0] : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-gray-900 border border-gray-600" />
                        <span className="font-bold text-sm text-white">
                          {isBye ? <span className="text-amber-400 italic">BYE (+1 pt)</span> : m.blackPlayerName}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-gray-300">
                        {m.result ? m.result.split('-')[1] : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" /> {m.timeControl}
                    </span>
                    <span>Round {m.roundNumber}</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between">
                  <Link
                    href={`/match/${m.id}`}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>{isFinished ? 'View Game Replay' : 'Enter Arena'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  {isArbiter && !isBye && (
                    <Link
                      href={`/arbiter/match/${m.id}`}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors"
                    >
                      Arbiter View
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
