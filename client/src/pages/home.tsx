import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sword, Shield, Skull, Crown, Settings, Map, MousePointer2, Keyboard, Crosshair, ShoppingBag } from 'lucide-react';

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
      gradientHue = (gradientHue + 0.15) % 360;

      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, `hsl(${gradientHue}, 15%, 5%)`);
      grad.addColorStop(0.5, `hsl(${(gradientHue + 30) % 360}, 20%, 7%)`);
      grad.addColorStop(1, `hsl(${(gradientHue + 60) % 360}, 15%, 4%)`);
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      if (Math.random() < 0.3) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 1.5 - 0.5,
          size: Math.random() * 3 + 1,
          color: Math.random() > 0.7 ? '#ef4444' : Math.random() > 0.5 ? '#ffd700' : '#a855f7',
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
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0f]" data-testid="home-page">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className={`relative z-10 flex flex-col items-center justify-center h-full transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-3">
            <Sword className="w-9 h-9 text-red-500" />
            <Shield className="w-9 h-9 text-blue-500" />
            <Skull className="w-9 h-9 text-purple-500" />
            <Crown className="w-9 h-9 text-yellow-500" />
          </div>
          <h1
            className="text-7xl md:text-9xl font-black tracking-wider mb-2 transition-all duration-1000"
            style={{
              fontFamily: "'Oxanium', sans-serif",
              color: '#ffd700',
              textShadow: titlePulse
                ? '0 0 80px rgba(255,215,0,0.6), 0 0 160px rgba(255,215,0,0.3), 0 4px 20px rgba(0,0,0,0.8)'
                : '0 0 40px rgba(255,215,0,0.3), 0 0 80px rgba(255,215,0,0.15), 0 4px 20px rgba(0,0,0,0.8)',
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

        <div className="flex gap-5 mb-8">
          <button
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[180px] ${
              selectedMode === 'moba'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('moba')}
            data-testid="button-mode-moba"
          >
            <Sword className="w-10 h-10" />
            <span className="text-base font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>MOBA ARENA</span>
            <span className="text-[11px] text-gray-400">5v5 &bull; 3 Lanes &bull; Towers</span>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              Destroy the enemy Nexus. Level up, buy items, and push lanes with your team.
            </p>
          </button>
          <button
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-lg border-2 transition-all duration-300 cursor-pointer min-w-[180px] ${
              selectedMode === 'dungeon'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059] shadow-lg shadow-[#c5a059]/20'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500 hover:bg-black/50'
            }`}
            onClick={() => setSelectedMode('dungeon')}
            data-testid="button-mode-dungeon"
          >
            <Map className="w-10 h-10" />
            <span className="text-base font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>DUNGEON CRAWL</span>
            <span className="text-[11px] text-gray-400">PvE &bull; 10 Floors &bull; Bosses</span>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              Explore procedural dungeons. Fight monsters, find loot, and conquer the final boss.
            </p>
          </button>
        </div>

        <div className="flex flex-col gap-3 items-center mb-6">
          <Button
            size="lg"
            className="text-xl px-16 min-h-14 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold tracking-wider shadow-lg shadow-red-900/50 transition-all duration-300"
            style={{ fontFamily: "'Oxanium', sans-serif" }}
            onClick={handlePlay}
            data-testid="button-play"
          >
            {selectedMode === 'moba' ? 'ENTER THE ARENA' : 'DESCEND INTO DARKNESS'}
          </Button>

          <button
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#c5a059] transition-colors cursor-pointer mt-2"
            onClick={() => setLocation('/settings')}
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
            <span>Keybindings &amp; Settings</span>
          </button>
        </div>

        <div className="max-w-lg mx-auto" data-testid="section-how-to-play">
          <h3 className="text-xs text-gray-500 uppercase tracking-[0.2em] text-center mb-3" style={{ fontFamily: "'Oxanium', sans-serif" }}>
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
                <MousePointer2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">MMB</span> Pan Camera</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span><span className="text-gray-400">S</span> Stop</span>
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
