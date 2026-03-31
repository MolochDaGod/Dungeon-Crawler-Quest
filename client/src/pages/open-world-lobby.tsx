import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { io, Socket } from 'socket.io-client';
import { HEROES } from '@/game/types';

// WebSocket server — Grudge Studio VPS (ws.grudge-studio.com)
// Override per-env with VITE_WORLD_SERVER_URL
const WORLD_SERVER = import.meta.env.VITE_WORLD_SERVER_URL || 'https://ws.grudge-studio.com';

interface WorldInfo {
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
}

export default function OpenWorldLobby() {
  const [, setLocation] = useLocation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState('');
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'browse' | 'create' | 'join'>('browse');

  const heroId = parseInt(localStorage.getItem('grudge_hero_id') || '-1');
  const hero = HEROES.find(h => h.id === heroId);

  // Connect to world server
  useEffect(() => {
    const grudgeToken = localStorage.getItem('grudge_auth_token') || undefined;
    const s = io(WORLD_SERVER, {
      path: '/game',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      timeout: 8000,
      auth: grudgeToken ? { token: grudgeToken } : undefined,
    });

    s.on('connect', () => {
      setStatus('connected');
      setError('');
      // Fetch public worlds
      s.emit('world:list', (list: WorldInfo[]) => setWorlds(list));
    });

    s.on('connect_error', () => {
      setStatus('error');
      setError('Cannot reach world server. It may be offline.');
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  // Refresh world list periodically
  useEffect(() => {
    if (!socket || status !== 'connected') return;
    const interval = setInterval(() => {
      socket.emit('world:list', (list: WorldInfo[]) => setWorlds(list));
    }, 5000);
    return () => clearInterval(interval);
  }, [socket, status]);

  const enterWorld = useCallback((code: string, playerId: number) => {
    // Store connection info for the open-world page to use
    localStorage.setItem('grudge_world_code', code);
    localStorage.setItem('grudge_world_player_id', String(playerId));
    localStorage.setItem('grudge_world_server', WORLD_SERVER);
    setLocation('/open-world-play');
  }, [setLocation]);

  const handleCreate = useCallback((isPublic: boolean) => {
    if (!socket || !hero) return;
    socket.emit('world:create', {
      playerName: hero.name,
      heroId: hero.id,
      heroClass: hero.heroClass,
      heroRace: hero.race,
      isPublic,
    }, (res: any) => {
      if (res.error) { setError(res.error); return; }
      enterWorld(res.code, res.playerId);
    });
  }, [socket, hero, enterWorld]);

  const handleJoin = useCallback((code: string) => {
    if (!socket || !hero) return;
    socket.emit('world:join', {
      code: code.toUpperCase(),
      playerName: hero.name,
      heroId: hero.id,
      heroClass: hero.heroClass,
      heroRace: hero.race,
    }, (res: any) => {
      if (res.error) { setError(res.error); return; }
      enterWorld(res.code, res.playerId);
    });
  }, [socket, hero, enterWorld]);

  if (heroId < 0 || !hero) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">No hero selected</p>
          <button onClick={() => setLocation('/')} className="px-4 py-2 bg-red-700 rounded">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation('/')} className="text-white/40 hover:text-white text-sm">← Back</button>
          <h1 className="text-xl font-bold">Open World</h1>
          <span className="text-white/30 text-sm">|</span>
          <span className="text-amber-400 text-sm font-semibold">{hero.name}</span>
          <span className="text-white/30 text-xs">{hero.race} {hero.heroClass}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'connected' && <span className="w-2 h-2 rounded-full bg-green-500" />}
          {status === 'connecting' && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
          {status === 'error' && <span className="w-2 h-2 rounded-full bg-red-500" />}
          <span className="text-white/30 text-xs">{status}</span>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-950/50 border border-red-500/30 rounded text-red-300 text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="px-6 pt-6">
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
          {(['browse', 'create', 'join'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                tab === t ? 'bg-red-700 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'browse' ? `Browse Worlds (${worlds.length})` : t === 'create' ? 'Create World' : 'Join by Code'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl">
        {/* Browse */}
        {tab === 'browse' && (
          <div className="space-y-3">
            {worlds.length === 0 && (
              <div className="text-center py-16 text-white/30">
                <p className="text-lg mb-2">No public worlds available</p>
                <p className="text-sm">Create one to get started!</p>
              </div>
            )}
            {worlds.map(w => (
              <div key={w.code} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-4 hover:border-red-500/30 transition-colors">
                <div>
                  <div className="font-semibold text-white">{w.hostName}'s World</div>
                  <div className="text-white/40 text-sm">Code: <span className="font-mono text-amber-400">{w.code}</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white/50 text-sm">{w.players}/{w.maxPlayers} players</span>
                  <button
                    onClick={() => handleJoin(w.code)}
                    className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-bold"
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create */}
        {tab === 'create' && (
          <div className="max-w-md space-y-6 pt-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center space-y-4">
              <h2 className="text-xl font-bold text-amber-400">Create a World</h2>
              <p className="text-white/50 text-sm">Start a new open world instance. Other players can join using the code or from the browser.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => handleCreate(true)} className="px-6 py-3 bg-red-700 hover:bg-red-600 rounded font-bold">
                  Public World
                </button>
                <button onClick={() => handleCreate(false)} className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded font-bold">
                  Private World
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Join by Code */}
        {tab === 'join' && (
          <div className="max-w-md space-y-6 pt-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center space-y-4">
              <h2 className="text-xl font-bold text-sky-400">Join by Code</h2>
              <p className="text-white/50 text-sm">Enter the 4-character world code shared by the host.</p>
              <div className="flex gap-2 justify-center">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="ABCD"
                  className="bg-black border border-white/20 rounded px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] w-40 uppercase"
                  maxLength={4}
                />
                <button
                  onClick={() => handleJoin(joinCode)}
                  disabled={joinCode.length < 4}
                  className="px-6 py-3 bg-sky-700 hover:bg-sky-600 disabled:opacity-30 rounded font-bold"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
