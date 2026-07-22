import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sword, Shield, Skull, Crown, Settings, MousePointer2, Keyboard, Crosshair, ShoppingBag, LayoutGrid, Globe, User, Palmtree, Lock } from 'lucide-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'arena' | 'openworld' | 'dungeon' | 'dungeon3d' | 'spaceconquest'>('openworld');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [titlePulse, setTitlePulse] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const pulseInterval = setInterval(() => {
      setTitlePulse(prev => !prev);
    }, 2000);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId = 0;
    let gradientHue = 0;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      gradientHue = (gradientHue + 0.12) % 360;

      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, `hsl(${120 + Math.sin(gradientHue * 0.01) * 20}, 15%, 4%)`);
      grad.addColorStop(0.3, `hsl(${40 + Math.sin(gradientHue * 0.015) * 15}, 20%, 6%)`);
      grad.addColorStop(0.7, `hsl(${0 + Math.sin(gradientHue * 0.008) * 10}, 18%, 5%)`);
      grad.addColorStop(1, `hsl(${270 + Math.sin(gradientHue * 0.012) * 20}, 12%, 4%)`);
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      if (Math.random() < 0.3) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 1.5 - 0.5,
          size: Math.random() * 3 + 1,
          color: Math.random() > 0.7 ? '#c5a059' : Math.random() > 0.5 ? '#8b6914' : '#a855f7',
          life: 1
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.003;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
      }
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(pulseInterval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handlePlay = async () => {
    localStorage.setItem('grudge_mode', selectedMode);

    // Always prefer account character select when roster has heroes
    try {
      const { getAll } = await import('@/lib/grudgeCharacters');
      const chars = await getAll();
      if (chars.length > 0) {
        setLocation('/character-select');
        return;
      }
    } catch { /* fall through */ }

    // Brand-new players (no saved character at all) go to creation first
    const hasAnyHero =
      !!localStorage.getItem('grudge_custom_hero') ||
      !!localStorage.getItem('grudge_player_character') ||
      (parseInt(localStorage.getItem('grudge_hero_id') || '-1', 10) >= 0);

    if (!hasAnyHero) {
      setLocation('/create-character');
      return;
    }

    // Single local hero path — load into engine then jump into mode
    try {
      const { ensurePlayerHeroLoaded } = await import('@/game/player-account');
      await ensurePlayerHeroLoaded();
    } catch { /* play with whatever localStorage has */ }

    if (selectedMode === 'openworld') setLocation('/open-world-play');
    else if (selectedMode === 'dungeon') setLocation('/dungeon');
    else if (selectedMode === 'dungeon3d') setLocation('/dungeon3d');
    else setLocation('/game'); // MOBA arena (top-down 5v5)
  };

  const handleAdminLogin = () => {
    // Simple admin gate — allows access to the legacy hero select
    if (adminPass === 'grudge' || adminPass === 'admin') {
      localStorage.setItem('grudge_admin', 'true');
      setLocation('/character-select');
    }
    setShowAdminLogin(false);
    setAdminPass('');
  };

  const handleNewCharacter = () => {
    // Clear saved character and go to creation
    localStorage.removeItem('grudge_hero_id');
    localStorage.removeItem('grudge_custom_hero');
    localStorage.setItem('grudge_mode', selectedMode);
    setLocation('/create-character');
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0f0a]" data-testid="home-page">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className={`relative z-10 flex flex-col items-center justify-center h-full px-4 transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Sword className="w-9 h-9 text-red-500" />
            <Shield className="w-9 h-9 text-blue-500" />
            <Skull className="w-9 h-9 text-purple-500" />
            <Crown className="w-9 h-9 text-[#c5a059]" />
          </div>
          <h1
            className="text-7xl md:text-9xl font-black tracking-wider mb-2 transition-all duration-1000"
            style={{
              fontFamily: "'Oxanium', sans-serif",
              color: '#c5a059',
              textShadow: titlePulse
                ? '0 0 80px rgba(197,160,89,0.6), 0 0 160px rgba(197,160,89,0.3), 0 4px 20px rgba(0,0,0,0.8)'
                : '0 0 40px rgba(197,160,89,0.3), 0 0 80px rgba(197,160,89,0.15), 0 4px 20px rgba(0,0,0,0.8)',
              transform: titlePulse ? 'scale(1.02)' : 'scale(1)',
            }}
            data-testid="text-title"
          >
            GRUDGE
          </h1>
          <h2
            className="text-3xl md:text-5xl tracking-[0.3em] text-red-500 font-bold mb-6"
            style={{
              fontFamily: "'Oxanium', sans-serif",
              textShadow: '0 0 30px rgba(239,68,68,0.5)'
            }}
            data-testid="text-subtitle"
          >
            WARLORDS
          </h2>
          <p className="text-gray-300 max-w-xl mx-auto text-lg mb-2" data-testid="text-tagline">
            Create your warrior. Choose your destiny. Enter the world.
          </p>
          <p className="text-gray-500 text-sm mb-2">
            6 Races &bull; 4 Classes &bull; 17 Weapon Types &bull; 8 Attributes &bull; Level 1-20
          </p>
          <p className="text-[11px] text-[#c5a059]/80 mb-6 tracking-wide uppercase" data-testid="text-tvs-badge">
            TVS assets · D1/R2 · castles · camps · crypts · heroes
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-8 max-w-4xl">
          <button
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[170px] ${
              selectedMode === 'arena'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('arena')}
            data-testid="button-mode-arena"
          >
            <Sword className="w-10 h-10" />
            <span className="text-base font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>MOBA</span>
            <span className="text-xs text-gray-400">5v5 · Top-down · TVS towers</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-[160px]">
              Knight keeps, ranger camps, wizard towers from TVS packs.
            </p>
          </button>
          <button
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[170px] ${
              selectedMode === 'openworld'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('openworld')}
            data-testid="button-mode-openworld"
          >
            <Globe className="w-10 h-10" />
            <span className="text-base font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>OPEN WORLD</span>
            <span className="text-xs text-gray-400">MMO · Zones · Settlements</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-[160px]">
              Villages, farms, camps — TVS world content.
            </p>
          </button>
          <button
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[170px] ${
              selectedMode === 'dungeon'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('dungeon')}
            data-testid="button-mode-dungeon"
          >
            <Skull className="w-10 h-10" />
            <span className="text-base font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>DCQ</span>
            <span className="text-xs text-gray-400">Top-down crypt · 10 floors</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-[160px]">
              Cathedral crypt dressing · procedural floors.
            </p>
          </button>
          <button
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[170px] ${
              selectedMode === 'dungeon3d'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('dungeon3d')}
            data-testid="button-mode-dungeon3d"
          >
            <Crosshair className="w-10 h-10" />
            <span className="text-base font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>3D DUNGEON</span>
            <span className="text-xs text-gray-400">TPS · Voxel rooms</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-[160px]">
              3D rooms with TVS crypt props &amp; heroes.
            </p>
          </button>
        </div>

        <div className="flex flex-col gap-3 items-center mb-8">
          {/* Main play button */}
          <Button
            size="lg"
            className="text-xl px-20 min-h-16 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold tracking-wider shadow-lg shadow-red-900/50 transition-all duration-300"
            style={{ fontFamily: "'Oxanium', sans-serif" }}
            onClick={handlePlay}
            data-testid="button-play"
          >
            {localStorage.getItem('grudge_custom_hero')
              ? (selectedMode === 'arena' ? 'ENTER MOBA'
                : selectedMode === 'dungeon' ? 'ENTER THE CRYPT'
                : selectedMode === 'dungeon3d' ? 'ENTER 3D DUNGEON'
                : selectedMode === 'spaceconquest' ? 'LAUNCH CONQUEST'
                : 'EXPLORE THE WORLD')
              : 'CREATE CHARACTER'
            }
          </Button>

          {/* Secondary: New Character button (always visible) */}
          {localStorage.getItem('grudge_custom_hero') && (
            <button
              className="text-sm text-[#c5a059] hover:text-[#fbbf24] transition-colors cursor-pointer mt-1"
              onClick={handleNewCharacter}
              style={{ fontFamily: "'Oxanium', sans-serif" }}
              data-testid="button-new-character"
            >
              + New Character
            </button>
          )}

          <div className="flex gap-4 mt-2 flex-wrap justify-center">
            <button
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer"
              onClick={() => setLocation('/settings')}
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <button
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer"
              onClick={() => setLocation('/character')}
              data-testid="button-character"
            >
              <User className="w-4 h-4" />
              <span>Character</span>
            </button>
            <button
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer"
              onClick={() => setLocation('/island')}
              data-testid="button-island"
            >
              <Palmtree className="w-4 h-4" />
              <span>Island Camp</span>
            </button>
          </div>

          {/* 3D Game Modes */}
          <div className="flex gap-3 mt-3 flex-wrap justify-center">
            <button
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#00ffcc] transition-colors cursor-pointer px-3 py-1.5 rounded border border-gray-800 hover:border-[#00ffcc]/40"
              onClick={() => setLocation('/sandbox')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Sandbox</span>
            </button>
            <button
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#ff0055] transition-colors cursor-pointer px-3 py-1.5 rounded border border-gray-800 hover:border-[#ff0055]/40"
              onClick={() => setLocation('/arena')}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Arena Fighter</span>
            </button>
            <button
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer px-3 py-1.5 rounded border border-gray-800 hover:border-[#c5a059]/40"
              onClick={() => setLocation('/dungeon3d')}
            >
              <Skull className="w-3.5 h-3.5" />
              <span>3D Dungeon</span>
            </button>
          </div>
        </div>

        {/* Admin button — bottom right corner */}
        <button
          className="absolute bottom-6 right-6 flex items-center gap-1.5 text-xs text-gray-700 hover:text-[#ef4444] transition-colors cursor-pointer opacity-50 hover:opacity-100"
          onClick={() => setShowAdminLogin(true)}
          data-testid="button-admin-login"
        >
          <Lock className="w-3 h-3" />
          <span>Admin</span>
        </button>

        <div className="w-full max-w-lg mx-auto bg-black/20 rounded-lg px-6 py-4 border border-gray-800/50 overflow-y-auto" style={{ maxHeight: '40vh' }} data-testid="section-how-to-play">
          <h3 className="text-xs uppercase tracking-[0.2em] text-center mb-3" style={{ fontFamily: "'Oxanium', sans-serif", color: '#c5a059' }}>
            How to Play
          </h3>
          {selectedMode === 'arena' ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <MousePointer2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">RMB</span> Move / Target</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Crosshair className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">A + LMB</span> Attack-move</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">Q W E R</span> Abilities</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <ShoppingBag className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">B</span> Open Shop</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <LayoutGrid className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">Tab</span> Scoreboard</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">S</span> Stop</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <MousePointer2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">MMB</span> Pan Camera</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">WASD</span> Camera</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">W A S D</span> Move</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">Q W E R</span> Abilities</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <MousePointer2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">LMB</span> Attack / Target</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">I</span> Inventory</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <MousePointer2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">Scroll</span> Zoom</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">+/-</span> Minimap Zoom</span>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-6 text-center">
          <p className="text-gray-700 text-xs">&copy; 2026 Grudge Warlords &bull; Voxel engine powered by IsoVoxel &amp; PixVoxelAssets</p>
        </div>
      </div>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowAdminLogin(false)}
        >
          <div
            className="bg-[#1a1a2e] border border-[#ef4444]/30 rounded-xl p-6 w-80"
            onClick={e => e.stopPropagation()}
            style={{ fontFamily: "'Oxanium', sans-serif" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-[#ef4444]" />
              <h3 className="text-lg font-bold text-[#ef4444]">Admin Access</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Hero Select, Entity Editor, World Admin</p>
            <input
              type="password"
              placeholder="Password"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-gray-700 text-white text-sm mb-3"
              style={{ outline: 'none' }}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold"
                onClick={handleAdminLogin}
              >
                Login
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAdminLogin(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
              <button
                className="flex-1 text-xs text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer py-1"
                onClick={() => { setShowAdminLogin(false); setLocation('/editor'); }}
              >Entity Editor</button>
              <button
                className="flex-1 text-xs text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer py-1"
                onClick={() => { setShowAdminLogin(false); setLocation('/worldadmin'); }}
              >World Admin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
