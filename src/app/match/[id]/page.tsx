'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { Chess } from 'chess.js';
import { Chessboard } from '@/components/Chessboard';
import { ChessClock } from '@/components/ChessClock';
import { MoveHistory } from '@/components/MoveHistory';
import { ChessPiece } from '@/components/ChessPieces';
import { sounds } from '@/lib/sounds';
import { Flag, Handshake, AlertTriangle, ShieldCheck, Download, Share2, Check, RefreshCw } from 'lucide-react';

export default function MatchArenaPage() {
  const params = useParams();
  const matchId = params?.id as string;
  const router = useRouter();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [viewerRole, setViewerRole] = useState<'white' | 'black' | 'arbiter' | 'admin' | 'spectator'>('spectator');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showResignModal, setShowResignModal] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [gameOverModal, setGameOverModal] = useState<any>(null);

  // Initialize socket connection and telemetry
  useEffect(() => {
    if (!matchId) return;

    // Fetch match metadata and determine role
    fetch(`/api/matches/${matchId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.match) {
          setMatchData(data.match);
          if (data.viewerRole) setViewerRole(data.viewerRole);
          if (data.assignedPlayerToken) {
            try {
              localStorage.setItem(`match_token_${matchId}`, data.assignedPlayerToken);
            } catch (e) {}
            newSocket.emit('match:join', {
              matchId,
              token: data.assignedPlayerToken,
            });
          }
        }
      })
      .catch(console.error);

    const newSocket = io({
      transports: ['websocket', 'polling'],
    });

    setSocket(newSocket);

    // Retrieve local token if stored
    const localToken = localStorage.getItem(`match_token_${matchId}`);

    newSocket.on('connect', () => {
      newSocket.emit('match:join', {
        matchId,
        token: localToken,
      });
    });

    newSocket.on('match:joined', (info) => {
      if (info.color) {
        setViewerRole(info.color);
      } else if (info.role === 'arbiter') {
        setViewerRole('arbiter');
      }
    });

    newSocket.on('match:state', (state) => {
      setGameState(state);
      if (state.drawOfferedBy) {
        const myColor = viewerRole === 'white' ? 'w' : viewerRole === 'black' ? 'b' : null;
        if (myColor && state.drawOfferedBy !== myColor) {
          setDrawOfferReceived(true);
        }
      } else {
        setDrawOfferReceived(false);
        setDrawOfferSent(false);
      }

      if (state.status === 'FINISHED' && state.result) {
        setGameOverModal({
          result: state.result,
          resultReason: state.resultReason,
        });
      }
    });

    newSocket.on('match:move', (data) => {
      setGameState(data.state);
      if (data.state.isCheck) {
        sounds.playCheck();
      }
    });

    newSocket.on('match:finish', (data) => {
      sounds.playGameOver();
      setGameOverModal(data);
    });

    newSocket.on('match:draw-offer', (data) => {
      const myColorName = viewerRole;
      if (data.color !== myColorName) {
        setDrawOfferReceived(true);
      }
    });

    newSocket.on('match:draw-decline', () => {
      setDrawOfferSent(false);
      setErrorMsg('Draw offer was declined');
      setTimeout(() => setErrorMsg(null), 3000);
    });

    newSocket.on('match:error', (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 4000);
    });

    // Telemetry Event Listeners
    const handleVisibilityChange = () => {
      if (document.hidden) {
        newSocket.emit('match:fair-play-event', {
          matchId,
          eventType: 'TAB_HIDDEN',
          metadata: { timestamp: new Date().toISOString() },
        });
      } else {
        newSocket.emit('match:fair-play-event', {
          matchId,
          eventType: 'TAB_VISIBLE',
          metadata: { timestamp: new Date().toISOString() },
        });
      }
    };

    const handleBlur = () => {
      newSocket.emit('match:fair-play-event', {
        matchId,
        eventType: 'FOCUS_LOST',
        metadata: { timestamp: new Date().toISOString() },
      });
    };

    const handleFocus = () => {
      newSocket.emit('match:fair-play-event', {
        matchId,
        eventType: 'FOCUS_GAINED',
        metadata: { timestamp: new Date().toISOString() },
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      newSocket.disconnect();
    };
  }, [matchId, viewerRole]);

  // Handle player making a move on the board
  const handleMove = (from: string, to: string, promotion?: string) => {
    if (!socket || !gameState) return;
    if (gameState.status !== 'ACTIVE' && gameState.status !== 'PENDING') return;

    socket.emit('match:move', {
      matchId,
      from,
      to,
      promotion: promotion || 'q',
    });
  };

  const handleResign = () => {
    if (!socket) return;
    socket.emit('match:resign', { matchId });
    setShowResignModal(false);
  };

  const handleOfferDraw = () => {
    if (!socket) return;
    socket.emit('match:draw-offer', { matchId });
    setDrawOfferSent(true);
  };

  const handleAcceptDraw = () => {
    if (!socket) return;
    socket.emit('match:draw-accept', { matchId });
    setDrawOfferReceived(false);
  };

  const handleDeclineDraw = () => {
    if (!socket) return;
    socket.emit('match:draw-decline', { matchId });
    setDrawOfferReceived(false);
  };

  // Compute captured pieces from current FEN
  const capturedPieces = useMemo(() => {
    if (!gameState?.fen) return { white: [], black: [] };
    const startingPieces: Record<string, number> = {
      p: 8, n: 2, b: 2, r: 2, q: 1,
      P: 8, N: 2, B: 2, R: 2, Q: 1,
    };

    const fenPlacement = gameState.fen.split(' ')[0];
    const currentCounts: Record<string, number> = {};

    for (const char of fenPlacement) {
      if (startingPieces[char]) {
        currentCounts[char] = (currentCounts[char] || 0) + 1;
      }
    }

    const whiteCaptured: string[] = []; // Black pieces captured by White
    const blackCaptured: string[] = []; // White pieces captured by Black

    ['p', 'n', 'b', 'r', 'q'].forEach((p) => {
      const missing = startingPieces[p] - (currentCounts[p] || 0);
      for (let i = 0; i < missing; i++) whiteCaptured.push(p);
    });

    ['P', 'N', 'B', 'R', 'Q'].forEach((p) => {
      const missing = startingPieces[p] - (currentCounts[p] || 0);
      for (let i = 0; i < missing; i++) blackCaptured.push(p.toLowerCase());
    });

    return { white: whiteCaptured, black: blackCaptured };
  }, [gameState?.fen]);

  if (!gameState && !matchData) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading arena board & clocks...</p>
        </div>
      </div>
    );
  }

  const currentFen = gameState?.fen || matchData?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const isPlayer = viewerRole === 'white' || viewerRole === 'black';
  const boardOrientation = viewerRole === 'black' ? 'black' : 'white';
  const isMyTurn = isPlayer && gameState?.turn === (viewerRole === 'white' ? 'w' : 'b');

  const topColor = boardOrientation === 'white' ? 'black' : 'white';
  const bottomColor = boardOrientation === 'white' ? 'white' : 'black';

  const topName = topColor === 'white' ? (gameState?.whitePlayerName || matchData?.whitePlayerName) : (gameState?.blackPlayerName || matchData?.blackPlayerName);
  const bottomName = bottomColor === 'white' ? (gameState?.whitePlayerName || matchData?.whitePlayerName) : (gameState?.blackPlayerName || matchData?.blackPlayerName);

  const topTime = topColor === 'white' ? gameState?.whiteTimeRemainingMs : gameState?.blackTimeRemainingMs;
  const bottomTime = bottomColor === 'white' ? gameState?.whiteTimeRemainingMs : gameState?.blackTimeRemainingMs;

  const topActive = gameState?.turn === (topColor === 'white' ? 'w' : 'b') && gameState?.status === 'ACTIVE';
  const bottomActive = gameState?.turn === (bottomColor === 'white' ? 'w' : 'b') && gameState?.status === 'ACTIVE';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Alert toast if any */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-sm flex items-center gap-2 max-w-xl mx-auto animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Arena Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Board & Clocks */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="w-full max-w-[560px] space-y-3">
            {/* Top Opponent Clock */}
            <ChessClock
              timeRemainingMs={topTime ?? 600000}
              isActive={topActive}
              isPaused={gameState?.isPaused || false}
              playerName={topName || 'Opponent'}
              color={topColor}
              connected={topColor === 'white' ? gameState?.whiteConnected : gameState?.blackConnected}
            />

            {/* Top Captured Pieces */}
            <div className="flex items-center gap-1 h-5 px-1">
              {(topColor === 'white' ? capturedPieces.white : capturedPieces.black).map((p, i) => (
                <div key={i} className="w-4 h-4">
                  <ChessPiece type={p} color={topColor === 'white' ? 'b' : 'w'} />
                </div>
              ))}
            </div>

            {/* Main Interactive Chessboard */}
            <Chessboard
              fen={currentFen}
              orientation={boardOrientation}
              playerColor={isPlayer ? viewerRole : null}
              disabled={gameState?.status === 'FINISHED' || gameState?.isPaused || !isMyTurn}
              isCheck={gameState?.isCheck}
              turn={gameState?.turn}
              onMove={handleMove}
            />

            {/* Bottom Captured Pieces */}
            <div className="flex items-center gap-1 h-5 px-1">
              {(bottomColor === 'white' ? capturedPieces.white : capturedPieces.black).map((p, i) => (
                <div key={i} className="w-4 h-4">
                  <ChessPiece type={p} color={bottomColor === 'white' ? 'b' : 'w'} />
                </div>
              ))}
            </div>

            {/* Bottom Player Clock */}
            <ChessClock
              timeRemainingMs={bottomTime ?? 600000}
              isActive={bottomActive}
              isPaused={gameState?.isPaused || false}
              playerName={bottomName || 'You'}
              color={bottomColor}
              connected={bottomColor === 'white' ? gameState?.whiteConnected : gameState?.blackConnected}
            />

            {/* Player Controls Strip */}
            {isPlayer && gameState?.status === 'ACTIVE' && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setShowResignModal(true)}
                  className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-400 hover:text-red-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Resign Game</span>
                </button>

                <button
                  onClick={handleOfferDraw}
                  disabled={drawOfferSent}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    drawOfferSent
                      ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-[#1f2638] hover:bg-[#28324a] border-gray-700 text-gray-300 hover:text-white'
                  }`}
                >
                  <Handshake className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{drawOfferSent ? 'Draw Offered...' : 'Offer Draw'}</span>
                </button>
              </div>
            )}

            {!isPlayer && (
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-center text-xs text-indigo-300">
                Spectator Mode — Moves are synchronized live with authoritative server clock.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Move Ledger & Match Details */}
        <div className="lg:col-span-4 space-y-4">
          {/* Match Info Header */}
          <div className="bg-[#141824] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span className="font-semibold text-gray-300">Match Arena</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                {matchData?.timeControl || '10+5'}
              </span>
            </div>
            <div className="text-sm font-bold text-white">
              {matchData?.tournament?.name || 'Tournament Championship'}
            </div>
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
              <span>Status:</span>
              <span
                className={`font-semibold uppercase text-[11px] ${
                  gameState?.status === 'ACTIVE'
                    ? 'text-emerald-400'
                    : gameState?.status === 'PAUSED'
                    ? 'text-amber-400'
                    : 'text-gray-400'
                }`}
              >
                {gameState?.status || matchData?.status}
              </span>
            </div>
          </div>

          {/* Move History Component */}
          <div className="h-[460px]">
            <MoveHistory
              history={gameState?.history || []}
              matchId={matchId}
              result={gameState?.result}
              resultReason={gameState?.resultReason}
            />
          </div>

          {/* Fair Play Notice */}
          <div className="p-3 rounded-xl bg-[#11141e] border border-gray-800 text-[11px] text-gray-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              Server-authoritative game session. Tab switches and focus loss are logged. Post-game analysis runs Stockfish fair-play telemetry.
            </span>
          </div>
        </div>
      </div>

      {/* Resignation Confirmation Modal */}
      {showResignModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171b26] border border-red-900/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-red-950 text-red-400 flex items-center justify-center mx-auto mb-3">
              <Flag className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Confirm Resignation</h3>
            <p className="text-xs text-gray-400 mb-6">
              Are you sure you want to resign? The victory will immediately be awarded to your opponent.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowResignModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResign}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-600/20 transition-colors"
              >
                Yes, Resign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draw Offer Modal */}
      {drawOfferReceived && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171b26] border border-indigo-900/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Handshake className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Draw Offered</h3>
            <p className="text-xs text-gray-400 mb-6">
              Your opponent has offered a draw. Would you like to accept?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeclineDraw}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptDraw}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition-colors"
              >
                Accept Draw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOverModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141824] border border-gray-700 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-400">Match Concluded</span>
            <h2 className="text-3xl font-black text-white mt-1">{gameOverModal.result}</h2>
            <p className="text-sm font-semibold text-gray-300 uppercase tracking-wide mt-1">
              {(gameOverModal.resultReason || 'GAME_OVER').replace(/_/g, ' ')}
            </p>

            <div className="mt-6 p-4 rounded-xl bg-[#1c2232] border border-gray-800 text-xs text-gray-400 space-y-2 text-left">
              <div className="flex justify-between">
                <span>White:</span>
                <span className="font-semibold text-white">{gameState?.whitePlayerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Black:</span>
                <span className="font-semibold text-white">{gameState?.blackPlayerName}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <a
                href={`/arbiter/review/${matchId}`}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Open Fair-Play Engine Review</span>
              </a>
              <button
                onClick={() => setGameOverModal(null)}
                className="w-full py-2.5 rounded-xl bg-[#1f2638] hover:bg-[#28324a] text-gray-300 text-xs font-semibold transition-colors"
              >
                Inspect Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}