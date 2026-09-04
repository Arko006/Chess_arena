'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy, Clock, Users, Swords, Plus, ArrowLeft, ArrowRight,
  Eye, Check, Copy, ChevronRight, Zap, RefreshCw, UserPlus, Table, Award, Shield,
  FileText, ListPlus, Trash2, Sparkles, ExternalLink, Calendar, Share2, Send, MessageCircle
} from 'lucide-react';
import { Crosstable } from '@/components/Crosstable';
import { ShareMatchLinksModal } from '@/components/ShareMatchLinksModal';

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params?.id as string;
  const [joiningPlayer, setJoiningPlayer] = useState(false);

  const [tournament, setTournament] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [crosstable, setCrosstable] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoundNumber, setActiveRoundNumber] = useState<number>(1);
  const [activeViewTab, setActiveViewTab] = useState<'pairings' | 'standings' | 'crosstable' | 'roster'>('pairings');

  // 1-Click Automated Pairings state
  const [generatingPairings, setGeneratingPairings] = useState(false);
  const [pairingNotice, setPairingNotice] = useState<string | null>(null);

  // Manual Match creation state
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [whitePlayerName, setWhitePlayerName] = useState('');
  const [blackPlayerName, setBlackPlayerName] = useState('');
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [matchInvitations, setMatchInvitations] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Arbiter share links modal state
  const [selectedMatchForShare, setSelectedMatchForShare] = useState<any | null>(null);

  // Player registration state (Bulk, Grid, Single)
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [enrollmentMode, setEnrollmentMode] = useState<'bulk' | 'rows' | 'single'>('bulk');
  const [bulkText, setBulkText] = useState('');
  const [playerRows, setPlayerRows] = useState<{ name: string; rating: string }[]>([
    { name: '', rating: '1500' },
    { name: '', rating: '1500' },
    { name: '', rating: '1500' },
    { name: '', rating: '1500' },
  ]);
  const [singlePlayerName, setSinglePlayerName] = useState('');
  const [singlePlayerRating, setSinglePlayerRating] = useState('1500');
  const [addingPlayer, setAddingPlayer] = useState(false);

  const fetchDetails = async () => {
    try {
      const [tRes, uRes] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}`),
        fetch('/api/auth/me'),
      ]);
      const tData = await tRes.json();
      const uData = await uRes.json();
      if (tData.tournament) {
        setTournament(tData.tournament);
        setStandings(tData.standings || []);
        setCrosstable(tData.crosstable || null);
        if (tData.tournament.rounds?.length > 0) {
          // Default to latest round with matches or first round
          const latest = tData.tournament.rounds[tData.tournament.rounds.length - 1];
          setActiveRoundNumber(latest.roundNumber);
        }
      }
      if (uData.user) setCurrentUser(uData.user);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tournamentId) fetchDetails();
  }, [tournamentId]);

  // 1-Click Automated Swiss Pairing Generator
  const handleGeneratePairings = async () => {
    if (!confirm('Generate next round pairings using official Swiss pairing rules?')) return;
    setGeneratingPairings(true);
    setPairingNotice(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/pair`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate pairings');

      setPairingNotice(`Successfully generated ${data.matchCount} pairings for Round ${data.roundNumber}!`);
      setActiveRoundNumber(data.roundNumber);
      await fetchDetails();
      setTimeout(() => setPairingNotice(null), 5000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGeneratingPairings(false);
    }
  };

  const PRESETS = [
    {
      label: 'Elite Candidates (8)',
      data: `Magnus Carlsen, 2882\nHikaru Nakamura, 2875\nAlireza Firouzja, 2805\nFabiano Caruana, 2800\nGukesh D, 2794\nArjun Erigaisi, 2797\nNodirbek Abdusattorov, 2783\nIan Nepomniachtchi, 2770`,
    },
    {
      label: 'Rising Stars (6)',
      data: `Praggnanandhaa R, 2767\nVincent Keymer, 2738\nWei Yi, 2762\nVidit Gujrathi, 2726\nAnish Giri, 2745\nLevon Aronian, 2730`,
    },
    {
      label: 'Club Open (8)',
      data: `Alex Mercer, 1850\nSarah Jenkins, 1790\nDavid Chen, 1920\nElena Rostova, 1680\nMarcus Vance, 1750\nPriya Sharma, 1810\nLucas Moreau, 1640\nKenji Sato, 1890`,
    },
  ];

  const parseBulkText = (text: string) => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, idx) => {
        const parts = line.includes(',')
          ? line.split(',')
          : line.includes('\t')
          ? line.split('\t')
          : [line];
        const name = parts[0]?.trim();
        const rating = parts[1] ? parseInt(parts[1].trim(), 10) : 1500;
        return { name, rating: isNaN(rating) ? 1500 : rating, seed: idx + 1 };
      })
      .filter((p) => p.name && p.name.length > 0);
  };

  // Add / Batch Enroll Competitors
  const handleEnrollPlayers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let playersToEnroll: { name: string; rating: number; seed?: number }[] = [];

    if (enrollmentMode === 'bulk') {
      playersToEnroll = parseBulkText(bulkText);
    } else if (enrollmentMode === 'rows') {
      playersToEnroll = playerRows
        .filter((r) => r.name.trim().length > 0)
        .map((r, idx) => ({
          name: r.name.trim(),
          rating: parseInt(r.rating, 10) || 1500,
          seed: idx + 1,
        }));
    } else {
      if (singlePlayerName.trim()) {
        playersToEnroll = [
          {
            name: singlePlayerName.trim(),
            rating: parseInt(singlePlayerRating, 10) || 1500,
          },
        ];
      }
    }

    if (playersToEnroll.length === 0) {
      alert('Please enter at least one valid player name.');
      return;
    }

    setAddingPlayer(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: playersToEnroll }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enroll players');

      setPairingNotice(`Successfully enrolled ${data.count || playersToEnroll.length} competitor(s)!`);
      setShowPlayerModal(false);
      setBulkText('');
      setSinglePlayerName('');
      setPlayerRows([
        { name: '', rating: '1500' },
        { name: '', rating: '1500' },
        { name: '', rating: '1500' },
        { name: '', rating: '1500' },
      ]);
      await fetchDetails();
      setTimeout(() => setPairingNotice(null), 5000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleDeletePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Are you sure you want to remove "${playerName}" from this tournament?`)) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/players`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove player');
      await fetchDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMatch(true);

    try {
      const activeRound = tournament?.rounds?.find((r: any) => r.roundNumber === activeRoundNumber);
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          roundId: activeRound?.id || null,
          whitePlayerName: whitePlayerName.trim() || 'White Player',
          blackPlayerName: blackPlayerName.trim() || 'Black Player',
          timeControl: tournament.timeControl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create match');

      setMatchInvitations(data.invitations);
      fetchDetails();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingMatch(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Tournament Not Found</h2>
        <Link href="/tournaments" className="text-indigo-400 text-xs hover:underline">
          Return to Tournaments
        </Link>
      </div>
    );
  }

  const isCreator = currentUser && tournament?.createdById === currentUser.id;
  const isArbiter = isCreator || currentUser?.role === 'ARBITER' || currentUser?.role === 'ADMIN';
  const registeredPlayer = tournament?.players?.find(
    (p: any) => currentUser?.name && p.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
  );
  const isRegisteredPlayer = !!registeredPlayer;

  const handleJoinAsPlayer = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setJoiningPlayer(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinSelf: true, name: currentUser.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join tournament');
      await fetchDetails();
      setPairingNotice(`You have successfully registered as a player in this tournament!`);
      setTimeout(() => setPairingNotice(null), 5000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setJoiningPlayer(false);
    }
  };

  const activeRound = tournament.rounds?.find((r: any) => r.roundNumber === activeRoundNumber);
  const roundMatches = activeRound?.matches || [];
  const playersCount = tournament.players?.length || standings.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/tournaments"
            className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                {tournament.format || 'SWISS'} Tournament
              </span>
              {isCreator && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  👑 You Created This Event
                </span>
              )}
              {isRegisteredPlayer && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ⚔️ Playing as {currentUser?.name}
                </span>
              )}
              <span className="text-xs text-gray-500">&bull;</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {tournament.timeControl}
              </span>
              <span className="text-xs text-gray-500">&bull;</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> {playersCount} Competitors
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">{tournament.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{tournament.description}</p>
          </div>
        </div>

        {/* Navigation & Arbiter Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/schedule?tournamentId=${tournament.id}`}
            className="px-3 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
            title="View complete match schedule and round pairings"
          >
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Schedule</span>
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
            title="View player scorecards and match performance"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Scorecard</span>
          </Link>

          {/* Arbiter Controls (Available to creators, arbiters, and admins) */}
          {isArbiter && (
            <>
              <button
                onClick={() => setShowPlayerModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Add / Import Players</span>
              </button>

              <button
                onClick={handleGeneratePairings}
                disabled={generatingPairings}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{generatingPairings ? 'Generating Pairings...' : 'Generate Next Round Pairings'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Player Self-Registration Banner */}
      {currentUser && !isRegisteredPlayer && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-[#181c2e] to-purple-950/40 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Join as a Competitor</h3>
              <p className="text-xs text-gray-400">
                Register yourself into this championship to get paired in the next round and compete live.
              </p>
            </div>
          </div>
          <button
            onClick={handleJoinAsPlayer}
            disabled={joiningPlayer}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 self-start sm:self-auto hover:scale-[1.02] disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>{joiningPlayer ? 'Registering...' : `Join as Player (${currentUser.name})`}</span>
          </button>
        </div>
      )}

      {pairingNotice && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-lg">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{pairingNotice}</span>
        </div>
      )}

      {/* Main View Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveViewTab('pairings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeViewTab === 'pairings'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Matches & Pairings</span>
        </button>

        <button
          onClick={() => setActiveViewTab('standings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeViewTab === 'standings'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>FIDE Standings & Tiebreaks</span>
        </button>

        <button
          onClick={() => setActiveViewTab('crosstable')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeViewTab === 'crosstable'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Crosstable Matrix</span>
        </button>

        <button
          onClick={() => setActiveViewTab('roster')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeViewTab === 'roster'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Competitors ({playersCount})</span>
        </button>
      </div>

      {/* TAB 1: Matches & Pairings */}
      {activeViewTab === 'pairings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8">
            {/* Round Pills Switcher */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {tournament.rounds?.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRoundNumber(r.roundNumber)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeRoundNumber === r.roundNumber
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                      : 'bg-[#141824] hover:bg-[#1b2130] text-gray-400 border border-gray-800'
                  }`}
                >
                  Round {r.roundNumber} ({r.matches?.length || 0})
                </button>
              ))}

              {isArbiter && (
                <button
                  onClick={() => setShowMatchModal(true)}
                  className="px-3 py-2 rounded-xl border border-dashed border-gray-700 hover:border-indigo-500 text-gray-400 hover:text-indigo-300 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Match</span>
                </button>
              )}
            </div>

            {/* Matches List */}
            {roundMatches.length === 0 ? (
              <div className="p-12 text-center bg-[#141824] border border-gray-800 rounded-3xl">
                <Swords className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">No Matches in Round {activeRoundNumber}</h3>
                <p className="text-xs text-gray-400 mb-4 max-w-sm mx-auto">
                  Click "Generate Next Round Pairings" above to automatically pair all competitors according to Swiss rules.
                </p>
                {isArbiter && (
                  <button
                    onClick={handleGeneratePairings}
                    disabled={generatingPairings}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
                  >
                    Generate Pairings Now
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {roundMatches.map((m: any) => {
                  const isBye = m.blackPlayerName === 'BYE' || m.resultReason === 'BYE';
                  const isMyMatch = currentUser?.name && (
                    m.whitePlayerName?.toLowerCase().trim() === currentUser.name.toLowerCase().trim() ||
                    m.blackPlayerName?.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
                  );
                  const myColor = currentUser?.name && m.whitePlayerName?.toLowerCase().trim() === currentUser.name.toLowerCase().trim() ? 'White' : 'Black';

                  return (
                    <div
                      key={m.id}
                      className={`rounded-2xl p-5 shadow-xl transition-all ${
                        isMyMatch
                          ? 'bg-[#181d2e] border-2 border-indigo-500/80 shadow-indigo-500/10'
                          : 'bg-[#141824] border border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Players */}
                        <div className="space-y-2 flex-1">
                          {isMyMatch && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                              <Swords className="w-3 h-3 text-indigo-400" />
                              <span>Your Match &bull; Playing as {myColor}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between sm:justify-start gap-4">
                            <div className="flex items-center gap-2">
                              <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-400" />
                              <span className={`font-bold text-sm ${m.whitePlayerName?.toLowerCase().trim() === currentUser?.name?.toLowerCase().trim() ? 'text-indigo-400' : 'text-white'}`}>
                                {m.whitePlayerName}
                              </span>
                            </div>
                            <span className="font-mono text-sm font-black text-gray-200">
                              {m.result ? m.result.split('-')[0] : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-start gap-4">
                            <div className="flex items-center gap-2">
                              <span className="w-3.5 h-3.5 rounded-full bg-gray-900 border border-gray-600" />
                              <span className={`font-bold text-sm ${m.blackPlayerName?.toLowerCase().trim() === currentUser?.name?.toLowerCase().trim() ? 'text-indigo-400' : 'text-white'}`}>
                                {isBye ? (
                                  <span className="text-amber-400 italic">BYE (+1 pt)</span>
                                ) : (
                                  m.blackPlayerName
                                )}
                              </span>
                            </div>
                            <span className="font-mono text-sm font-black text-gray-200">
                              {m.result ? m.result.split('-')[1] : ''}
                            </span>
                          </div>
                        </div>

                        {/* Status & Actions */}
                        <div className="flex items-center gap-2 sm:self-center">
                          {isBye ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold">
                              Bye Awarded
                            </span>
                          ) : m.status === 'FINISHED' ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-bold">
                              {m.result}
                            </span>
                          ) : m.status === 'ACTIVE' ? (
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold animate-pulse">
                              LIVE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 text-xs font-bold">
                              Pending
                            </span>
                          )}

                          {!isBye && (
                            <>
                              {isMyMatch ? (
                                <Link
                                  href={`/match/${m.id}`}
                                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all flex items-center gap-1.5 hover:scale-[1.02]"
                                >
                                  <Swords className="w-3.5 h-3.5 text-amber-300" />
                                  <span>Play ({myColor})</span>
                                </Link>
                              ) : (
                                <Link
                                  href={`/match/${m.id}`}
                                  className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-colors"
                                >
                                  View Board
                                </Link>
                              )}

                              {isArbiter && (
                                <>
                                  <button
                                    onClick={() => setSelectedMatchForShare(m)}
                                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:scale-[1.02]"
                                    title="Send White & Black invitation links to players"
                                  >
                                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Send Links</span>
                                  </button>

                                  <Link
                                    href={`/arbiter/match/${m.id}`}
                                    className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
                                  >
                                    Arbiter Console
                                  </Link>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Standings Sidebar */}
          <div className="lg:col-span-4 bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-bold text-white">Leaderboard</h2>
              </div>
              <button
                onClick={() => setActiveViewTab('standings')}
                className="text-xs text-indigo-400 hover:underline"
              >
                View Full
              </button>
            </div>

            {standings.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500 italic">
                Standings will update as matches finish.
              </div>
            ) : (
              <div className="space-y-2">
                {standings.slice(0, 8).map((s) => (
                  <div
                    key={s.name}
                    className="p-2.5 rounded-xl bg-[#191e2c] border border-gray-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-indigo-400 w-4">{s.rank}</span>
                      <span className="font-semibold text-white truncate max-w-[140px]">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-gray-400 text-[11px]">{s.rating}</span>
                      <span className="font-black text-amber-300 text-sm">{s.points}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FIDE Standings & Tiebreaks */}
      {activeViewTab === 'standings' && (
        <div className="bg-[#141824] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 bg-[#191e2c] border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Official FIDE Tournament Standings</span>
            </h3>
            <span className="text-xs text-gray-400">Tiebreak System: Buchholz &bull; Sonneborn-Berger</span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#121520] text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="py-3 px-3">Rk</th>
                  <th className="py-3 px-4 font-sans">Competitor</th>
                  <th className="py-3 px-3">Elo</th>
                  <th className="py-3 px-3 text-center">P</th>
                  <th className="py-3 px-3 text-center">W</th>
                  <th className="py-3 px-3 text-center">D</th>
                  <th className="py-3 px-3 text-center">L</th>
                  <th className="py-3 px-3 text-center font-bold text-amber-300">Pts</th>
                  <th className="py-3 px-3 text-center">BH</th>
                  <th className="py-3 px-3 text-center">SB</th>
                  <th className="py-3 px-3 text-center">TPR</th>
                  <th className="py-3 px-3 text-right">Elo &Delta;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {standings.map((s) => (
                  <tr key={s.name} className="hover:bg-[#191f2e] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-indigo-400">{s.rank}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-white truncate max-w-[180px]">
                      {s.name}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">{s.rating}</td>
                    <td className="py-2.5 px-3 text-center text-gray-400">{s.played}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400">{s.won}</td>
                    <td className="py-2.5 px-3 text-center text-amber-400">{s.drawn}</td>
                    <td className="py-2.5 px-3 text-center text-rose-400">{s.lost}</td>
                    <td className="py-2.5 px-3 text-center font-black text-amber-400 text-sm bg-amber-500/10">
                      {s.points}
                    </td>
                    <td className="py-2.5 px-3 text-center text-indigo-300 font-bold">{s.buchholz}</td>
                    <td className="py-2.5 px-3 text-center text-purple-300">{s.sonnebornBerger}</td>
                    <td className="py-2.5 px-3 text-center text-gray-300">{s.performanceRating}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={s.eloDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {s.eloDelta >= 0 ? `+${s.eloDelta}` : s.eloDelta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Crosstable Matrix */}
      {activeViewTab === 'crosstable' && (
        <Crosstable crosstable={crosstable} />
      )}

      {/* TAB 4: Competitor Roster */}
      {activeViewTab === 'roster' && (
        <div className="bg-[#141824] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Registered Competitor Roster</h3>
              <p className="text-xs text-gray-400 mt-0.5">Competitors enrolled in this championship bracket.</p>
            </div>

            {isArbiter && (
              <button
                onClick={() => setShowPlayerModal(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <Users className="w-4 h-4" />
                <span>Add / Import Players</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tournament.players?.map((p: any) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-[#191e2c] border border-gray-800 hover:border-gray-700 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{p.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                      #{p.seed}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-indigo-400 font-mono">Elo {p.rating}</span>
                    <span className="text-gray-600">&bull;</span>
                    <Link
                      href={`/dashboard?playerName=${encodeURIComponent(p.name)}`}
                      className="text-[11px] text-gray-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
                      title="View competitor scorecard & history"
                    >
                      <span>Scorecard</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Score</span>
                    <span className="text-base font-black text-amber-300 font-mono">{p.score}</span>
                  </div>
                  {isArbiter && (
                    <button
                      onClick={() => handleDeletePlayer(p.id, p.name)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove competitor from tournament"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Import Competitors Modal */}
      {showPlayerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141824] border border-gray-700 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Enroll Competitors</span>
              </h2>
              <span className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                Arbiter Portal
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              Add individual or multiple players at once into this tournament bracket.
            </p>

            {/* Mode Tabs */}
            <div className="flex rounded-xl bg-[#0f121d] p-1 border border-gray-800 mb-5">
              <button
                type="button"
                onClick={() => setEnrollmentMode('bulk')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  enrollmentMode === 'bulk'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bulk Paste / CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setEnrollmentMode('rows')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  enrollmentMode === 'rows'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Multi-Row Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setEnrollmentMode('single')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  enrollmentMode === 'single'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Single Player</span>
              </button>
            </div>

            <form onSubmit={handleEnrollPlayers} className="space-y-4">
              {/* MODE 1: BULK PASTE / CSV */}
              {enrollmentMode === 'bulk' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300">
                      Paste Player List (One per line)
                    </label>
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
                      {parseBulkText(bulkText).length} players detected
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500">
                    Format: <code className="text-gray-300 bg-gray-800 px-1 py-0.5 rounded">Player Name, Elo</code> or simply <code className="text-gray-300 bg-gray-800 px-1 py-0.5 rounded">Player Name</code> (defaults to 1500 Elo). Comma or tab separated.
                  </p>

                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Magnus Carlsen, 2882\nHikaru Nakamura, 2875\nAlireza Firouzja, 2805\nFabiano Caruana, 2800\nGukesh D, 2794`}
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl p-3 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />

                  {/* 1-Click Roster Presets */}
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 block mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Quick Presets:</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setBulkText(preset.data)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 hover:border-gray-600 transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: MULTI-ROW GRID */}
              {enrollmentMode === 'rows' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300">
                      Competitor Roster Rows
                    </label>
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
                      {playerRows.filter((r) => r.name.trim()).length} players ready
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {playerRows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 w-6 text-center">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="Competitor Name"
                          value={row.name}
                          onChange={(e) => {
                            const next = [...playerRows];
                            next[idx].name = e.target.value;
                            setPlayerRows(next);
                          }}
                          className="flex-1 bg-[#1a1f2e] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="number"
                          placeholder="Elo"
                          value={row.rating}
                          onChange={(e) => {
                            const next = [...playerRows];
                            next[idx].rating = e.target.value;
                            setPlayerRows(next);
                          }}
                          className="w-24 bg-[#1a1f2e] border border-gray-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-center"
                        />
                        {playerRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPlayerRows(playerRows.filter((_, i) => i !== idx));
                            }}
                            className="p-2 text-gray-500 hover:text-rose-400 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPlayerRows([...playerRows, { name: '', rating: '1500' }])}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-indigo-300 text-xs font-medium border border-gray-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPlayerRows([
                          ...playerRows,
                          { name: '', rating: '1500' },
                          { name: '', rating: '1500' },
                          { name: '', rating: '1500' },
                        ])
                      }
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium border border-gray-700 transition-colors"
                    >
                      <span>+ Add 3 Rows</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 3: SINGLE PLAYER */}
              {enrollmentMode === 'single' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Player Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alireza Firouzja"
                      value={singlePlayerName}
                      onChange={(e) => setSinglePlayerName(e.target.value)}
                      className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      FIDE / Platform Rating (Elo)
                    </label>
                    <input
                      type="number"
                      value={singlePlayerRating}
                      onChange={(e) => setSinglePlayerRating(e.target.value)}
                      className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowPlayerModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPlayer}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {addingPlayer
                      ? 'Enrolling...'
                      : enrollmentMode === 'bulk'
                      ? `Enroll ${parseBulkText(bulkText).length || ''} Players`
                      : enrollmentMode === 'rows'
                      ? `Enroll ${playerRows.filter((r) => r.name.trim()).length || ''} Players`
                      : 'Enroll Player'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Custom Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141824] border border-gray-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-xl font-black text-white mb-2">Custom Match for Round {activeRoundNumber}</h2>

            {matchInvitations ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs font-semibold">
                  Match created! Send invitation links to White and Black.
                </div>

                <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-bold text-white">White Link:</span>
                    <button
                      onClick={() => copyText(matchInvitations.white.url, 'white')}
                      className="text-indigo-400 hover:text-white flex items-center gap-1 font-semibold text-[11px]"
                    >
                      {copiedKey === 'white' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'white' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    readOnly
                    value={matchInvitations.white.url}
                    className="w-full bg-[#121520] border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-400 font-mono select-all"
                  />
                </div>

                <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-bold text-white">Black Link:</span>
                    <button
                      onClick={() => copyText(matchInvitations.black.url, 'black')}
                      className="text-indigo-400 hover:text-white flex items-center gap-1 font-semibold text-[11px]"
                    >
                      {copiedKey === 'black' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'black' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    readOnly
                    value={matchInvitations.black.url}
                    className="w-full bg-[#121520] border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-400 font-mono select-all"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowMatchModal(false);
                      setMatchInvitations(null);
                      setWhitePlayerName('');
                      setBlackPlayerName('');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateMatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    White Player Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Magnus Carlsen"
                    value={whitePlayerName}
                    onChange={(e) => setWhitePlayerName(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Black Player Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hikaru Nakamura"
                    value={blackPlayerName}
                    onChange={(e) => setBlackPlayerName(e.target.value)}
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowMatchModal(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingMatch}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                  >
                    {creatingMatch ? 'Creating...' : 'Create & Generate Tokens'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Arbiter Share Links Modal */}
      <ShareMatchLinksModal
        isOpen={!!selectedMatchForShare}
        onClose={() => setSelectedMatchForShare(null)}
        matchId={selectedMatchForShare?.id || null}
        matchSummary={{
          whitePlayerName: selectedMatchForShare?.whitePlayerName,
          blackPlayerName: selectedMatchForShare?.blackPlayerName,
          tournamentName: tournament?.name,
          roundNumber: activeRoundNumber,
          timeControl: tournament?.timeControl,
        }}
      />
    </div>
  );
}