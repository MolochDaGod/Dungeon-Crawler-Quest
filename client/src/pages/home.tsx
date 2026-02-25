import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sword, Shield, Skull, Flame } from 'lucide-react';

function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string }[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.3 - Math.random() * 0.5,
        size: 1 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.4,
        color: Math.random() > 0.7 ? '#ef4444' : (Math.random() > 0.5 ? '#fbbf24' : '#a855f7'),
      });
    }

    let time = 0;
    function animate() {
      time += 0.016;
      ctx.fillStyle = '#0a0808';
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);

      const gradient = ctx.createRadialGradient(
        canvas!.width / 2, canvas!.height / 2, 0,
        canvas!.width / 2, canvas!.height / 2, canvas!.width * 0.6
      );
      gradient.addColorStop(0, 'rgba(127, 29, 29, 0.08)');
      gradient.addColorStop(0.5, 'rgba(88, 28, 135, 0.04)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < 3; i++) {
        const x = canvas!.width * (0.2 + i * 0.3);
        const y = canvas!.height * 0.5 + Math.sin(time + i) * 50;
        const r = 100 + Math.sin(time * 0.5 + i * 2) * 30;
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
        g2.addColorStop(0, `rgba(127, 29, 29, ${0.03 + Math.sin(time + i) * 0.02})`);
        g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g2;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = canvas!.height + 10; p.x = Math.random() * canvas!.width; }
        if (p.x < -10) p.x = canvas!.width + 10;
        if (p.x > canvas!.width + 10) p.x = -10;

        ctx.globalAlpha = p.alpha * (0.5 + Math.sin(time * 2 + p.x) * 0.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowTitle(true), 300);
    setTimeout(() => setShowSubtitle(true), 800);
    setTimeout(() => setShowButtons(true), 1200);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black" data-testid="page-home">
      <BackgroundCanvas />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        <div className="flex items-center gap-4 mb-4">
          <Skull className={`w-10 h-10 text-red-500 transition-all duration-1000 ${showTitle ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
          <Flame className={`w-8 h-8 text-amber-500 transition-all duration-1000 delay-200 ${showTitle ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
        </div>

        <h1
          className={`text-6xl md:text-8xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-red-400 via-red-600 to-red-900 transition-all duration-1000 ${showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ fontFamily: 'Oxanium, sans-serif', textShadow: '0 0 60px rgba(220,38,38,0.4)' }}
        >
          GRUDGE
        </h1>

        <h2
          className={`text-xl md:text-2xl tracking-[0.5em] text-red-300/60 mt-2 mb-2 transition-all duration-1000 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
          style={{ fontFamily: 'Oxanium, sans-serif' }}
        >
          DUNGEON OF SHADOWS
        </h2>

        <div className={`flex items-center gap-2 mb-10 transition-all duration-700 ${showSubtitle ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-red-700/50" />
          <Sword className="w-4 h-4 text-red-700/50" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-red-700/50" />
        </div>

        <p
          className={`text-sm text-neutral-500 max-w-md text-center mb-10 leading-relaxed transition-all duration-1000 delay-200 ${showSubtitle ? 'opacity-100' : 'opacity-0'}`}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Descend into the abyss. Choose your champion. Conquer the darkness.
          A hack and slash dungeon crawler forged in blood and fire.
        </p>

        <div className={`flex flex-col sm:flex-row gap-4 transition-all duration-1000 ${showButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <Button
            size="lg"
            onClick={() => setLocation('/character-select')}
            className="px-10 py-6 text-lg tracking-wider bg-gradient-to-r from-red-800 to-red-700 border-red-600 text-red-100"
            style={{ fontFamily: 'Oxanium, sans-serif' }}
            data-testid="button-new-game"
          >
            <Shield className="w-5 h-5 mr-2" />
            NEW GAME
          </Button>
        </div>

        <div className={`mt-16 flex items-center gap-6 text-neutral-600 text-xs tracking-wider transition-all duration-1000 delay-500 ${showButtons ? 'opacity-100' : 'opacity-0'}`} style={{ fontFamily: 'Oxanium, sans-serif' }}>
          <span>WASD Move</span>
          <span className="text-neutral-700">|</span>
          <span>SPACE Attack</span>
          <span className="text-neutral-700">|</span>
          <span>1-4 Abilities</span>
          <span className="text-neutral-700">|</span>
          <span>E Interact</span>
          <span className="text-neutral-700">|</span>
          <span>I Inventory</span>
        </div>
      </div>
    </div>
  );
}
