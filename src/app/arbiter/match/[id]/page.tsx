'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import io, { Socket } from 'socket.io-client';
import { Chessboard } from '@/components/Chessboard';
import { ChessClock } from '@/components/ChessClock';
import { MoveHistory } from '@/components/MoveHistory';
import { EvaluationBar, EvaluationData } from '@/components/EvaluationBar';
import {
  ShieldAlert, Play, Pause, Award, Handshake, XCircle, Download,
  Copy, Check, RefreshCw, Eye, AlertTriangle, ShieldCheck, ChevronLeft, Lock, Cpu,
  Share2, MessageCircle, Mail, Send
} from 'lucide-react';
import { ShareMatchLinksModal } from '@/components/ShareMatchLinksModal';

export default function ArbiterMatchMonitorPage() {
  const params = useParams();
  const matchId = params?.id as string;
  const router = useRouter();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [fairPlayEvents, setFairPlayEvents] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Fetch match details & invitations
  const fetchMatchDetails = async () => {
    try {
      const [matchRes, inviteRes] = await Promise.all([
        fetch(`/api/matches/${matchId}`),
        fetch(`/api/matches/${matchId}/invitations`),
      ]);

      const mData = await matchRes.json();
      const iData = await inviteRes.json();

      if (mData.match) {
        setMatchData(mData.match);
        if (mData.match.fairPlayEvents) {
          setFairPlayEvents(mData.match.fairPlayEvents);
        }
      }
      if (iData.invitations) setInvitations(iData.invitations);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMatchDetails();

    const newSocket = io({
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('match:join', {
        matchId,
        role: 'arbiter',
      });
    });

    newSocket.on('match:state', (state) => {
      setGameState(state);
    });

    newSocket.on('match:move', (data) => {
      setGameState(data.state);
    });

    newSocket.on('match:fair-play-event', (event) => {
      setFairPlayEvents((prev) => [event, ...prev]);
    });

    newSocket.on('match:connection-status', ({ color, connected }) => {
      setGameState((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          whiteConnected: color === 'white' ? connected : prev.whiteConnected,
          blackConnected: color === 'black' ? connected : prev.blackConnected,
        };
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [matchId]);

  const handleArbiterAction = async (action: 'PAUSE' | 'RESUME' | 'AWARD_WHITE' | 'AWARD_BLACK' | 'AWARD_DRAW' | 'ABORT') => {
    if (!socket) return;
    if (!confirm(`Are you sure you want to execute arbiter action: ${action.replace('_', ' ')}?`)) return;

    setActionLoading(true);
    socket.emit('match:arbiter-action', {
      matchId,
      action,
    });
    setTimeout(() => setActionLoading(false), 500);
  };

  const handleRegenerateInvite = async (color: 'white' | 'black') => {
    if (!confirm(`Revoke current active ${color} link and generate a new secure link?`)) return;
    try {
      const res = await fetch(`/api/matches/${matchId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchMatchDetails();
      alert(`New ${color} invitation generated:\n${data.url}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const currentFen = gameState?.fen || matchData?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Real-time Stockfish evaluation effect for Arbiter surveillance
  useEffect(() => {
    if (!currentFen) return;
    let active = true;
    setEvalLoading(true);

    const timer = setTimeout(() => {
      fetch('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate', fen: currentFen, depth: 8 }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (active && data.evaluation) {
            setEvaluation(data.evaluation);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (active) setEvalLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentFen]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/arbiter"
            className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">Live Arbiter Monitor</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase">
                {gameState?.status || matchData?.status || 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {matchData?.tournament?.name || 'Championship Match'} &bull; Time Control: {matchData?.timeControl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/arbiter/review/${matchId}`}
            className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Fair-Play Engine Review</span>
          </Link>

          <a
            href={`/api/matches/${matchId}/pgn`}
            download
            className="px-3.5 py-2 rounded-xl bg-[#1f2638] hover:bg-[#28324a] text-gray-300 hover:text-white border border-gray-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export PGN</span>
          </a>
        </div>
      </div>

      {/* Main Arbiter Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Mirrored Board, Clocks & Stockfish Eval Bar */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[580px] space-y-3">
            {/* Black Clock */}
            <ChessClock
              timeRemainingMs={gameState?.blackTimeRemainingMs ?? matchData?.blackTimeRemainingMs ?? 600000}
              isActive={gameState?.turn === 'b' && gameState?.status === 'ACTIVE'}
              isPaused={gameState?.isPaused || false}
              playerName={gameState?.blackPlayerName || matchData?.blackPlayerName || 'Black Player'}
              color="black"
              connected={gameState?.blackConnected}
            />

            {/* Live Board with Stockfish Evaluation Bar */}
            <div className="flex items-center justify-center gap-3 w-full">
              <EvaluationBar
                evaluation={evaluation}
                orientation="white"
                isThinking={evalLoading}
              />
              <div className="flex-1 max-w-[500px]">
                <Chessboard
                  fen={currentFen}
                  orientation="white"
                  disabled={true}
                  isCheck={gameState?.isCheck}
                  turn={gameState?.turn}
                />
              </div>
            </div>

            {/* White Clock */}
            <ChessClock
              timeRemainingMs={gameState?.whiteTimeRemainingMs ?? matchData?.whiteTimeRemainingMs ?? 600000}
              isActive={gameState?.turn === 'w' && gameState?.status === 'ACTIVE'}
              isPaused={gameState?.isPaused || false}
              playerName={gameState?.whitePlayerName || matchData?.whitePlayerName || 'White Player'}
              color="white"
              connected={gameState?.whiteConnected}
            />

            {/* Stockfish Engine Telemetry Banner */}
            {evaluation && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#141824] border border-indigo-500/20 text-xs shadow-lg">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span className="text-gray-400 font-medium">Stockfish Engine:</span>
                  <span className="font-mono font-bold text-indigo-300">{evaluation.displayScore}</span>
                  <span className="text-[11px] text-gray-500 font-mono">(depth {evaluation.depth})</span>
                </div>
                {evaluation.bestMove && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Suggested Line:</span>
                    <span className="font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                      {evaluation.bestMove} {evaluation.pv ? evaluation.pv.slice(1, 3).join(' ') : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Arbiter Command Palette */}
            <div className="bg-[#141824] border border-gray-800 rounded-2xl p-4 mt-4 shadow-xl">
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400 block mb-3">
                Authoritative Arbiter Controls
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {gameState?.isPaused ? (
                  <button
                    onClick={() => handleArbiterAction('RESUME')}
                    disabled={actionLoading}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Game</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleArbiterAction('PAUSE')}
                    disabled={actionLoading || gameState?.status !== 'ACTIVE'}
                    className="py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Clocks</span>
                  </button>
                )}

                <button
                  onClick={() => handleArbiterAction('AWARD_WHITE')}
                  disabled={actionLoading || gameState?.status === 'FINISHED'}
                  className="py-2.5 px-3 rounded-xl bg-[#1e2332] hover:bg-indigo-600/30 text-gray-200 border border-gray-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Award White (1-0)</span>
                </button>

                <button
                  onClick={() => handleArbiterAction('AWARD_BLACK')}
                  disabled={actionLoading || gameState?.status === 'FINISHED'}
                  className="py-2.5 px-3 rounded-xl bg-[#1e2332] hover:bg-indigo-600/30 text-gray-200 border border-gray-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Award Black (0-1)</span>
                </button>

                <button
                  onClick={() => handleArbiterAction('AWARD_DRAW')}
                  disabled={actionLoading || gameState?.status === 'FINISHED'}
                  className="py-2.5 px-3 rounded-xl bg-[#1e2332] hover:bg-indigo-600/30 text-gray-200 border border-gray-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Handshake className="w-3.5 h-3.5 text-amber-400" />
                  <span>Declare Draw</span>
                </button>

                <button
                  onClick={() => handleArbiterAction('ABORT')}
                  disabled={actionLoading || gameState?.status === 'FINISHED'}
                  className="py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 col-span-2 sm:col-span-2 disabled:opacity-40"
                >
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>Abort / Terminate Match</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Telemetry & Moves & Invitations */}
        <div className="lg:col-span-5 space-y-4">
          {/* Invitation Links Card */}
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-400 block">
                Seat Invitation Access
              </span>
              <button
                onClick={() => setShowShareModal(true)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3 h-3 text-indigo-400" />
                <span>Send & Share Links</span>
              </button>
            </div>

            <div className="space-y-3">
              {invitations.map((inv) => {
                const inviteUrl = inv.rawToken ? `${baseUrl}/join/${inv.rawToken}` : '';
                const playerName = inv.color === 'white'
                  ? (gameState?.whitePlayerName || matchData?.whitePlayerName || 'White Player')
                  : (gameState?.blackPlayerName || matchData?.blackPlayerName || 'Black Player');
                const opponentName = inv.color === 'white'
                  ? (gameState?.blackPlayerName || matchData?.blackPlayerName || 'Black Player')
                  : (gameState?.whitePlayerName || matchData?.whitePlayerName || 'White Player');
                const waMessage = `♟️ ChessArena Invitation: Hello ${playerName}, your ${inv.color.toUpperCase()} seat link vs ${opponentName} is:\n${inviteUrl}`;

                return (
                  <div key={inv.id} className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white capitalize flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            inv.color === 'white' ? 'bg-white' : 'bg-gray-900 border border-gray-600'
                          }`}
                        />
                        <span>{inv.color} Seat: {playerName}</span>
                        {inv.claimedBy && (
                          <span className="text-[10px] text-emerald-400 font-normal">({inv.claimedBy})</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRegenerateInvite(inv.color)}
                          className="p-1 rounded hover:bg-gray-700 text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                          title="Revoke & Regenerate"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span className="text-[10px]">Regenerate</span>
                        </button>
                      </div>
                    </div>

                    {inviteUrl ? (
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={inviteUrl}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 bg-[#10131d] border border-gray-700/80 rounded-lg px-2.5 py-1 text-[11px] text-gray-300 font-mono select-all focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={() => copyText(inviteUrl, inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm flex-shrink-0"
                            title="Copy invitation URL"
                          >
                            {copiedLink === inv.id ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedLink === inv.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            onClick={() => {
                              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`, '_blank');
                            }}
                            className="px-2 py-1 rounded-md bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 text-[10px] font-semibold transition-colors flex items-center gap-1"
                          >
                            <MessageCircle className="w-2.5 h-2.5" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => {
                              window.location.href = `mailto:?subject=${encodeURIComponent(`ChessArena Match: ${inv.color.toUpperCase()} Seat Link`)}&body=${encodeURIComponent(waMessage)}`;
                            }}
                            className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 text-[10px] font-semibold transition-colors flex items-center gap-1"
                          >
                            <Mail className="w-2.5 h-2.5" />
                            <span>Email</span>
                          </button>

                          <span className="text-[10px] text-gray-500 ml-auto">
                            {inv.revokedAt ? 'Revoked' : inv.claimedBy ? 'Active' : 'Unclaimed'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 mt-1">
                        Status: {inv.revokedAt ? 'Revoked' : inv.claimedBy ? 'Claimed & Active' : 'Available'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Fair-Play Event Stream */}
          <div className="bg-[#141824] border border-gray-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Live Fair-Play Telemetry</span>
              </span>
              <span className="text-[10px] text-gray-400">{fairPlayEvents.length} events logged</span>
            </div>

            <div className="h-44 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 text-xs">
              {fairPlayEvents.length === 0 ? (
                <div className="text-center py-6 text-gray-500 italic">No suspicious events registered</div>
              ) : (
                fairPlayEvents.map((evt, idx) => {
                  const isFocusLost = evt.eventType === 'FOCUS_LOST' || evt.eventType === 'TAB_HIDDEN';
                  const timeStr = new Date(evt.timestamp).toLocaleTimeString();

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border flex items-center justify-between ${
                        isFocusLost
                          ? 'bg-red-950/30 border-red-900/40 text-red-300'
                          : 'bg-[#1a1f2e] border-gray-800 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isFocusLost ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'
                          }`}
                        />
                        <span className="font-semibold">{evt.eventType.replace(/_/g, ' ')}</span>
                        {evt.color && (
                          <span className="text-[10px] text-gray-400 capitalize">({evt.color === 'w' ? 'White' : 'Black'})</span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-gray-500">{timeStr}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Move History */}
          <div className="h-64">
            <MoveHistory
              history={gameState?.history || []}
              matchId={matchId}
              result={gameState?.result || matchData?.result}
              resultReason={gameState?.resultReason || matchData?.resultReason}
            />
          </div>
        </div>
      </div>

      {/* Share Match Links Modal */}
      <ShareMatchLinksModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        matchId={matchId}
        matchSummary={{
          whitePlayerName: gameState?.whitePlayerName || matchData?.whitePlayerName,
          blackPlayerName: gameState?.blackPlayerName || matchData?.blackPlayerName,
          tournamentName: matchData?.tournament?.name || 'Championship Match',
          timeControl: matchData?.timeControl,
        }}
      />
    </div>
  );
}