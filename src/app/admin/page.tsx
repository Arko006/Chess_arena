'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert, Users, Trophy, Swords, AlertTriangle, CheckCircle2,
  Lock, UserCheck, UserX, ArrowRight, Activity, ShieldCheck
} from 'lucide-react';

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const fetchAdminData = async () => {
    try {
      const [usersRes, sysRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/system'),
      ]);

      const usersData = await usersRes.json();
      const sysData = await sysRes.json();

      if (usersData.users) setUsers(usersData.users);
      if (sysData.stats) setStats(sysData.stats);
      if (sysData.recentMatches) setRecentMatches(sysData.recentMatches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUpdateUser = async (userId: string, updates: { role?: string; status?: string }) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      setFeedback(`User updated successfully.`);
      setTimeout(() => setFeedback(''), 3000);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading admin control center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6 mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Platform Root Administrator Console</span>
        </div>
        <h1 className="text-3xl font-black text-white">System Admin Control</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage system users, arbiters, tournament integrity, and global platform configuration.
        </p>
      </div>

      {feedback && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Registered Users
          </span>
          <div className="text-2xl font-black text-white">{stats?.totalUsers || 0}</div>
        </div>

        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Certified Arbiters
          </span>
          <div className="text-2xl font-black text-indigo-400">{stats?.totalArbiters || 0}</div>
        </div>

        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Tournaments Organized
          </span>
          <div className="text-2xl font-black text-white">{stats?.totalTournaments || 0}</div>
        </div>

        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Total Matches Logged
          </span>
          <div className="text-2xl font-black text-emerald-400">{stats?.totalMatches || 0}</div>
        </div>
      </div>

      {/* User & Arbiter Management */}
      <div className="bg-[#141824] border border-gray-800 rounded-2xl overflow-hidden shadow-xl mb-10">
        <div className="p-5 bg-[#191e2c] border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>User & Arbiter Management</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Promote users to Arbiter, modify privileges, or suspend non-compliant accounts.
            </p>
          </div>
          <span className="text-xs text-gray-400 font-semibold">{users.length} accounts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#121520] text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#191f2f] transition-colors">
                  <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                  <td className="py-3 px-4 text-gray-400 font-mono text-xs">{u.email}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        u.role === 'ADMIN'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : u.role === 'ARBITER'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {u.role !== 'ARBITER' && u.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleUpdateUser(u.id, { role: 'ARBITER' })}
                        className="px-2.5 py-1 rounded bg-[#22293a] hover:bg-indigo-600/30 text-xs font-semibold text-indigo-300 transition-colors"
                      >
                        Make Arbiter
                      </button>
                    )}

                    {u.role === 'ARBITER' && (
                      <button
                        onClick={() => handleUpdateUser(u.id, { role: 'PLAYER' })}
                        className="px-2.5 py-1 rounded bg-[#22293a] hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
                      >
                        Revoke Arbiter
                      </button>
                    )}

                    {u.status === 'ACTIVE' ? (
                      <button
                        onClick={() => handleUpdateUser(u.id, { status: 'SUSPENDED' })}
                        className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-xs font-semibold text-red-400 transition-colors"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateUser(u.id, { status: 'ACTIVE' })}
                        className="px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-xs font-semibold text-emerald-400 transition-colors"
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Matches Audit */}
      <div className="bg-[#141824] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 bg-[#191e2c] border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-indigo-400" />
            <span>Platform Matches Audit Log</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#121520] text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-4">Match ID</th>
                <th className="py-3 px-4">Tournament</th>
                <th className="py-3 px-4">White</th>
                <th className="py-3 px-4">Black</th>
                <th className="py-3 px-4">Status / Result</th>
                <th className="py-3 px-4 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
              {recentMatches.map((m) => (
                <tr key={m.id} className="hover:bg-[#191f2e] transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-gray-500">{m.id.substring(0, 10)}...</td>
                  <td className="py-3 px-4 text-xs font-semibold text-white">
                    {m.tournament?.name || 'Invitational'}
                  </td>
                  <td className="py-3 px-4">{m.whitePlayerName}</td>
                  <td className="py-3 px-4">{m.blackPlayerName}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-indigo-400 mr-2">
                      {m.result || '*'}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase">({m.status})</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/arbiter/review/${m.id}`}
                      className="px-3 py-1.5 rounded-lg bg-[#22293a] hover:bg-indigo-600/30 text-xs font-semibold text-indigo-300 transition-colors inline-flex items-center gap-1"
                    >
                      <span>Fair-Play</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}