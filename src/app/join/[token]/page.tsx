'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Swords, Clock, User, AlertCircle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ChessPiece } from '@/components/ChessPieces';

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/join/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load invitation');
        }
        setInvitation(data.invitation);
        if (data.invitation.assignedName && data.invitation.assignedName !== 'White Player' && data.invitation.assignedName !== 'Black Player') {
          setPlayerName(data.invitation.assignedName);
        } else if (data.invitation.claimedBy) {
          setPlayerName(data.invitation.claimedBy);
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setJoining(true);

    try {
      const res = await fetch(`/api/join/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to claim seat');
      }

      // Save token in localStorage as well for socket handshake fallback
      if (data.token) {
        localStorage.setItem(`match_token_${data.matchId}`, data.token);
      }

      router.push(`/match/${data.matchId}`);
    } catch (err: any) {
      setError(err.message);
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Verifying secure invitation token...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#141824] border border-red-900/50 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-xl bg-red-900/30 text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Invitation Unavailable</h2>
          <p className="text-sm text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 rounded-xl bg-[#1f2638] hover:bg-[#28324a] text-sm font-semibold text-gray-300 transition-colors"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  const isWhite = invitation.color === 'white';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-[#141824] border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Color accent highlight */}
        <div
          className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isWhite ? 'bg-amber-300' : 'bg-indigo-600'
          }`}
        />

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Swords className="w-3.5 h-3.5" />
            <span>Official Tournament Match Invitation</span>
          </div>
          <h1 className="text-3xl font-black text-white">Welcome to ChessArena</h1>
          <p className="text-sm text-gray-400 mt-1">
            You have been invited to play as <span className="font-bold text-white uppercase">{invitation.color}</span>
          </p>
        </div>

        {/* Seat Badge Card */}
        <div
          className={`p-5 rounded-2xl border mb-6 flex items-center gap-4 ${
            isWhite
              ? 'bg-amber-950/20 border-amber-800/40'
              : 'bg-indigo-950/20 border-indigo-800/40'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center border shadow-inner ${
              isWhite ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-700'
            }`}
          >
            <div className="w-10 h-10">
              <ChessPiece type="k" color={isWhite ? 'w' : 'b'} />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase font-bold tracking-wider text-gray-400">Assigned Seat</div>
            <div className="text-lg font-black text-white capitalize">{invitation.color} Pieces</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Strict seat enforcement — you can only move {invitation.color} pieces.
            </div>
          </div>
        </div>

        {/* Match details breakdown */}
        <div className="bg-[#191e2c] border border-gray-800 rounded-2xl p-5 mb-6 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Tournament:</span>
            <span className="font-semibold text-white text-right">{invitation.tournamentName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Round:</span>
            <span className="font-semibold text-white">Round {invitation.roundNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Opponent:</span>
            <span className="font-semibold text-indigo-400">{invitation.opponentName || 'Awaiting opponent'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Time Control:</span>
            <span className="font-mono font-bold text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {invitation.timeControl}
            </span>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Your Player Display Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={isWhite ? 'White Player' : 'Black Player'}
                className="w-full bg-[#1a1f2e] border border-gray-700 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={joining}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base hover:scale-[1.01]"
          >
            {joining ? 'Connecting to Arena...' : 'Join Match'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-gray-500 leading-relaxed">
          By joining, you agree to fair-play monitoring. Tab switches and focus losses are tracked and subject to post-game engine surveillance.
        </p>
      </div>
    </div>
  );
}