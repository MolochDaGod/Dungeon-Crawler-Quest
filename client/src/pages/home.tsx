import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sword, Shield, Skull, Crown, Settings, Map } from 'lucide-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'moba' | 'dungeon'>('moba');

  useEffect(() => {
    setLoaded(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId = 0;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      ctx.fillStyle = 'rgba(10,10,15,0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Sword className="w-8 h-8 text-red-500" />
            <Shield className="w-8 h-8 text-blue-500" />
            <Skull className="w-8 h-8 text-purple-500" />
            <Crown className="w-8 h-8 text-yellow-500" />
          </div>
          <h1
            className="text-6xl md:text-8xl font-black tracking-wider mb-2"
            style={{
              fontFamily: "'Oxanium', sans-serif",
              color: '#ffd700',
              textShadow: '0 0 60px rgba(255,215,0,0.4), 0 0 120px rgba(255,215,0,0.2), 0 4px 20px rgba(0,0,0,0.8)'
            }}
            data-testid="text-title"
          >
            GRUDGE
          </h1>
          <h2
            className="text-2xl md:text-4xl tracking-[0.3em] text-red-500 font-bold mb-6"
            style={{
              fontFamily: "'Oxanium', sans-serif",
              textShadow: '0 0 30px rgba(239,68,68,0.5)'
            }}
            data-testid="text-subtitle"
          >
            WARLORDS
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto text-lg mb-2">
            Command 26 legendary heroes across 6 races in epic battle.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Choose your mode below
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            className={`flex flex-col items-center gap-2 px-6 py-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedMode === 'moba'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059]'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500'
            }`}
            onClick={() => setSelectedMode('moba')}
            data-testid="button-mode-moba"
          >
            <Sword className="w-8 h-8" />
            <span className="text-sm font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>MOBA ARENA</span>
            <span className="text-[10px] text-gray-500">5v5 &bull; 3 Lanes &bull; Towers</span>
          </button>
          <button
            className={`flex flex-col items-center gap-2 px-6 py-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedMode === 'dungeon'
                ? 'border-[#c5a059] bg-[#c5a059]/10 text-[#c5a059]'
                : 'border-gray-700 bg-black/30 text-gray-500 hover:border-gray-500'
            }`}
            onClick={() => setSelectedMode('dungeon')}
            data-testid="button-mode-dungeon"
          >
            <Map className="w-8 h-8" />
            <span className="text-sm font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>DUNGEON CRAWL</span>
            <span className="text-[10px] text-gray-500">PvE &bull; 10 Floors &bull; Bosses</span>
          </button>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <Button
            size="lg"
            className="text-lg px-12 py-6 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold tracking-wider shadow-lg shadow-red-900/50"
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

          <p className="text-gray-600 text-xs mt-1">
            {selectedMode === 'moba'
              ? 'WASD move | QWER abilities | LMB attack | RMB move/target | MMB camera | B shop'
              : 'WASD move | QWER abilities | LMB/Space attack | I inventory | Scroll zoom'
            }
          </p>
        </div>

        <div className="absolute bottom-6 text-center">
          <p className="text-gray-700 text-xs">&copy; 2026 Grudge Warlords &bull; Voxel engine powered by IsoVoxel &amp; PixVoxelAssets</p>
        </div>
      </div>
    </div>
  );
}
