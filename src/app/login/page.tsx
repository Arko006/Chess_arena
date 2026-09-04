'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Swords, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOfficialLogins, setShowOfficialLogins] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.user?.role === 'ADMIN') {
        router.push('/admin');
      } else if (data.user?.role === 'ARBITER') {
        router.push('/arbiter');
      } else {
        router.push('/tournaments');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#141824] border border-gray-800 rounded-2xl p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <Swords className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white">Player Sign In</h2>
          <p className="text-sm text-gray-400 mt-1">Enter your player credentials to join and play tournaments</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Player Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
                className="w-full bg-[#1a1f2e] border border-gray-700 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1a1f2e] border border-gray-700 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Sign In as Player'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Demo Player */}
        <div className="mt-6 pt-5 border-t border-gray-800">
          <button
            type="button"
            onClick={() => handleQuickFill('player@chessarena.com', 'player1234')}
            className="w-full py-2.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <Swords className="w-4 h-4 text-indigo-400" />
            <span>1-Click Demo Player (Hikaru Nakamura)</span>
          </button>

          {/* Collapsible Official Desks */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setShowOfficialLogins(!showOfficialLogins)}
              className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1"
            >
              <span>Arbiter & Platform Admin Sign-in</span>
              {showOfficialLogins ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showOfficialLogins && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-800/60">
                <button
                  type="button"
                  onClick={() => handleQuickFill('arbiter@chessarena.com', 'arbiter1234')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1f2638] hover:bg-[#28324a] text-[11px] font-semibold text-indigo-300 border border-indigo-500/20 transition-colors"
                >
                  FIDE Arbiter
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@chessarena.com', 'admin1234')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1f2638] hover:bg-[#28324a] text-[11px] font-semibold text-purple-300 border border-purple-500/20 transition-colors"
                >
                  Platform Admin
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          New to ChessArena?{' '}
          <Link href="/register" className="text-indigo-400 hover:underline font-semibold">
            Register as Player
          </Link>
        </p>
      </div>
    </div>
  );
}