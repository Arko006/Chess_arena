'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Swords, Plus, Copy, Check, Eye, ShieldAlert, Clock, AlertTriangle,
  Play, Pause, Trophy, Share2, RefreshCw, ChevronRight
} from 'lucide-react';

export default function ArbiterDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Match creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [whitePlayerName, setWhitePlayerName] = useState('');
  const [blackPlayerName, setBlackPlayerName] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');
  const [timeControl, setTimeControl] = useState('10+5');
  const [creating, setCreating] = useState(false);
  const [newMatchLinks, setNewMatchLinks] = useState<any>(null);

  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, matchesRes, tourneysRes] = await Promise.all([
        fetch('/api/admin/system'),
        fetch('/api/matches'),
        fetch('/api/tournaments'),
      ]);

      const statsData = await statsRes.json();
      const matchesData = await matchesRes.json();
      const tourneysData = await tourneysRes.json();

      if (statsData.stats) setStats(statsData.stats);
      if (matchesData.matches) setMatches(matchesData.matches);
      if (tourneysData.tournaments) setTournaments(tourneysData.tournaments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whitePlayerName: whitePlayerName.trim() || 'White Player',
          blackPlayerName: blackPlayerName.trim() || 'Black Player',
          tournamentId: selectedTournament || null,
          timeControl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create match');

      setNewMatchLinks(data.invitations);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const activeMatches = matches.filter((m) => m.status === 'ACTIVE' || m.status === 'PENDING' || m.status === 'PAUSED');
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Swords className="w-3.5 h-3.5" />
            <span>FIDE Arbiter Control Station</span>
          </div>
          <h1 className="text-3xl font-black text-white">Arbiter Tournament Desk</h1>
          <p className="text-sm text-gray-400 mt-1">
            Create matches, generate cryptographically isolated invitation links, monitor games live, and review fair play.
          </p>
        </div>

        <button
          onClick={() => {
            setNewMatchLinks(null);
            setShowCreateModal(true);
          }}
          className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 text-sm self-start sm:self-auto hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Match</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Games</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Play className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2">
            {stats?.activeMatches ?? activeMatches.filter(m => m.status === 'ACTIVE').length}
          </div>
        </div>

        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending / Paused</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Pause className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2">
            {activeMatches.filter(m => m.status !== 'ACTIVE').length}
          </div>
        </div>

        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed Matches</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2">{finishedMatches.length}</div>
        </div>

        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Flagged Fair Play</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">
            {matches.filter((m) => m.fairPlayReport?.status === 'SUSPICIOUS' || m.fairPlayReport?.status === 'NEEDS_REVIEW').length}
          </div>
        </div>
      </div>

      {/* Active Matches Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Live & Pending Matches</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
              {activeMatches.length}
            </span>
          </h2>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {activeMatches.length === 0 ? (
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-12 text-center">
            <Swords className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No active matches currently in progress</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
            >
              Create Match Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeMatches.map((match) => (
              <div
                key={match.id}
                className="bg-[#141824] border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-semibold text-gray-400">
                      {match.tournament?.name || 'Invitational Match'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        match.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : match.status === 'PAUSED'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}
                    >
                      {match.status}
                    </span>
                  </div>

                  {/* Players */}
                  <div className="bg-[#1a1f2e] border border-gray-800/80 rounded-xl p-3 mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-white font-medium">
                        <span className="w-3 h-3 rounded-full bg-white border border-gray-400" />
                        {match.whitePlayerName}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        {Math.floor(match.whiteTimeRemainingMs / 60000)}m
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-white font-medium">
                        <span className="w-3 h-3 rounded-full bg-gray-900 border border-gray-600" />
                        {match.blackPlayerName}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        {Math.floor(match.blackTimeRemainingMs / 60000)}m
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 mb-4 px-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      TC: {match.timeControl}
                    </span>
                    <span>Moves: {match._count?.moves || 0}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-800">
                  <Link
                    href={`/arbiter/match/${match.id}`}
                    className="w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Monitor Live (Arbiter Console)</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Matches & Fair Play Review */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Completed Matches & Fair Play Surveillance</h2>

        {finishedMatches.length === 0 ? (
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-8 text-center text-sm text-gray-500">
            No completed matches yet.
          </div>
        ) : (
          <div className="bg-[#141824] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#191e2c] text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">Match / Tournament</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">White Player</th>
                    <th className="py-3 px-4">Black Player</th>
                    <th className="py-3 px-4">Fair-Play Verdict</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {finishedMatches.map((m) => {
                    const fpStatus = m.fairPlayReport?.status || 'CLEAN';
                    let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                    if (fpStatus === 'NEEDS_REVIEW') badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                    else if (fpStatus === 'SUSPICIOUS') badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';

                    return (
                      <tr key={m.id} className="hover:bg-[#191f2f] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {m.tournament?.name || 'Invitational Match'}
                          </div>
                          <div className="text-xs text-gray-500">TC: {m.timeControl}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                          {m.result || '*'}
                        </td>
                        <td className="py-3 px-4">{m.whitePlayerName}</td>
                        <td className="py-3 px-4">{m.blackPlayerName}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeClass}`}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            {fpStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <Link
                            href={`/arbiter/review/${m.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#22293a] hover:bg-indigo-600/30 text-xs font-semibold text-indigo-300 transition-colors"
                          >
                            <span>Engine Review</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Match Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141824] border border-gray-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-2xl font-black text-white mb-2">Create Official Match</h2>
            <p className="text-xs text-gray-400 mb-6">
              The platform will immediately generate two unguessable, cryptographically signed player invitation links.
            </p>

            {newMatchLinks ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                  Match created successfully! Share each link with the assigned player.
                </div>

                {/* White Link */}
                <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-white" />
                      White Player Link:
                    </span>
                    <button
                      onClick={() => copyToClipboard(newMatchLinks.white.url, 'white')}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      {copiedLink === 'white' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink === 'white' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    readOnly
                    value={newMatchLinks.white.url}
                    className="w-full bg-[#121520] border border-gray-800 rounded px-2.5 py-1.5 text-xs text-gray-300 font-mono select-all focus:outline-none"
                  />
                </div>

                {/* Black Link */}
                <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-900 border border-gray-600" />
                      Black Player Link:
                    </span>
                    <button
                      onClick={() => copyToClipboard(newMatchLinks.black.url, 'black')}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      {copiedLink === 'black' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink === 'black' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    readOnly
                    value={newMatchLinks.black.url}
                    className="w-full bg-[#121520] border border-gray-800 rounded px-2.5 py-1.5 text-xs text-gray-300 font-mono select-all focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewMatchLinks(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                  >
                    Done & Return
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateMatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    White Player Name
                  </label>
                  <input
                    type="text"
                    required
                    value={whitePlayerName}
                    onChange={(e) => setWhitePlayerName(e.target.value)}
                    placeholder="e.g. Magnus Carlsen"
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Black Player Name
                  </label>
                  <input
                    type="text"
                    required
                    value={blackPlayerName}
                    onChange={(e) => setBlackPlayerName(e.target.value)}
                    placeholder="e.g. Fabiano Caruana"
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Time Control
                  </label>
                  <select
                    value={timeControl}
                    onChange={(e) => setTimeControl(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1+0">1+0 (Bullet)</option>
                    <option value="3+0">3+0 (Blitz)</option>
                    <option value="3+2">3+2 (Blitz with Increment)</option>
                    <option value="5+0">5+0 (Blitz)</option>
                    <option value="5+3">5+3 (Rapid)</option>
                    <option value="10+0">10+0 (Rapid)</option>
                    <option value="10+5">10+5 (Official Championship)</option>
                    <option value="15+10">15+10 (Classical)</option>
                    <option value="30+0">30+0 (Classical)</option>
                  </select>
                </div>

                {tournaments.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                      Assign to Tournament (Optional)
                    </label>
                    <select
                      value={selectedTournament}
                      onChange={(e) => setSelectedTournament(e.target.value)}
                      className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Standalone Match</option>
                      {tournaments.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    {creating ? 'Generating Secure Tokens...' : 'Generate Match & Links'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}