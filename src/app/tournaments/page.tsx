'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Plus, Clock, Users, ArrowRight, Swords, Calendar } from 'lucide-react';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeControl, setTimeControl] = useState('10+5');
  const [roundsCount, setRoundsCount] = useState('3');
  const [creating, setCreating] = useState(false);

  const fetchTournaments = async () => {
    try {
      const [tRes, uRes] = await Promise.all([
        fetch('/api/tournaments'),
        fetch('/api/auth/me'),
      ]);
      const tData = await tRes.json();
      const uData = await uRes.json();
      if (tData.tournaments) setTournaments(tData.tournaments);
      if (uData.user) setCurrentUser(uData.user);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          timeControl,
          roundsCount: parseInt(roundsCount, 10),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create tournament');

      setShowModal(false);
      setName('');
      setDescription('');
      fetchTournaments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const isArbiter = currentUser?.role === 'ARBITER' || currentUser?.role === 'ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Official Championships & Events</span>
          </div>
          <h1 className="text-3xl font-black text-white">Chess Tournaments</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse official championships, live rounds, standings, and pairings.
          </p>
        </div>

        {isArbiter && (
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 text-sm self-start sm:self-auto hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Organize Tournament</span>
          </button>
        )}
      </div>

      {/* Tournaments Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading tournaments...</p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No Tournaments Listed</h3>
          <p className="text-xs text-gray-400 mb-6">Create the first championship to begin pairings</p>
          {isArbiter && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
            >
              Organize Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="bg-[#141824] border border-gray-800 hover:border-gray-700 rounded-2xl p-6 flex flex-col justify-between transition-all hover:scale-[1.01] group shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {t.timeControl}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {t.status}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors mb-2">
                  {t.name}
                </h2>
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                  {t.description || 'Official online chess tournament with authoritative moves and dual clocks.'}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-4">
                  <span>{t.rounds?.length || 1} Rounds</span>
                  <span>{t._count?.matches || 0} Matches</span>
                </div>
                <div className="text-indigo-400 flex items-center gap-1 font-semibold group-hover:translate-x-1 transition-transform">
                  <span>View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141824] border border-gray-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-2xl font-black text-white mb-2">Organize Tournament</h2>
            <p className="text-xs text-gray-400 mb-6">
              Configure tournament rounds, time controls, and start assigning matches.
            </p>

            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. World Online Rapid Championship"
                  className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rules, schedule, and arbiter guidelines..."
                  className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Time Control
                  </label>
                  <select
                    value={timeControl}
                    onChange={(e) => setTimeControl(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="3+2">3+2 Blitz</option>
                    <option value="5+3">5+3 Rapid</option>
                    <option value="10+5">10+5 Championship</option>
                    <option value="15+10">15+10 Classical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Number of Rounds
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={roundsCount}
                    onChange={(e) => setRoundsCount(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Tournament'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}