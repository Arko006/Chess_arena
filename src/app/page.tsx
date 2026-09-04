import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Cpu, Clock, Swords, Trophy, Lock, Eye, AlertTriangle, ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [totalMatches, totalTournaments, activeMatches] = await Promise.all([
    prisma.match.count(),
    prisma.tournament.count(),
    prisma.match.count({ where: { status: 'ACTIVE' } }),
  ]);

  const latestTournament = await prisma.tournament.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      matches: {
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          invitations: true,
        },
      },
    },
  });

  return (
    <div className="relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6">
          <ShieldCheck className="w-4 h-4" />
          <span>FIDE Standard Tournament Platform & Fair-Play System</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
          Tournament Chess Built On <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-amber-300">Strict Server Authority</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Cryptographically isolated seat invitations, server-validated moves, synchronized dual clocks, and post-game engine fair-play telemetry.
        </p>

        {/* Action CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/arbiter"
            className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02] flex items-center gap-2"
          >
            <Swords className="w-5 h-5" />
            <span>Open Arbiter Desk</span>
          </Link>
          <Link
            href="/practice"
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 text-purple-200 border border-purple-500/40 font-bold transition-all hover:scale-[1.02] flex items-center gap-2"
          >
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span>Play Stockfish Bot</span>
          </Link>
          <Link
            href="/tournaments"
            className="px-6 py-3.5 rounded-xl bg-[#1a1f2c] hover:bg-[#252b3d] text-gray-200 border border-gray-700 font-semibold transition-all hover:scale-[1.02] flex items-center gap-2"
          >
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Browse Tournaments</span>
          </Link>
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-3 max-w-2xl mx-auto py-4 px-6 rounded-2xl bg-[#141824]/80 border border-gray-800/80 backdrop-blur-sm shadow-xl">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">{totalTournaments}</div>
            <div className="text-xs text-gray-400 mt-0.5">Tournaments</div>
          </div>
          <div className="border-x border-gray-800">
            <div className="text-2xl sm:text-3xl font-black text-indigo-400">{totalMatches}</div>
            <div className="text-xs text-gray-400 mt-0.5">Total Matches</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{activeMatches}</div>
            <div className="text-xs text-gray-400 mt-0.5">Active Games</div>
          </div>
        </div>
      </section>

      {/* Featured Tournament & Active Matches Preview */}
      {latestTournament && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-gradient-to-b from-[#141824] to-[#0f131d] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-indigo-400">Featured Tournament</span>
                <h2 className="text-2xl font-bold text-white mt-1">{latestTournament.name}</h2>
                <p className="text-sm text-gray-400 mt-1">{latestTournament.description}</p>
              </div>
              <Link
                href={`/tournaments/${latestTournament.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-sm font-semibold transition-colors"
              >
                <span>View Full Standings</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {latestTournament.matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#1a1f2e] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all"
                >
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span className="font-semibold text-gray-300">Time Control: {m.timeControl}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        m.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : m.status === 'FINISHED'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>

                  <div className="space-y-2 py-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-white font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-400" />
                        {m.whitePlayerName}
                      </span>
                      <span className="font-mono text-xs text-gray-400">
                        {m.result ? m.result.split('-')[0] : 'White'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-white font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-900 border border-gray-600" />
                        {m.blackPlayerName}
                      </span>
                      <span className="font-mono text-xs text-gray-400">
                        {m.result ? m.result.split('-')[1] : 'Black'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                    <Link
                      href={`/match/${m.id}`}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span>Spectate / Play</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/arbiter/match/${m.id}`}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Arbiter View</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Security Architecture Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Engineered For Fair Play & Uncompromising Integrity
          </h2>
          <p className="mt-3 text-gray-400 text-base">
            Online chess tournaments require rigorous cryptographic protection and server authority.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Cryptographic Invitations</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              256-bit unguessable tokens hashed with SHA-256. White joins only as White, Black only as Black. No seat switching or token forgery.
            </p>
          </div>

          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-4">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Server Authoritative</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Server validates turn, piece ownership, and chess.js legality. The client sends only move coordinates. Board positions are never trusted.
            </p>
          </div>

          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Dual Precision Clocks</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Server clock daemon calculates exact elapsed milliseconds and increments. Automatic timeout forfeiture occurs without client collusion.
            </p>
          </div>

          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Fair-Play Surveillance</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Monitors tab hidden and focus-loss signals. Evaluates centipawn loss (ACPL) and Stockfish engine agreement for arbiters to adjudicate.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}