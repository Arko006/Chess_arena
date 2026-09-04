'use client';

import React, { useEffect, useState } from 'react';
import {
  X, Copy, Check, Share2, RefreshCw, Send, Mail, Swords,
  AlertCircle, ExternalLink, ShieldCheck, Sparkles, MessageCircle
} from 'lucide-react';

interface ShareMatchLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  matchSummary?: {
    whitePlayerName?: string;
    blackPlayerName?: string;
    tournamentName?: string;
    roundNumber?: number;
    timeControl?: string;
  };
}

export function ShareMatchLinksModal({
  isOpen,
  onClose,
  matchId,
  matchSummary,
}: ShareMatchLinksModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [regeneratingColor, setRegeneratingColor] = useState<'white' | 'black' | null>(null);

  const fetchInvitations = async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/invitations`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch match invitations');
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && matchId) {
      fetchInvitations();
    } else {
      setData(null);
      setError(null);
      setCopiedKey(null);
    }
  }, [isOpen, matchId]);

  if (!isOpen) return null;

  // Resolve client-side origin for accurate player links
  const getFullUrl = (rawUrl?: string, rawToken?: string) => {
    if (typeof window === 'undefined') return rawUrl || '';
    const origin = window.location.origin;
    if (rawToken) return `${origin}/join/${rawToken}`;
    if (rawUrl) {
      try {
        const u = new URL(rawUrl);
        return `${origin}${u.pathname}`;
      } catch {
        return rawUrl;
      }
    }
    return '';
  };

  const whiteUrl = data?.white ? getFullUrl(data.white.url, data.white.rawToken) : '';
  const blackUrl = data?.black ? getFullUrl(data.black.url, data.black.rawToken) : '';

  const whiteName = data?.match?.whitePlayerName || matchSummary?.whitePlayerName || 'White Player';
  const blackName = data?.match?.blackPlayerName || matchSummary?.blackPlayerName || 'Black Player';
  const tournamentName = data?.match?.tournamentName || matchSummary?.tournamentName || 'Tournament';
  const timeControl = data?.match?.timeControl || matchSummary?.timeControl || 'Standard';

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      alert('Unable to copy to clipboard automatically. Please copy the link manually.');
    }
  };

  const handleRegenerate = async (color: 'white' | 'black') => {
    if (!matchId) return;
    if (!confirm(`Are you sure you want to revoke the current ${color} link and generate a new one? The old link will stop working immediately.`)) {
      return;
    }

    setRegeneratingColor(color);
    try {
      const res = await fetch(`/api/matches/${matchId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to regenerate link');
      await fetchInvitations();
      setCopiedKey(`${color}-regen`);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRegeneratingColor(null);
    }
  };

  const getCombinedAnnouncement = () => {
    return [
      `🏆 *${tournamentName}*`,
      `⚔️ *Match:* ${whiteName} (White) vs ${blackName} (Black)`,
      `⏱️ *Time Control:* ${timeControl}`,
      ``,
      `⚪ *White Player:* ${whiteName}`,
      `👉 ${whiteUrl}`,
      ``,
      ...(blackUrl ? [
        `⚫ *Black Player:* ${blackName}`,
        `👉 ${blackUrl}`,
      ] : [
        `⚫ *Black Player:* BYE (Awarded 1-0)`,
      ]),
      ``,
      `ℹ️ Click your individual seat link above to join the board and start your game.`,
    ].join('\n');
  };

  const getSinglePlayerMessage = (color: 'White' | 'Black', playerName: string, url: string) => {
    const opponent = color === 'White' ? blackName : whiteName;
    return `♟️ *ChessArena Tournament Invitation*\n\nHello ${playerName}, you are playing as *${color}* against *${opponent}* in ${tournamentName}.\n\nClick here to join your live match:\n👉 ${url}\n\nTime Control: ${timeControl}. Good luck!`;
  };

  const openWhatsApp = (text: string) => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const openEmail = (subject: string, body: string) => {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#121624] border border-gray-700/80 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl my-8 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Send Match Seat Links</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Arbiter Tool
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {whiteName} (White) vs {blackName} (Black) &bull; {tournamentName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-gray-400">Generating and loading cryptographic seat links...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <div>
              <p className="font-bold">Failed to load invitation links</p>
              <p className="text-rose-400/90 text-[11px] mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* White Player Link Card */}
            <div className="bg-[#181d2e] border border-gray-800 rounded-2xl p-4 transition-all hover:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-400 shadow-sm" />
                  <span className="font-bold text-sm text-white">{whiteName}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                    White
                  </span>
                </div>
                {data?.white?.isClaimed ? (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Claimed by {data.white.claimedBy}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Seat Unclaimed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  readOnly
                  value={whiteUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-[#10131d] border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono select-all focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => copyToClipboard(whiteUrl, 'white')}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md flex-shrink-0"
                  title="Copy White Link"
                >
                  {copiedKey === 'white' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'white' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* 1-Click White Share Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openWhatsApp(getSinglePlayerMessage('White', whiteName, whiteUrl))}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-[11px] font-semibold transition-colors flex items-center gap-1"
                    title="Send White Link via WhatsApp"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>WhatsApp White</span>
                  </button>

                  <button
                    onClick={() => openEmail(
                      `ChessArena Link: ${whiteName} (White) vs ${blackName}`,
                      getSinglePlayerMessage('White', whiteName, whiteUrl)
                    )}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 text-[11px] font-semibold transition-colors flex items-center gap-1"
                    title="Send White Link via Email"
                  >
                    <Mail className="w-3 h-3" />
                    <span>Email White</span>
                  </button>
                </div>

                <button
                  onClick={() => handleRegenerate('white')}
                  disabled={regeneratingColor === 'white'}
                  className="p-1.5 text-gray-500 hover:text-indigo-300 transition-colors text-[11px] flex items-center gap-1"
                  title="Revoke and generate a fresh White link"
                >
                  <RefreshCw className={`w-3 h-3 ${regeneratingColor === 'white' ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              </div>
            </div>

            {/* Black Player Link Card */}
            {blackName === 'BYE' || !blackUrl ? (
              <div className="bg-[#181d2e] border border-amber-500/20 rounded-2xl p-4 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
                  <span className="w-3.5 h-3.5 rounded-full bg-gray-900 border border-gray-600" />
                  <span>Black Player: BYE</span>
                </div>
                <p className="text-gray-400 text-[11px]">
                  This pairing was awarded as a Swiss Bye. White receives a full point (+1) without requiring a game link.
                </p>
              </div>
            ) : (
              <div className="bg-[#181d2e] border border-gray-800 rounded-2xl p-4 transition-all hover:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-gray-900 border border-gray-600 shadow-sm" />
                    <span className="font-bold text-sm text-white">{blackName}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                      Black
                    </span>
                  </div>
                  {data?.black?.isClaimed ? (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Claimed by {data.black.claimedBy}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Seat Unclaimed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    readOnly
                    value={blackUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 bg-[#10131d] border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono select-all focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => copyToClipboard(blackUrl, 'black')}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md flex-shrink-0"
                    title="Copy Black Link"
                  >
                    {copiedKey === 'black' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'black' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                {/* 1-Click Black Share Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openWhatsApp(getSinglePlayerMessage('Black', blackName, blackUrl))}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-[11px] font-semibold transition-colors flex items-center gap-1"
                      title="Send Black Link via WhatsApp"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>WhatsApp Black</span>
                    </button>

                    <button
                      onClick={() => openEmail(
                        `ChessArena Link: ${blackName} (Black) vs ${whiteName}`,
                        getSinglePlayerMessage('Black', blackName, blackUrl)
                      )}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 text-[11px] font-semibold transition-colors flex items-center gap-1"
                      title="Send Black Link via Email"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Email Black</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleRegenerate('black')}
                    disabled={regeneratingColor === 'black'}
                    className="p-1.5 text-gray-500 hover:text-indigo-300 transition-colors text-[11px] flex items-center gap-1"
                    title="Revoke and generate a fresh Black link"
                  >
                    <RefreshCw className={`w-3 h-3 ${regeneratingColor === 'black' ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Regenerate</span>
                  </button>
                </div>
              </div>
            )}

            {/* Combined Group / Broadcast Announcement Card */}
            <div className="bg-gradient-to-r from-indigo-950/40 via-[#161a29] to-purple-950/30 border border-indigo-500/30 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Official Pairing Announcement (Both Links)</span>
                </span>
                <span className="text-[10px] text-indigo-300 font-semibold">Group Broadcast</span>
              </div>

              <p className="text-[11px] text-gray-400 mb-3">
                Broadcast both White & Black seat links formatted with tournament and time control info to your WhatsApp tournament group or Discord channel.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => copyToClipboard(getCombinedAnnouncement(), 'both')}
                  className="flex-1 py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  {copiedKey === 'both' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{copiedKey === 'both' ? 'Announcement Copied!' : 'Copy Formatted Announcement'}</span>
                </button>

                <button
                  onClick={() => openWhatsApp(getCombinedAnnouncement())}
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Send to WhatsApp Group</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-5 border-t border-gray-800">
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cryptographically isolated tokens with active session tracking</span>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
