import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  HEROES, CLASS_COLORS, RACE_COLORS, ABILITY_ICONS, getHeroAbilities
} from '@/game/types';
import {
  OpenWorldState, OWHudState,
  createOpenWorldState, updateOpenWorld, getOWHudState,
  OpenWorldRenderer, handleOWAbility, handleOWAttack,
  updateOWMouseWorld, startOWTargeting, confirmOWTargeting, cancelOWTargeting
} from '@/game/open-world';
import { renderMinimap, createMinimapConfig, minimapZoomIn, minimapZoomOut, MinimapConfig } from '@/game/minimap';
import { ProgressEvent } from '@/game/player-progress';
import { loadKeybindings, matchesKeyDown, KeybindAction } from '@/game/keybindings';
import hudFramePath from '@assets/hud-frame.png';

export default function OpenWorldPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OpenWorldState | null>(null);
  const rendererRef = useRef<OpenWorldRenderer | null>(null);
  const minimapRef = useRef<MinimapConfig>(createMinimapConfig());
  const keysRef = useRef<Set<string>>(new Set());
  const [hud, setHud] = useState<OWHudState | null>(null);
  const [notifications, setNotifications] = useState<{ text: string; color: string; time: number }[]>([]);
  const [zoneBanner, setZoneBanner] = useState<string | null>(null);
  const zoneBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heroId = parseInt(localStorage.getItem('grudge_hero_id') || '-1');

  useEffect(() => {
    if (heroId < 0) { setLocation('/'); return; }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const state = createOpenWorldState(heroId);
    stateRef.current = state;
    const renderer = new OpenWorldRenderer(canvas);
    rendererRef.current = renderer;

    let lastTime = performance.now();
    let hudTimer = 0;
    let lastZoneName = '';
    let animId = 0;

    const gameLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;

      updateOpenWorld(state, dt, keysRef.current);
      renderer.render(state);

      // Render minimap on top
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderMinimap(ctx, state, minimapRef.current, canvas.width, canvas.height);
      }

      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        const hudState = getOWHudState(state);
        setHud(hudState);

        // Zone banner
        if (hudState.zoneName !== lastZoneName && hudState.zoneName !== 'Wilderness') {
          lastZoneName = hudState.zoneName;
          setZoneBanner(hudState.zoneName);
          if (zoneBannerTimer.current) clearTimeout(zoneBannerTimer.current);
          zoneBannerTimer.current = setTimeout(() => setZoneBanner(null), 3000);
        }

        // Progress events → notifications
        if (hudState.pendingEvents.length > 0) {
          setNotifications(prev => [
            ...prev,
            ...hudState.pendingEvents.map(e => ({
              text: `${e.title}: ${e.description}`,
              color: e.type === 'achievement' ? '#ffd700' : e.type === 'zone_discover' ? '#22c55e' : '#c5a059',
              time: Date.now(),
            })),
          ].slice(-6));
        }
      }
      animId = requestAnimationFrame(gameLoop);
    };
    animId = requestAnimationFrame(gameLoop);

    const bindings = loadKeybindings();

    const tryTargetOrCast = (abilityIndex: number) => {
      const hd = HEROES[state.player.heroDataId];
      const abs = getHeroAbilities(hd.race, hd.heroClass);
      const ab = abs[abilityIndex];
      if (ab && (ab.castType === 'ground_aoe' || ab.castType === 'skillshot' || ab.castType === 'cone' || ab.castType === 'line')) {
        startOWTargeting(state, abilityIndex);
      } else {
        handleOWAbility(state, abilityIndex);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      if (key === 'escape') {
        if (state.targeting.active) { cancelOWTargeting(state); return; }
        setLocation('/');
        return;
      }

      if (matchesKeyDown(bindings[KeybindAction.Ability1], e)) { e.preventDefault(); tryTargetOrCast(0); }
      else if (matchesKeyDown(bindings[KeybindAction.Ability2], e)) { e.preventDefault(); tryTargetOrCast(1); }
      else if (matchesKeyDown(bindings[KeybindAction.Ability3], e)) { e.preventDefault(); tryTargetOrCast(2); }
      else if (matchesKeyDown(bindings[KeybindAction.Ability4], e)) { e.preventDefault(); tryTargetOrCast(3); }
      if (matchesKeyDown(bindings[KeybindAction.Attack], e)) handleOWAttack(state);
      if (key === 'i') state.showInventory = !state.showInventory;
      if (key === '=') minimapZoomIn(minimapRef.current);
      if (key === '-') minimapZoomOut(minimapRef.current);
    };

    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };

    const onClick = (e: MouseEvent) => {
      if (e.button === 0) {
        if (state.targeting.active) confirmOWTargeting(state);
        else handleOWAttack(state);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (state.targeting.active) cancelOWTargeting(state);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateOWMouseWorld(state, e.clientX, e.clientY, canvas.width, canvas.height);
    };

    const onWheel = (e: WheelEvent) => {
      state.camera.zoom = Math.max(0.6, Math.min(2.5, state.camera.zoom - e.deltaY * 0.001));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);

    return () => {
      cancelAnimationFrame(animId);
      if (zoneBannerTimer.current) clearTimeout(zoneBannerTimer.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [heroId, setLocation]);

  // Clean up old notifications
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => prev.filter(n => Date.now() - n.time < 5000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const heroData = HEROES.find(h => h.id === heroId);
  const abilities = heroData ? getHeroAbilities(heroData.race, heroData.heroClass) : [];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" data-testid="open-world-page">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" data-testid="canvas-openworld" />

      {hud && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999, fontFamily: "'Oxanium', sans-serif" }}>

          {/* Top-Left: World time, weather, day/night */}
          <div className="absolute top-3 left-3 pointer-events-auto flex flex-col" style={{ gap: 4 }}>
            <div
              style={{
                background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))',
                border: '1px solid #c5a059',
                borderRadius: 6,
                padding: '6px 12px',
              }}
            >
              <div className="flex items-center" style={{ gap: 8 }}>
                <span style={{ fontSize: 18 }}>{hud.isDayTime ? '☀️' : '🌙'}</span>
                <span className="text-sm font-bold text-[#c5a059]">{hud.worldTime}</span>
                <span style={{ fontSize: 14 }}>{hud.weatherIcon}</span>
                <span className="text-xs text-gray-400">{hud.weatherLabel}</span>
              </div>
            </div>

            {/* Zone info */}
            <div
              style={{
                background: 'linear-gradient(to bottom, rgba(15,10,5,0.9), rgba(10,5,0,0.8))',
                border: `1px solid ${hud.zonePvP ? '#ef4444' : hud.zoneSafe ? '#22c55e' : '#c5a059'}`,
                borderRadius: 4,
                padding: '4px 10px',
              }}
            >
              <span className="text-xs font-bold" style={{ color: hud.zonePvP ? '#ef4444' : hud.zoneSafe ? '#22c55e' : '#f59e0b' }}>
                {hud.zoneName}
              </span>
              {hud.zonePvP && <span className="text-[9px] text-red-500 ml-2">⚔ PVP</span>}
              {hud.zoneSafe && <span className="text-[9px] text-green-500 ml-2">🛡 SAFE</span>}
            </div>

            {/* Player progress */}
            <div
              style={{
                background: 'linear-gradient(to bottom, rgba(15,10,5,0.9), rgba(10,5,0,0.8))',
                border: '1px solid #333',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 10,
              }}
            >
              <div style={{ color: hud.reputationColor }}>
                <span className="font-bold">{hud.reputationRank}</span>
                <span className="text-gray-500 ml-1">({hud.reputation} rep)</span>
              </div>
              <div className="text-gray-500">
                {hud.zonesDiscovered}/8 zones • {hud.monstersSlain} kills • {hud.bossesDefeated} bosses
              </div>
            </div>
          </div>

          {/* Top-Center: Zone banner (fades in on zone change) */}
          {zoneBanner && (
            <div
              className="absolute top-8 left-1/2 -translate-x-1/2"
              style={{
                background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))',
                border: '2px solid #c5a059',
                borderRadius: 8,
                padding: '10px 32px',
                boxShadow: '0 4px 30px rgba(0,0,0,0.8)',
              }}
            >
              <div className="text-xl font-black text-[#c5a059] text-center" style={{ textShadow: '0 0 20px rgba(197,160,89,0.4)' }}>
                {zoneBanner}
              </div>
            </div>
          )}

          {/* World Boss Alert */}
          {hud.worldBossActive && (
            <div
              className="absolute top-20 left-1/2 -translate-x-1/2"
              style={{
                background: 'linear-gradient(to bottom, rgba(60,10,10,0.95), rgba(30,5,5,0.9))',
                border: '2px solid #ef4444',
                borderRadius: 6,
                padding: '6px 20px',
                boxShadow: '0 0 20px rgba(239,68,68,0.4)',
              }}
            >
              <div className="text-sm font-black text-red-400 text-center">{hud.worldBossName}</div>
              <div className="h-2 rounded-full overflow-hidden mt-1" style={{ width: 200, background: '#300' }}>
                <div className="h-full" style={{ width: `${(hud.worldBossHp / hud.worldBossMaxHp) * 100}%`, background: 'linear-gradient(to right, #dc2626, #f87171)' }} />
              </div>
            </div>
          )}

          {/* Right side: Notifications */}
          <div className="absolute top-20 right-4 flex flex-col" style={{ gap: 4, width: 280 }}>
            {notifications.map((n, i) => {
              const age = (Date.now() - n.time) / 1000;
              const opacity = age > 4 ? Math.max(0, 1 - (age - 4)) : 1;
              return (
                <div
                  key={n.time + i}
                  className="text-xs font-bold px-3 py-2 rounded"
                  style={{
                    background: 'rgba(10,10,20,0.9)',
                    border: `1px solid ${n.color}50`,
                    color: n.color,
                    opacity,
                    transition: 'opacity 0.5s',
                  }}
                >
                  {n.text}
                </div>
              );
            })}
          </div>

          {/* Active effects bar */}
          {hud.activeEffects.length > 0 && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-1">
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

          {/* Bottom HUD */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end pointer-events-auto" style={{ padding: '0 8px 8px 8px', gap: 8 }}>
            {/* Kill Feed */}
            <div className="flex flex-col" style={{ width: 200, flexShrink: 0 }}>
              <div
                className="flex flex-col text-xs overflow-y-auto"
                style={{
                  height: 120,
                  background: 'linear-gradient(to bottom, rgba(20,15,10,0.95), rgba(8,5,0,0.95))',
                  border: '1px solid #c5a059',
                  borderRadius: 4,
                  padding: '8px 10px',
                  boxShadow: '0 0 20px rgba(0,0,0,0.9)',
                }}
              >
                <div style={{ color: '#c5a059', fontSize: 10, marginBottom: 4 }}>WORLD LOG</div>
                {hud.killFeed.slice(-6).map((k, i) => (
                  <div key={i} style={{ color: k.color, fontSize: 10, lineHeight: 1.4 }}>{k.text}</div>
                ))}
              </div>
            </div>

            {/* Center: HP/MP + Abilities */}
            <div className="flex-1 flex justify-center" style={{ minWidth: 0 }}>
              <div
                className="flex flex-col items-center relative"
                style={{
                  background: 'linear-gradient(to bottom, rgba(20,15,10,0.96), rgba(8,5,0,0.96))',
                  border: '2px solid #c5a059',
                  borderRadius: 6,
                  padding: '10px 14px 8px 14px',
                  maxWidth: 540,
                  width: '100%',
                  boxShadow: '0 -4px 30px rgba(0,0,0,0.9)',
                  backgroundImage: `url(${hudFramePath})`,
                  backgroundSize: '100% 100%',
                  backgroundBlendMode: 'overlay',
                }}
              >
                <div className="flex items-center w-full mb-1.5" style={{ gap: 8 }}>
                  <div className="flex items-center" style={{ gap: 4, flex: 1 }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black"
                      style={{
                        background: `linear-gradient(135deg, ${CLASS_COLORS[hud.heroClass] || '#333'}, ${CLASS_COLORS[hud.heroClass] || '#333'}88)`,
                        border: '2px solid #c5a059',
                        color: '#fff',
                      }}
                    >
                      {hud.heroClass.charAt(0)}
                    </div>
                    <div className="flex flex-col" style={{ gap: 2, flex: 1 }}>
                      <div className="flex items-center" style={{ gap: 4 }}>
                        <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#200', border: '1px solid #500' }}>
                          <div className="h-full transition-all" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: 'linear-gradient(to right, #b91c1c, #ef4444)' }} />
                        </div>
                        <span className="text-[9px] text-red-300 w-16 text-right">{Math.floor(hud.hp)}/{hud.maxHp}</span>
                      </div>
                      <div className="flex items-center" style={{ gap: 4 }}>
                        <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#002', border: '1px solid #005' }}>
                          <div className="h-full transition-all" style={{ width: `${(hud.mp / hud.maxMp) * 100}%`, background: 'linear-gradient(to right, #1e40af, #3b82f6)' }} />
                        </div>
                        <span className="text-[9px] text-blue-300 w-16 text-right">{Math.floor(hud.mp)}/{hud.maxMp}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center" style={{ gap: 1 }}>
                    <span className="text-sm text-[#c5a059] font-black">Lv{hud.level}</span>
                    <div className="h-1 rounded-full overflow-hidden" style={{ width: 40, background: '#333' }}>
                      <div className="h-full transition-all" style={{ width: `${(hud.xp / hud.xpToNext) * 100}%`, background: 'linear-gradient(to right, #ca8a04, #eab308)' }} />
                    </div>
                  </div>
                </div>

                {/* Abilities */}
                <div className="flex items-center" style={{ gap: 4 }}>
                  {abilities.map((ab, i) => {
                    const cd = hud.abilityCooldowns[i] || 0;
                    const onCd = cd > 0;
                    return (
                      <button
                        key={i}
                        className="relative flex items-center justify-center font-bold text-white overflow-hidden"
                        style={{
                          width: 50, height: 50,
                          background: onCd ? 'linear-gradient(135deg, #1a1a1a, #0a0a0a)' : `linear-gradient(135deg, ${CLASS_COLORS[hud.heroClass] || '#333'}, ${CLASS_COLORS[hud.heroClass] || '#333'}88)`,
                          border: `2px solid ${onCd ? '#333' : '#c5a059'}`,
                          borderRadius: 4,
                          opacity: onCd ? 0.6 : 1,
                          cursor: 'pointer',
                        }}
                        onClick={() => stateRef.current && handleOWAbility(stateRef.current, i)}
                        title={`${ab.name}: ${ab.description}`}
                      >
                        {ABILITY_ICONS[ab.name] ? (
                          <img
                            src={ABILITY_ICONS[ab.name]}
                            alt={ab.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ filter: onCd ? 'grayscale(100%) brightness(0.4)' : 'none' }}
                            draggable={false}
                          />
                        ) : (
                          <span className="text-xs font-black" style={{ textShadow: '0 1px 2px #000' }}>{ab.name.substring(0, 2)}</span>
                        )}
                        <span className="absolute text-[9px] font-bold z-10" style={{ top: 2, left: 4, color: '#ddd', textShadow: '0 0 3px #000, 0 0 3px #000' }}>{ab.key}</span>
                        {onCd && (
                          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(0,0,0,0.5)' }}>
                            <span className="text-sm font-black text-white" style={{ textShadow: '0 0 4px #000' }}>{Math.ceil(cd)}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, #c5a059, transparent)', margin: '0 4px' }} />
                  {hud.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center"
                      style={{
                        width: 38, height: 50,
                        background: item ? 'linear-gradient(135deg, #1a1a2e, #0a0a15)' : 'linear-gradient(135deg, #0a0a0a, #050505)',
                        border: `1px solid ${item ? '#c5a05980' : '#222'}`,
                        borderRadius: 3,
                        color: item ? '#c5a059' : '#333',
                        fontSize: 9,
                        fontWeight: 'bold',
                      }}
                      title={item?.name}
                    >
                      {item ? item.name.split(' ').map(w => w[0]).join('') : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="flex flex-col items-end" style={{ width: 180, flexShrink: 0 }}>
              <div
                className="w-full flex"
                style={{
                  background: 'linear-gradient(to bottom, rgba(20,15,10,0.95), rgba(8,5,0,0.95))',
                  border: '1px solid #c5a059',
                  borderRadius: 4,
                  padding: '8px 10px',
                  gap: 10,
                }}
              >
                <div className="flex flex-col items-center" style={{ gap: 4 }}>
                  <div className="rounded-lg flex items-center justify-center text-sm font-black"
                    style={{
                      width: 38, height: 38,
                      background: `linear-gradient(135deg, ${CLASS_COLORS[hud.heroClass] || '#333'}, #111)`,
                      border: '2px solid #c5a059',
                      color: '#fff',
                    }}
                  >
                    {hud.heroClass.charAt(0)}
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>{hud.gold}g</span>
                </div>
                <div className="flex-1" style={{ fontSize: 10 }}>
                  <div className="font-bold truncate" style={{ color: '#c5a059', fontSize: 11, marginBottom: 4, borderBottom: '1px solid #333', paddingBottom: 3 }}>{hud.heroName}</div>
                  <div style={{ color: '#888' }}>ATK <span className="font-bold" style={{ color: '#fbbf24' }}>{hud.atk}</span></div>
                  <div style={{ color: '#888' }}>DEF <span className="font-bold" style={{ color: '#60a5fa' }}>{hud.def}</span></div>
                  <div style={{ color: '#888' }}>SPD <span className="font-bold" style={{ color: '#4ade80' }}>{hud.spd}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Game Over */}
          {hud.gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
              <div className="text-center">
                <h1
                  className="text-5xl font-black mb-4"
                  style={{ color: '#ef4444', textShadow: '0 0 60px rgba(239,68,68,0.5)' }}
                >
                  DEFEATED
                </h1>
                <p className="text-gray-400 text-lg mb-2">{hud.heroName}</p>
                <div className="flex gap-6 justify-center mb-6 text-lg">
                  <span className="text-green-400">Kills <span className="text-2xl font-bold">{hud.kills}</span></span>
                  <span className="text-yellow-400">Gold <span className="text-2xl font-bold">{hud.gold}</span></span>
                  <span className="text-purple-400">Zones <span className="text-2xl font-bold">{hud.zonesDiscovered}/8</span></span>
                </div>
                <button
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-lg hover:from-red-500 hover:to-red-700 transition-all cursor-pointer"
                  onClick={() => setLocation('/')}
                >
                  RETURN TO MENU
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
