import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  HEROES, CLASS_ABILITIES, CLASS_COLORS, ITEMS, ItemDef, RACE_COLORS
} from '@/game/types';
import {
  DungeonState, DungeonHudState,
  createDungeonState, updateDungeon, getDungeonHudState,
  DungeonRenderer, handleDungeonAbility, handleDungeonAttack
} from '@/game/dungeon';
import { EFFECT_COLORS, StatusEffect } from '@/game/combat';

export default function DungeonGamePage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<DungeonState | null>(null);
  const rendererRef = useRef<DungeonRenderer | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const [hud, setHud] = useState<DungeonHudState | null>(null);

  const heroId = parseInt(localStorage.getItem('grudge_hero_id') || '-1');

  useEffect(() => {
    if (heroId < 0) { setLocation('/'); return; }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const state = createDungeonState(heroId);
    stateRef.current = state;
    const renderer = new DungeonRenderer(canvas);
    rendererRef.current = renderer;

    let lastTime = performance.now();
    let hudTimer = 0;
    let animId = 0;

    const gameLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;

      updateDungeon(state, dt, keysRef.current);
      renderer.render(state);

      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        setHud(getDungeonHudState(state));
      }
      animId = requestAnimationFrame(gameLoop);
    };
    animId = requestAnimationFrame(gameLoop);

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      if (key === 'q') handleDungeonAbility(state, 0);
      if (key === 'w' && e.shiftKey) handleDungeonAbility(state, 1);
      if (key === 'e') handleDungeonAbility(state, 2);
      if (key === 'r') handleDungeonAbility(state, 3);
      if (key === ' ') handleDungeonAttack(state);
      if (key === 'i') state.showInventory = !state.showInventory;
      if (key === 'escape') { state.showInventory = false; state.paused = !state.paused; }
      if (key >= '1' && key <= '4') handleDungeonAbility(state, parseInt(key) - 1);
    };

    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };

    const onClick = (e: MouseEvent) => {
      if (e.button === 0) handleDungeonAttack(state);
    };

    const onWheel = (e: WheelEvent) => {
      state.camera.zoom = Math.max(0.6, Math.min(2.5, state.camera.zoom - e.deltaY * 0.001));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [heroId, setLocation]);

  const heroData = HEROES.find(h => h.id === heroId);
  const abilities = heroData ? CLASS_ABILITIES[heroData.heroClass] || [] : [];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" data-testid="dungeon-game-page">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" data-testid="canvas-dungeon" />

      {hud && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999, fontFamily: "'Oxanium', sans-serif" }}>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3 bg-black/70 px-4 py-2 rounded-b-lg border border-t-0 border-[#c5a059]/40" data-testid="panel-dungeon-top">
            <span className="text-sm text-[#c5a059] font-bold">Floor {hud.floor}</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-gray-400">Kills: {hud.kills}</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-yellow-500">{hud.gold}g</span>
          </div>

          {hud.activeEffects.length > 0 && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-1" data-testid="panel-active-effects">
              {hud.activeEffects.map((eff, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
                  style={{ background: 'rgba(0,0,0,0.7)', border: `1px solid ${eff.color}`, color: eff.color }}
                  title={`${eff.name} (${eff.remaining.toFixed(1)}s)`}
                >
                  <span>{eff.icon}</span>
                  <span>{Math.ceil(eff.remaining)}s</span>
                </div>
              ))}
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 flex items-end p-2.5 gap-2.5 pointer-events-auto">

            <div className="flex flex-col gap-1" style={{ width: 220 }}>
              <div
                className="p-2 flex flex-col text-xs text-gray-400 overflow-y-auto"
                style={{ height: 110, background: 'linear-gradient(to bottom, #2a2a2a, #111)', border: '2px solid #c5a059', boxShadow: 'inset 0 0 10px #000' }}
                data-testid="panel-dungeon-log"
              >
                <div style={{ color: '#c5a059' }}>[Dungeon] Floor {hud.floor}</div>
                {hud.killFeed.slice(-5).map((k, i) => (
                  <div key={i} style={{ color: k.color }}>{k.text}</div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <div
                className="flex flex-col items-center gap-1 p-3"
                style={{ background: 'linear-gradient(to bottom, #2a2a2a, #111)', border: '2px solid #c5a059', boxShadow: 'inset 0 0 10px #000, 0 0 10px rgba(0,0,0,0.8)', maxWidth: 520, position: 'relative' }}
                data-testid="panel-dungeon-hotbar"
              >
                <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-[#c5a059] border border-white/30" />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#c5a059] border border-white/30" />

                <div className="flex items-center gap-2 mb-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-full h-2 bg-[#300] rounded-sm overflow-hidden" style={{ width: 110 }}>
                      <div className="h-full bg-red-600 transition-all" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} data-testid="bar-dungeon-hp" />
                    </div>
                    <span className="text-[10px] text-red-400">{Math.floor(hud.hp)}/{hud.maxHp}</span>
                  </div>
                  <span className="text-sm text-[#c5a059] font-bold">Lv{hud.level}</span>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-full h-2 bg-[#003] rounded-sm overflow-hidden" style={{ width: 110 }}>
                      <div className="h-full bg-blue-600 transition-all" style={{ width: `${(hud.mp / hud.maxMp) * 100}%` }} data-testid="bar-dungeon-mp" />
                    </div>
                    <span className="text-[10px] text-blue-400">{Math.floor(hud.mp)}/{hud.maxMp}</span>
                  </div>
                </div>

                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-yellow-500 transition-all" style={{ width: `${(hud.xp / hud.xpToNext) * 100}%` }} data-testid="bar-dungeon-xp" />
                </div>

                <div className="flex gap-1">
                  {abilities.map((ab, i) => {
                    const cd = hud.abilityCooldowns[i] || 0;
                    const onCd = cd > 0;
                    return (
                      <button
                        key={i}
                        className="relative flex items-center justify-center font-bold text-white transition-all hover:scale-105"
                        style={{
                          width: 46, height: 46,
                          background: onCd ? '#222' : CLASS_COLORS[hud.heroClass] || '#333',
                          border: `2px solid ${onCd ? '#444' : '#c5a059'}`,
                          boxShadow: 'inset 0 0 5px #000',
                          opacity: onCd ? 0.5 : 1, cursor: 'pointer'
                        }}
                        onClick={() => stateRef.current && handleDungeonAbility(stateRef.current, i)}
                        title={`${ab.name}: ${ab.description}`}
                        data-testid={`button-dungeon-ability-${i}`}
                      >
                        <span className="absolute top-0.5 left-1 text-[10px] text-gray-400">{ab.key}</span>
                        <span className="text-xs">{ab.name.charAt(0)}</span>
                        {onCd && <span className="absolute text-[10px] text-white">{Math.ceil(cd)}</span>}
                      </button>
                    );
                  })}
                  <div className="w-px bg-gray-700 mx-1" />
                  {hud.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center text-[9px]"
                      style={{
                        width: 34, height: 46,
                        background: item ? '#1a1a2e' : '#000',
                        border: `2px solid ${item ? '#c5a059' : '#333'}`,
                        boxShadow: 'inset 0 0 5px #000',
                        color: item ? '#c5a059' : '#444'
                      }}
                      title={item?.name}
                      data-testid={`slot-dungeon-item-${i}`}
                    >
                      {item ? item.name.split(' ').map(w => w[0]).join('') : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1" style={{ width: 180 }}>
              <div
                className="w-full p-2 flex gap-2"
                style={{ height: 100, background: 'linear-gradient(to bottom, #2a2a2a, #111)', border: '2px solid #c5a059', boxShadow: 'inset 0 0 10px #000', position: 'relative' }}
                data-testid="panel-dungeon-stats"
              >
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-[#c5a059] border border-white/30" />
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#c5a059] border border-white/30" />
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-black border border-[#c5a059] flex items-center justify-center text-xs" style={{ color: CLASS_COLORS[hud.heroClass] }}>
                    {hud.heroClass.charAt(0)}
                  </div>
                  <span className="text-[10px] text-yellow-500 font-bold">{hud.gold}g</span>
                </div>
                <div className="flex-1 text-[10px] text-gray-400">
                  <div className="border-b border-gray-700 mb-1 pb-1 text-gray-300 font-bold truncate">{hud.heroName.split(' ').pop()}</div>
                  <div>ATK: <span className="text-yellow-400">{hud.atk}</span></div>
                  <div>DEF: <span className="text-blue-400">{hud.def}</span></div>
                  <div>SPD: <span className="text-green-400">{hud.spd}</span></div>
                </div>
              </div>
            </div>
          </div>

          {hud.gameOver && <DungeonGameOver hud={hud} onReturn={() => setLocation('/')} />}
        </div>
      )}
    </div>
  );
}

function DungeonGameOver({ hud, onReturn }: { hud: DungeonHudState; onReturn: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto" data-testid="panel-dungeon-game-over">
      <div className="text-center">
        <h1
          className="text-5xl font-black mb-4"
          style={{
            fontFamily: "'Oxanium', sans-serif",
            color: hud.gameWon ? '#ffd700' : '#ef4444',
            textShadow: `0 0 60px ${hud.gameWon ? 'rgba(255,215,0,0.5)' : 'rgba(239,68,68,0.5)'}`
          }}
          data-testid="text-dungeon-result"
        >
          {hud.gameWon ? 'DUNGEON CLEARED!' : 'DEFEATED'}
        </h1>
        <p className="text-gray-400 text-lg mb-2">{hud.heroName}</p>
        <div className="flex gap-6 justify-center mb-6 text-lg">
          <span className="text-[#c5a059]">Floor <span className="text-2xl font-bold">{hud.floor}</span></span>
          <span className="text-green-400">Kills <span className="text-2xl font-bold">{hud.kills}</span></span>
          <span className="text-yellow-400">Gold <span className="text-2xl font-bold">{hud.gold}</span></span>
        </div>
        <button
          className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-lg hover:from-red-500 hover:to-red-700 transition-all cursor-pointer"
          style={{ fontFamily: "'Oxanium', sans-serif" }}
          onClick={onReturn}
          data-testid="button-dungeon-return"
        >
          RETURN TO MENU
        </button>
      </div>
    </div>
  );
}
