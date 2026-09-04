'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, ArrowLeft, Save,
  CheckCircle2, Clock, User, Eye, Cpu, FileText, Activity
} from 'lucide-react';

export default function ArbiterReviewPage() {
  const params = useParams();
  const matchId = params?.id as string;
  const router = useRouter();

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Arbiter Decision Form state
  const [status, setStatus] = useState<'CLEAN' | 'SUSPICIOUS' | 'NEEDS_REVIEW'>('CLEAN');
  const [reviewNotes, setReviewNotes] = useState('');
  const [overturnResult, setOverturnResult] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!matchId) return;

    fetch(`/api/reports/${matchId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.report) {
          setReportData(data.report);
          setStatus(data.report.status);
          setReviewNotes(data.report.reviewNotes || '');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [matchId]);

  const handleSaveDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/reports/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewNotes,
          overturnResult: overturnResult || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save review');

      setSuccessMsg('Arbiter verdict and notes saved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading Stockfish engine analysis & fair-play telemetry...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-950/40 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-800/60">
          <Activity className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Analysis Generating</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
          The engine analysis is either generating or this game is still in progress. Fair-play reports are automatically compiled upon match completion.
        </p>
        <Link
          href={`/arbiter/match/${matchId}`}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
        >
          Return to Live Monitor
        </Link>
      </div>
    );
  }

  const match = reportData.match;
  let moveAnalyses: any[] = [];
  try {
    moveAnalyses = JSON.parse(reportData.engineAnalysis || '[]');
  } catch {}

  const isSuspicious = reportData.status === 'SUSPICIOUS' || reportData.status === 'NEEDS_REVIEW';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/arbiter/match/${matchId}`}
            className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">Fair-Play & Engine Analysis</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  reportData.status === 'NEEDS_REVIEW'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : reportData.status === 'SUSPICIOUS'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {reportData.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Match: {match.whitePlayerName} vs {match.blackPlayerName} &bull; Result: {match.result || '*'} ({match.resultReason || 'Active'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/matches/${matchId}/pgn`}
            download
            className="px-3 py-2 rounded-xl bg-[#1f2638] hover:bg-[#28324a] text-xs font-semibold text-gray-300 transition-colors"
          >
            Export PGN
          </a>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Accuracy & Engine Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* White Player Stats */}
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white border border-gray-400" />
              {match.whitePlayerName} (White)
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Accuracy Score:</span>
                <span className="font-bold text-white">{reportData.accuracyWhite}%</span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, reportData.accuracyWhite)}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Average Centipawn Loss (ACPL):</span>
              <span className="font-mono font-bold text-white">{reportData.acplWhite}</span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Top Engine Agreement:</span>
              <span className="font-mono font-bold text-indigo-400">{reportData.topEngineAgreementWhite}%</span>
            </div>
          </div>
        </div>

        {/* Black Player Stats */}
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-900 border border-gray-600" />
              {match.blackPlayerName} (Black)
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Accuracy Score:</span>
                <span className="font-bold text-white">{reportData.accuracyBlack}%</span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, reportData.accuracyBlack)}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Average Centipawn Loss (ACPL):</span>
              <span className="font-mono font-bold text-white">{reportData.acplBlack}</span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Top Engine Agreement:</span>
              <span className="font-mono font-bold text-purple-400">{reportData.topEngineAgreementBlack}%</span>
            </div>
          </div>
        </div>

        {/* Arbiter Adjudication Card */}
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Surveillance Verdict</span>
            </span>
            <div className="text-sm font-semibold text-white mb-2">
              Status: {reportData.status.replace(/_/g, ' ')}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {reportData.reviewNotes || 'No specific fair-play signals flagged.'}
            </p>
          </div>
          {reportData.reviewedBy && (
            <div className="mt-4 pt-3 border-t border-gray-800 text-[11px] text-gray-500">
              Last reviewed by {reportData.reviewedBy} on {new Date(reportData.reviewedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Move Table & Telemetry Timeline & Decision Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Move-by-Move Engine Evaluation Table */}
        <div className="lg:col-span-8 bg-[#141824] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-[#191e2c] border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Move-By-Move Engine Evaluation</span>
            </h3>
            <span className="text-xs text-gray-400">{moveAnalyses.length} moves analyzed</span>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121520] text-gray-400 uppercase tracking-wider sticky top-0 z-10 border-b border-gray-800">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Color</th>
                  <th className="py-2.5 px-3">Played Move</th>
                  <th className="py-2.5 px-3">Stockfish Eval</th>
                  <th className="py-2.5 px-3">Best Alternative</th>
                  <th className="py-2.5 px-3">Centipawn Loss (CPL)</th>
                  <th className="py-2.5 px-3 text-right">Time Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300 font-mono">
                {moveAnalyses.map((m, idx) => {
                  const isMatch = m.isEngineMatch;
                  const isHighLoss = m.centipawnLoss > 80;
                  const isBlunder = m.centipawnLoss > 200;
                  const classification = m.classification || (isMatch || m.centipawnLoss <= 5 ? 'BEST' : m.centipawnLoss <= 30 ? 'GOOD' : m.centipawnLoss <= 90 ? 'INACCURACY' : m.centipawnLoss <= 200 ? 'MISTAKE' : 'BLUNDER');

                  return (
                    <tr key={idx} className="hover:bg-[#191f2e] transition-colors">
                      <td className="py-2 px-3 text-gray-500">{m.moveNumber}</td>
                      <td className="py-2 px-3 capitalize">
                        {m.color === 'w' ? (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-white inline-block" /> White
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-900 border border-gray-600 inline-block" /> Black
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-white mr-2">{m.san}</span>
                        {classification === 'BEST' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">★ Best</span>
                        )}
                        {classification === 'EXCELLENT' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">✓ Excellent</span>
                        )}
                        {classification === 'GOOD' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Good</span>
                        )}
                        {classification === 'INACCURACY' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">?! Inaccuracy</span>
                        )}
                        {classification === 'MISTAKE' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">? Mistake</span>
                        )}
                        {classification === 'BLUNDER' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">?? Blunder</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">
                        <span className="text-indigo-300">
                          {m.evalAfter !== undefined ? (m.evalAfter > 0 ? `+${(m.evalAfter / 100).toFixed(1)}` : (m.evalAfter / 100).toFixed(1)) : '-'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-indigo-300 font-mono">
                        <span>{m.bestMoveSan}</span>
                        {m.pv && m.pv.length > 1 && (
                          <span className="text-[10px] text-gray-500 block truncate max-w-[120px]">
                            {m.pv.slice(1, 3).join(' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-semibold ${
                            isBlunder ? 'text-red-400 font-bold' : isHighLoss ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {m.centipawnLoss}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-400">
                        {m.timeSpentMs ? `${(m.timeSpentMs / 1000).toFixed(1)}s` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Arbiter Action & Review Form */}
        <div className="lg:col-span-4 space-y-6">
          {/* Decision Panel */}
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Arbiter Adjudication Decision</span>
            </h3>

            <form onSubmit={handleSaveDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Fair-Play Classification
                </label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="CLEAN">Clean / No Anomaly Detected</option>
                  <option value="SUSPICIOUS">Suspicious / Flagged for Watchlist</option>
                  <option value="NEEDS_REVIEW">Needs Review / Evidence of Fair-Play Concern</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Overturn / Award Match Result (Optional)
                </label>
                <select
                  value={overturnResult}
                  onChange={(e) => setOverturnResult(e.target.value)}
                  className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Keep Existing Result ({match.result || '*'})</option>
                  <option value="1-0">Overturn & Award Win to White (1-0)</option>
                  <option value="0-1">Overturn & Award Win to Black (0-1)</option>
                  <option value="1/2-1/2">Overturn & Declare Draw (1/2-1/2)</option>
                  <option value="*">Nullify / Abort Game (*)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Arbiter Review Notes
                </label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Record justification, observed focus loss patterns, or engine agreement analysis..."
                  className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving Verdict...' : 'Save Arbiter Decision'}</span>
              </button>
            </form>
          </div>

          {/* Telemetry Events Log */}
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>Session Telemetry Events ({match.fairPlayEvents?.length || 0})</span>
            </h3>

            <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-thin text-xs">
              {!match.fairPlayEvents || match.fairPlayEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-500 italic">No telemetry events logged</div>
              ) : (
                match.fairPlayEvents.map((evt: any) => (
                  <div
                    key={evt.id}
                    className="p-2 rounded-lg bg-[#191e2c] border border-gray-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-gray-300">{evt.eventType.replace(/_/g, ' ')}</span>
                      {evt.color && (
                        <span className="text-[10px] text-gray-500 ml-1">
                          ({evt.color === 'w' ? 'White' : 'Black'})
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-gray-500">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}