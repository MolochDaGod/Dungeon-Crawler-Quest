import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sword, Shield, Skull, Crown, Settings, Map, MousePointer2, Keyboard, Crosshair, ShoppingBag, LayoutGrid } from 'lucide-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'moba' | 'dungeon'>('moba');
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

  const handlePlay = () => {
    localStorage.setItem('grudge_mode', selectedMode);
    setLocation('/character-select');
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
            Command 26 legendary heroes across 6 races in epic battle.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Choose your mode below
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-5 mb-8">
          <button
            className={`flex flex-col items-center gap-2 px-10 py-6 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[200px] ${
              selectedMode === 'moba'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('moba')}
            data-testid="button-mode-moba"
          >
            <Sword className="w-12 h-12" />
            <span className="text-lg font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>MOBA ARENA</span>
            <span className="text-xs text-gray-400">5v5 &bull; 3 Lanes &bull; Towers</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-[180px]">
              Destroy the enemy Nexus. Level up, buy items, and push lanes with your team.
            </p>
          </button>
          <button
            className={`flex flex-col items-center gap-2 px-10 py-6 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[200px] ${
              selectedMode === 'dungeon'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('dungeon')}
            data-testid="button-mode-dungeon"
          >
            <Map className="w-12 h-12" />
            <span className="text-lg font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>DUNGEON CRAWL</span>
            <span className="text-xs text-gray-400">PvE &bull; 10 Floors &bull; Bosses</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-[180px]">
              Explore procedural dungeons. Fight monsters, find loot, and conquer the final boss.
            </p>
          </button>
        </div>

        <div className="flex flex-col gap-3 items-center mb-8">
          <Button
            size="lg"
            className="text-xl px-20 min-h-16 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold tracking-wider shadow-lg shadow-red-900/50 transition-all duration-300"
            style={{ fontFamily: "'Oxanium', sans-serif" }}
            onClick={handlePlay}
            data-testid="button-play"
          >
            {selectedMode === 'moba' ? 'ENTER THE ARENA' : 'DESCEND INTO DARKNESS'}
          </Button>

          <div className="flex gap-4 mt-2">
            <button
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer"
              onClick={() => setLocation('/settings')}
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
              <span>Keybindings &amp; Settings</span>
            </button>
            <button
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer"
              onClick={() => setLocation('/editor')}
              data-testid="button-editor"
            >
              <Sword className="w-4 h-4" />
              <span>Entity Editor</span>
            </button>
          </div>
        </div>

        <div className="w-full max-w-lg mx-auto bg-black/20 rounded-lg px-6 py-4 border border-gray-800/50 overflow-y-auto" style={{ maxHeight: '40vh' }} data-testid="section-how-to-play">
          <h3 className="text-xs uppercase tracking-[0.2em] text-center mb-3" style={{ fontFamily: "'Oxanium', sans-serif", color: '#c5a059' }}>
            How to Play
          </h3>
          {selectedMode === 'moba' ? (
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
                <span><span className="text-gray-400">LMB / Space</span> Attack</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">I</span> Inventory</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <LayoutGrid className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">Tab</span> Scoreboard</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <MousePointer2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">Scroll</span> Zoom</span>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-6 text-center">
          <p className="text-gray-700 text-xs">&copy; 2026 Grudge Warlords &bull; Voxel engine powered by IsoVoxel &amp; PixVoxelAssets</p>
        </div>
      </div>
    </div>
  );
}
