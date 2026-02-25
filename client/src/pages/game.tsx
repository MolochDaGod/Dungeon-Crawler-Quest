import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  MobaState, HudState, HEROES, ITEMS, CLASS_ABILITIES,
  TEAM_COLORS, TEAM_NAMES, CLASS_COLORS, RARITY_COLORS,
  ItemDef
} from '@/game/types';
import {
  createInitialState, updateGame, getHudState,
  MobaRenderer, handlePlayerAbility, handlePlayerAttack,
  handleRightClick, buyItem
} from '@/game/engine';

export default function GamePage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<MobaState | null>(null);
  const rendererRef = useRef<MobaRenderer | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const [hud, setHud] = useState<HudState | null>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; camStartX: number; camStartY: number }>({
    active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0
  });

  const heroId = parseInt(localStorage.getItem('grudge_hero_id') || '-1');
  const team = parseInt(localStorage.getItem('grudge_team') || '0');

  useEffect(() => {
    if (heroId < 0) {
      setLocation('/');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const state = createInitialState(heroId, team);
    stateRef.current = state;
    const renderer = new MobaRenderer(canvas);
    rendererRef.current = renderer;

    let lastTime = performance.now();
    let hudTimer = 0;
    let animId = 0;

    const gameLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;

      updateGame(state, dt, keysRef.current);
      renderer.render(state);

      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        setHud(getHudState(state));
      }

      animId = requestAnimationFrame(gameLoop);
    };
    animId = requestAnimationFrame(gameLoop);

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      if (key === 'q') handlePlayerAbility(state, 0);
      if (key === 'w' && e.shiftKey) handlePlayerAbility(state, 1);
      if (key === 'e') handlePlayerAbility(state, 2);
      if (key === 'r') handlePlayerAbility(state, 3);
      if (key === ' ') handlePlayerAttack(state);
      if (key === 'b') state.showShop = !state.showShop;
      if (key === 'tab') { e.preventDefault(); state.showScoreboard = true; }
      if (key === 'escape') {
        state.showShop = false;
        state.showScoreboard = false;
        state.paused = !state.paused;
      }
      if (key === 'f1') {
        const player = state.heroes[state.playerHeroIndex];
        if (player) { state.camera.x = player.x; state.camera.y = player.y; }
      }

      if (key >= '1' && key <= '4') {
        handlePlayerAbility(state, parseInt(key) - 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'tab') {
        state.showScoreboard = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldX = (sx - canvas.width / 2) / state.camera.zoom + state.camera.x;
      const worldY = (sy - canvas.height / 2) / state.camera.zoom + state.camera.y;
      handleRightClick(state, worldX, worldY);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        handlePlayerAttack(state);
      }
      if (e.button === 1) {
        e.preventDefault();
        panRef.current = {
          active: true,
          startX: e.clientX, startY: e.clientY,
          camStartX: state.camera.x, camStartY: state.camera.y
        };
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) panRef.current.active = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      state.mouseWorld.x = (sx - canvas.width / 2) / state.camera.zoom + state.camera.x;
      state.mouseWorld.y = (sy - canvas.height / 2) / state.camera.zoom + state.camera.y;

      if (panRef.current.active) {
        const dx = (e.clientX - panRef.current.startX) / state.camera.zoom;
        const dy = (e.clientY - panRef.current.startY) / state.camera.zoom;
        state.camera.x = panRef.current.camStartX - dx;
        state.camera.y = panRef.current.camStartY - dy;
      }
    };

    const onWheel = (e: WheelEvent) => {
      state.camera.zoom = Math.max(0.4, Math.min(2, state.camera.zoom - e.deltaY * 0.001));
    };

    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [heroId, team, setLocation]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const heroData = HEROES.find(h => h.id === heroId);
  const abilities = heroData ? CLASS_ABILITIES[heroData.heroClass] || [] : [];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" data-testid="game-page">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" data-testid="canvas-game" />

      {hud && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999, fontFamily: "'Oxanium', sans-serif" }}>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3 bg-black/70 px-4 py-2 rounded-b-lg border border-t-0 border-[#c5a059]/40" data-testid="panel-top-bar">
            <span className="text-sm text-blue-400 font-bold" data-testid="text-team-score">
              {hud.allHeroes.filter(h => h.team === 0).reduce((s, h) => s + h.kills, 0)}
            </span>
            <span className="text-xs text-gray-500">vs</span>
            <span className="text-sm text-red-400 font-bold">
              {hud.allHeroes.filter(h => h.team === 1).reduce((s, h) => s + h.kills, 0)}
            </span>
            <span className="text-xs text-[#c5a059] ml-2" data-testid="text-game-time">{formatTime(hud.gameTime)}</span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex items-end p-2.5 gap-2.5 pointer-events-auto">

            <div className="flex flex-col gap-1" style={{ width: 240 }}>
              <div
                className="p-2 flex flex-col text-xs text-gray-400 overflow-y-auto"
                style={{
                  height: 130,
                  background: 'linear-gradient(to bottom, #2a2a2a, #111)',
                  border: '2px solid #c5a059',
                  boxShadow: 'inset 0 0 10px #000, 0 0 10px rgba(0,0,0,0.8)'
                }}
                data-testid="panel-chat"
              >
                <div style={{ color: '#c5a059' }}>[System]: MOBA battle started!</div>
                <div style={{ color: '#c5a059' }}>[System]: Destroy the enemy nexus to win.</div>
                {hud.killFeed.slice(-6).map((k, i) => (
                  <div key={i} style={{ color: k.color }}>{k.text}</div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <div
                className="flex flex-col items-center gap-1 p-3"
                style={{
                  background: 'linear-gradient(to bottom, #2a2a2a, #111)',
                  border: '2px solid #c5a059',
                  boxShadow: 'inset 0 0 10px #000, 0 0 10px rgba(0,0,0,0.8)',
                  maxWidth: 550,
                  position: 'relative'
                }}
                data-testid="panel-hotbar"
              >
                <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-[#c5a059] border border-white/30 shadow-[0_0_3px_gold]" />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#c5a059] border border-white/30 shadow-[0_0_3px_gold]" />

                <div className="flex items-center gap-2 mb-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-full h-2 bg-[#300] rounded-sm overflow-hidden" style={{ width: 120 }}>
                      <div className="h-full bg-red-600 transition-all" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} data-testid="bar-hp" />
                    </div>
                    <span className="text-[10px] text-red-400">{Math.floor(hud.hp)}/{hud.maxHp}</span>
                  </div>
                  <span className="text-sm text-[#c5a059] font-bold" data-testid="text-hero-level">Lv{hud.level}</span>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-full h-2 bg-[#003] rounded-sm overflow-hidden" style={{ width: 120 }}>
                      <div className="h-full bg-blue-600 transition-all" style={{ width: `${(hud.mp / hud.maxMp) * 100}%` }} data-testid="bar-mp" />
                    </div>
                    <span className="text-[10px] text-blue-400">{Math.floor(hud.mp)}/{hud.maxMp}</span>
                  </div>
                </div>

                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-yellow-500 transition-all" style={{ width: `${(hud.xp / hud.xpToNext) * 100}%` }} data-testid="bar-xp" />
                </div>

                {hud.activeEffects.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center mb-1" data-testid="panel-active-effects">
                    {hud.activeEffects.map((eff, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold"
                        style={{
                          background: `${eff.color}22`,
                          border: `1px solid ${eff.color}66`,
                          color: eff.color
                        }}
                        title={`${eff.name} (${eff.remaining.toFixed(1)}s)`}
                        data-testid={`effect-${eff.name}-${i}`}
                      >
                        {eff.name}{eff.stacks > 1 ? ` x${eff.stacks}` : ''} {eff.remaining.toFixed(1)}s
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1">
                  {abilities.map((ab, i) => {
                    const cd = hud.abilityCooldowns[i] || 0;
                    const onCd = cd > 0;
                    return (
                      <button
                        key={i}
                        className="relative flex items-center justify-center font-bold text-white transition-all hover:scale-105"
                        style={{
                          width: 48, height: 48,
                          background: onCd ? '#222' : CLASS_COLORS[hud.heroClass] || '#333',
                          border: `2px solid ${onCd ? '#444' : '#c5a059'}`,
                          boxShadow: 'inset 0 0 5px #000',
                          opacity: onCd ? 0.5 : 1,
                          cursor: 'pointer'
                        }}
                        onClick={() => stateRef.current && handlePlayerAbility(stateRef.current, i)}
                        title={`${ab.name}: ${ab.description}`}
                        data-testid={`button-ability-${i}`}
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
                        width: 36, height: 48,
                        background: item ? '#1a1a2e' : '#000',
                        border: `2px solid ${item ? '#c5a059' : '#333'}`,
                        boxShadow: 'inset 0 0 5px #000',
                        color: item ? '#c5a059' : '#444'
                      }}
                      title={item?.name}
                      data-testid={`slot-item-${i}`}
                    >
                      {item ? item.name.split(' ').map(w => w[0]).join('') : (i + 1)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1" style={{ width: 200 }}>
              <div className="flex gap-1 mb-[-10px] z-10 pr-2">
                <button
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[#c5a059] border-2 border-[#c5a059] bg-gradient-to-b from-gray-700 to-black shadow-lg hover:bg-gray-600 cursor-pointer pointer-events-auto text-xs"
                  onClick={() => stateRef.current && (stateRef.current.showShop = !stateRef.current.showShop)}
                  title="Shop (B)"
                  data-testid="button-shop"
                >B</button>
                <button
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[#c5a059] border-2 border-[#c5a059] bg-gradient-to-b from-gray-700 to-black shadow-lg hover:bg-gray-600 cursor-pointer pointer-events-auto text-xs"
                  onClick={() => stateRef.current && (stateRef.current.showScoreboard = !stateRef.current.showScoreboard)}
                  title="Scoreboard (Tab)"
                  data-testid="button-scoreboard"
                >S</button>
              </div>
              <div
                className="w-full p-2 flex gap-2"
                style={{
                  height: 110,
                  background: 'linear-gradient(to bottom, #2a2a2a, #111)',
                  border: '2px solid #c5a059',
                  boxShadow: 'inset 0 0 10px #000, 0 0 10px rgba(0,0,0,0.8)',
                  position: 'relative'
                }}
                data-testid="panel-stats"
              >
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-[#c5a059] border border-white/30" />
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#c5a059] border border-white/30" />
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-black border border-[#c5a059] flex items-center justify-center text-xs" style={{ color: CLASS_COLORS[hud.heroClass] }}>
                    {hud.heroClass.charAt(0)}
                  </div>
                  <span className="text-[10px] text-yellow-500 font-bold" data-testid="text-gold">{hud.gold}g</span>
                </div>
                <div className="flex-1 text-[10px] text-gray-400">
                  <div className="border-b border-gray-700 mb-1 pb-1 text-gray-300 font-bold truncate">{hud.heroName.split(' ').pop()}</div>
                  <div>ATK: <span className="text-yellow-400">{hud.atk}</span></div>
                  <div>DEF: <span className="text-blue-400">{hud.def}</span></div>
                  <div>SPD: <span className="text-green-400">{hud.spd}</span></div>
                  <div className="mt-1 text-gray-500">
                    <span className="text-green-400">{hud.kills}</span>/
                    <span className="text-red-400">{hud.deaths}</span>/
                    <span className="text-yellow-400">{hud.assists}</span> KDA
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hud.showShop && <ShopPanel hud={hud} onBuy={(id) => stateRef.current && buyItem(stateRef.current, id)} onClose={() => stateRef.current && (stateRef.current.showShop = false)} />}
          {hud.showScoreboard && <Scoreboard hud={hud} />}
          {hud.gameOver && <GameOverScreen hud={hud} onReturn={() => setLocation('/')} />}
        </div>
      )}
    </div>
  );
}

function ShopPanel({ hud, onBuy, onClose }: { hud: HudState; onBuy: (id: number) => void; onClose: () => void }) {
  const tiers = [1, 2, 3];
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto" data-testid="panel-shop">
      <div
        className="p-4 rounded-lg max-h-[80vh] overflow-y-auto"
        style={{
          width: 500,
          background: 'linear-gradient(to bottom, #1a1a2e, #0a0a15)',
          border: '2px solid #c5a059',
          boxShadow: '0 0 30px rgba(0,0,0,0.8)'
        }}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg text-[#c5a059] font-bold" style={{ fontFamily: "'Oxanium', sans-serif" }}>ITEM SHOP</h2>
          <div className="flex items-center gap-3">
            <span className="text-yellow-500 text-sm font-bold" data-testid="text-shop-gold">{hud.gold}g</span>
            <button className="text-gray-400 hover:text-white text-xl cursor-pointer" onClick={onClose} data-testid="button-close-shop">&times;</button>
          </div>
        </div>
        {tiers.map(tier => (
          <div key={tier} className="mb-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tier {tier}</h3>
            <div className="grid grid-cols-2 gap-2">
              {ITEMS.filter(i => i.tier === tier).map(item => {
                const canBuy = hud.gold >= item.cost && hud.items.some(s => s === null);
                return (
                  <button
                    key={item.id}
                    className={`text-left p-2 rounded border transition-all ${canBuy ? 'border-[#c5a059]/50 hover:border-[#c5a059] cursor-pointer' : 'border-gray-800 opacity-40 cursor-not-allowed'}`}
                    style={{ background: '#111' }}
                    onClick={() => canBuy && onBuy(item.id)}
                    data-testid={`button-buy-item-${item.id}`}
                  >
                    <div className="flex justify-between">
                      <span className="text-xs text-white font-bold">{item.name}</span>
                      <span className="text-xs text-yellow-500">{item.cost}g</span>
                    </div>
                    <p className="text-[10px] text-gray-500">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Scoreboard({ hud }: { hud: HudState }) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto" data-testid="panel-scoreboard">
      <div
        className="p-4 rounded-lg"
        style={{
          width: 600,
          background: 'linear-gradient(to bottom, #1a1a2e, #0a0a15)',
          border: '2px solid #c5a059',
          boxShadow: '0 0 30px rgba(0,0,0,0.8)'
        }}
      >
        <h2 className="text-lg text-[#c5a059] font-bold mb-3 text-center" style={{ fontFamily: "'Oxanium', sans-serif" }}>SCOREBOARD</h2>
        {[0, 1].map(t => (
          <div key={t} className="mb-3">
            <h3 className="text-xs font-bold mb-1" style={{ color: TEAM_COLORS[t] }}>{TEAM_NAMES[t]}</h3>
            <div className="space-y-1">
              {hud.allHeroes.filter(h => h.team === t).map((h, i) => (
                <div key={i} className="flex items-center gap-3 bg-black/30 px-3 py-1.5 rounded text-xs">
                  <span className="flex-1 text-gray-300 truncate">{h.name}</span>
                  <span className="text-gray-500">Lv{h.level}</span>
                  <span className="text-green-400 w-6 text-center">{h.kills}</span>
                  <span className="text-gray-600">/</span>
                  <span className="text-red-400 w-6 text-center">{h.deaths}</span>
                  <span className="text-gray-600">/</span>
                  <span className="text-yellow-400 w-6 text-center">{h.assists}</span>
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(h.hp / h.maxHp) * 100}%`, backgroundColor: TEAM_COLORS[t] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-center text-[10px] text-gray-600 mt-2">Hold TAB to view</p>
      </div>
    </div>
  );
}

function GameOverScreen({ hud, onReturn }: { hud: HudState; onReturn: () => void }) {
  const won = hud.winner === hud.team;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto" data-testid="panel-game-over">
      <div className="text-center">
        <h1
          className="text-6xl font-black mb-4"
          style={{
            fontFamily: "'Oxanium', sans-serif",
            color: won ? '#ffd700' : '#ef4444',
            textShadow: `0 0 60px ${won ? 'rgba(255,215,0,0.5)' : 'rgba(239,68,68,0.5)'}`
          }}
          data-testid="text-game-result"
        >
          {won ? 'VICTORY' : 'DEFEAT'}
        </h1>
        <p className="text-gray-400 text-lg mb-2">
          {hud.heroName} &mdash; {hud.heroTitle || ''}
        </p>
        <div className="flex gap-8 justify-center mb-6 text-lg">
          <span className="text-green-400"><span className="text-2xl font-bold">{hud.kills}</span> Kills</span>
          <span className="text-red-400"><span className="text-2xl font-bold">{hud.deaths}</span> Deaths</span>
          <span className="text-yellow-400"><span className="text-2xl font-bold">{hud.assists}</span> Assists</span>
        </div>
        <p className="text-gray-500 mb-6">Game Time: {Math.floor(hud.gameTime / 60)}m {Math.floor(hud.gameTime % 60)}s</p>
        <button
          className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-lg hover:from-red-500 hover:to-red-700 transition-all cursor-pointer"
          style={{ fontFamily: "'Oxanium', sans-serif" }}
          onClick={onReturn}
          data-testid="button-return-home"
        >
          RETURN TO MENU
        </button>
      </div>
    </div>
  );
}
