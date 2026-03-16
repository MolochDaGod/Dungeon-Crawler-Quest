import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  HEROES, CLASS_ABILITIES, CLASS_COLORS, ITEMS, ItemDef, RACE_COLORS,
  ABILITY_ICONS, getHeroAbilities
} from '@/game/types';
import {
  DungeonState, DungeonHudState,
  createDungeonState, updateDungeon, getDungeonHudState,
  DungeonRenderer, handleDungeonAbility, handleDungeonAttack, handleDungeonMeleeAttack,
  updateDungeonMouseWorld, startDungeonTargeting, confirmDungeonTargeting, cancelDungeonTargeting
} from '@/game/dungeon';
import { EFFECT_COLORS, StatusEffect } from '@/game/combat';
import {
  loadKeybindings, matchesKeyDown, KeybindAction
} from '@/game/keybindings';
import hudFramePath from '@assets/hud-frame.png';

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
    // Expose sprite effects to ability system
    (state as any)._spriteEffects = renderer.getSpriteEffects();

    let lastTime = performance.now();
    let hudTimer = 0;
    let animId = 0;

    const gameLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;

      updateDungeon(state, dt, keysRef.current);
      renderer.updateSpriteEffects(dt);
      renderer.render(state);

      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        setHud(getDungeonHudState(state));
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
        startDungeonTargeting(state, abilityIndex);
      } else {
        handleDungeonAbility(state, abilityIndex);
      }
    };

    const onKeyDown
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      if (key === 'escape' && state.targeting.active) {
        cancelDungeonTargeting(state);
        return;
      }

      // Dungeon/OW: abilities on 1/2/3/4
      if (matchesKeyDown(bindings[KeybindAction.DungeonAbility1], e)) { e.preventDefault(); tryTargetOrCast(0); }
      else if (matchesKeyDown(bindings[KeybindAction.DungeonAbility2], e)) { e.preventDefault(); tryTargetOrCast(1); }
      else if (matchesKeyDown(bindings[KeybindAction.DungeonAbility3], e)) { e.preventDefault(); tryTargetOrCast(2); }
      else if (matchesKeyDown(bindings[KeybindAction.DungeonAbility4], e)) { e.preventDefault(); tryTargetOrCast(3); }

      if (key === 'i') state.showInventory = !state.showInventory;
      if (matchesKeyDown(bindings[KeybindAction.Pause], e)) { state.showInventory = false; state.paused = !state.paused; }
    };

    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };

    // LMB hold = controlled ranged fire
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        if (state.targeting.active) {
          confirmDungeonTargeting(state);
        } else {
          state.holdingFire = true;
          // Fire first shot immediately
          handleDungeonAttack(state);
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        state.holdingFire = false;
      }
    };

    // RMB = melee attack with knockback
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (state.targeting.active) {
        cancelDungeonTargeting(state);
      } else {
        handleDungeonMeleeAttack(state);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      updateDungeonMouseWorld(state, e.clientX, e.clientY, canvas.width, canvas.height);
    };

    const onWheel = (e: WheelEvent) => {
      state.camera.zoom = Math.max(0.6, Math.min(2.5, state.camera.zoom - e.deltaY * 0.001));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [heroId, setLocation]);

  const heroData = HEROES.find(h => h.id === heroId);
  const abilities = heroData ? getHeroAbilities(heroData.race, heroData.heroClass) : [];
  const [showDebug, setShowDebug] = useState(() => {
    try {
      const stored = localStorage.getItem('grudge_graphics_settings');
      if (stored) return JSON.parse(stored).showDebugOverlay === true;
    } catch {}
    return false;
  });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" data-testid="dungeon-game-page">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" data-testid="canvas-dungeon" />

      {hud && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999, fontFamily: "'Oxanium', sans-serif" }}>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center" data-testid="panel-dungeon-top"
            style={{
              background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))',
              borderBottom: '2px solid #c5a059',
              borderLeft: '1px solid #c5a059',
              borderRight: '1px solid #c5a059',
              borderRadius: '0 0 12px 12px',
              padding: '6px 20px',
              gap: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(197,160,89,0.2)'
            }}
          >
            <span className="text-sm text-[#c5a059] font-bold" style={{ textShadow: '0 0 10px rgba(197,160,89,0.3)' }}>Floor {hud.floor}</span>
            <div style={{ width: 1, height: 16, background: '#c5a059', opacity: 0.3 }} />
            <span className="text-xs text-gray-300">Kills: <span className="text-green-400 font-bold">{hud.kills}</span></span>
            <div style={{ width: 1, height: 16, background: '#c5a059', opacity: 0.3 }} />
            <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{hud.gold}g</span>
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

          <div className="absolute bottom-0 left-0 right-0 flex items-end pointer-events-auto" style={{ padding: '0 8px 8px 8px', gap: 8 }}>

            <div className="flex flex-col" style={{ width: 200, flexShrink: 0 }}>
              <div
                className="flex flex-col text-xs overflow-y-auto"
                style={{
                  height: 120,
                  background: 'linear-gradient(to bottom, rgba(20,15,10,0.95), rgba(8,5,0,0.95))',
                  border: '1px solid #c5a059',
                  borderRadius: 4,
                  padding: '8px 10px',
                  boxShadow: '0 0 20px rgba(0,0,0,0.9), inset 0 0 15px rgba(0,0,0,0.5)'
                }}
                data-testid="panel-dungeon-log"
              >
                <div style={{ color: '#c5a059', fontSize: 10, marginBottom: 4 }}>DUNGEON LOG</div>
                {hud.killFeed.slice(-6).map((k, i) => (
                  <div key={i} style={{ color: k.color, fontSize: 10, lineHeight: 1.4 }}>{k.text}</div>
                ))}
              </div>
            </div>

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
                  boxShadow: '0 -4px 30px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.4), 0 0 1px rgba(197,160,89,0.4)',
                  backgroundImage: `url(${hudFramePath})`,
                  backgroundSize: '100% 100%',
                  backgroundBlendMode: 'overlay'
                }}
                data-testid="panel-dungeon-hotbar"
              >
                <div className="flex items-center w-full mb-1.5" style={{ gap: 8 }}>
                  <div className="flex items-center" style={{ gap: 4, flex: 1 }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black"
                      style={{
                        background: `linear-gradient(135deg, ${CLASS_COLORS[hud.heroClass] || '#333'}, ${CLASS_COLORS[hud.heroClass] || '#333'}88)`,
                        border: '2px solid #c5a059',
                        color: '#fff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                      }}
                    >
                      {hud.heroClass.charAt(0)}
                    </div>
                    <div className="flex flex-col" style={{ gap: 2, flex: 1 }}>
                      <div className="flex items-center" style={{ gap: 4 }}>
                        <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#200', border: '1px solid #500' }}>
                          <div className="h-full transition-all" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: 'linear-gradient(to right, #b91c1c, #ef4444)' }} data-testid="bar-dungeon-hp" />
                        </div>
                        <span className="text-[9px] text-red-300 w-16 text-right">{Math.floor(hud.hp)}/{hud.maxHp}</span>
                      </div>
                      <div className="flex items-center" style={{ gap: 4 }}>
                        <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#002', border: '1px solid #005' }}>
                          <div className="h-full transition-all" style={{ width: `${(hud.mp / hud.maxMp) * 100}%`, background: 'linear-gradient(to right, #1e40af, #3b82f6)' }} data-testid="bar-dungeon-mp" />
                        </div>
                        <span className="text-[9px] text-blue-300 w-16 text-right">{Math.floor(hud.mp)}/{hud.maxMp}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center" style={{ gap: 1 }}>
                    <span className="text-sm text-[#c5a059] font-black">Lv{hud.level}</span>
                    <div className="h-1 rounded-full overflow-hidden" style={{ width: 40, background: '#333' }}>
                      <div className="h-full transition-all" style={{ width: `${(hud.xp / hud.xpToNext) * 100}%`, background: 'linear-gradient(to right, #ca8a04, #eab308)' }} data-testid="bar-dungeon-xp" />
                    </div>
                  </div>
                </div>

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
                          boxShadow: 'inset 0 0 8px rgba(0,0,0,0.6)',
                          opacity: onCd ? 0.6 : 1,
                          cursor: 'pointer',
                          transition: 'all 0.1s'
                        }}
                        onClick={() => stateRef.current && handleDungeonAbility(stateRef.current, i)}
                        title={`${ab.name}: ${ab.description}`}
                        data-testid={`button-dungeon-ability-${i}`}
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
                          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 2 }}>
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
                        fontWeight: 'bold'
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

            <div className="flex flex-col items-end" style={{ width: 180, flexShrink: 0 }}>
              <div
                className="w-full flex"
                style={{
                  background: 'linear-gradient(to bottom, rgba(20,15,10,0.95), rgba(8,5,0,0.95))',
                  border: '1px solid #c5a059',
                  borderRadius: 4,
                  padding: '8px 10px',
                  gap: 10,
                  boxShadow: '0 0 20px rgba(0,0,0,0.9), inset 0 0 15px rgba(0,0,0,0.5)'
                }}
                data-testid="panel-dungeon-stats"
              >
                <div className="flex flex-col items-center" style={{ gap: 4 }}>
                  <div className="rounded-lg flex items-center justify-center text-sm font-black"
                    style={{
                      width: 38, height: 38,
                      background: `linear-gradient(135deg, ${CLASS_COLORS[hud.heroClass] || '#333'}, #111)`,
                      border: '2px solid #c5a059',
                      color: '#fff'
                    }}
                  >
                    {hud.heroClass.charAt(0)}
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>{hud.gold}g</span>
                </div>
                <div className="flex-1" style={{ fontSize: 10 }}>
                  <div className="font-bold truncate" style={{ color: '#c5a059', fontSize: 11, marginBottom: 4, borderBottom: '1px solid #333', paddingBottom: 3 }}>{hud.heroName.split(' ').pop()}</div>
                  <div style={{ color: '#888' }}>ATK <span className="font-bold" style={{ color: '#fbbf24' }}>{hud.atk}</span></div>
                  <div style={{ color: '#888' }}>DEF <span className="font-bold" style={{ color: '#60a5fa' }}>{hud.def}</span></div>
                  <div style={{ color: '#888' }}>SPD <span className="font-bold" style={{ color: '#4ade80' }}>{hud.spd}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Attack mode indicators */}
          <div className="absolute top-2 left-2 pointer-events-none flex flex-col" style={{ gap: 4 }}>
            <div className="flex items-center" style={{ gap: 6, background: 'rgba(0,0,0,0.7)', border: '1px solid #555', borderRadius: 4, padding: '3px 8px' }}>
              <span className="text-[10px] font-bold" style={{ color: '#4ade80' }}>LMB</span>
              <span className="text-[10px]" style={{ color: '#aaa' }}>Hold &#x2192; Ranged</span>
            </div>
            <div className="flex items-center" style={{ gap: 6, background: 'rgba(0,0,0,0.7)', border: '1px solid #555', borderRadius: 4, padding: '3px 8px' }}>
              <span className="text-[10px] font-bold" style={{ color: '#f87171' }}>RMB</span>
              <span className="text-[10px]" style={{ color: '#aaa' }}>Melee + Knockback</span>
            </div>
          </div>

          <div className="absolute top-2 right-2 pointer-events-auto flex items-center" style={{ gap: 4 }}>
            <button
              className="flex items-center justify-center rounded cursor-pointer"
              style={{
                width: 28, height: 28,
                background: 'rgba(0,0,0,0.4)',
                color: '#888',
                border: '1px solid #333',
              }}
              onClick={() => setLocation('/settings')}
              title="Settings"
              data-testid="button-dungeon-settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button
              className="text-[10px] px-2 py-1 rounded cursor-pointer"
              style={{
                background: showDebug ? 'rgba(255,200,0,0.3)' : 'rgba(0,0,0,0.4)',
                color: showDebug ? '#ffd700' : '#555',
                border: `1px solid ${showDebug ? '#ffd700' : '#333'}`
              }}
              onClick={() => setShowDebug(d => !d)}
              data-testid="button-toggle-debug"
            >
              DBG
            </button>
          </div>

          {showDebug && (
            <div
              className="absolute top-10 right-2 pointer-events-auto text-[10px] font-mono"
              style={{
                background: 'rgba(0,0,0,0.85)',
                border: '1px solid #555',
                borderRadius: 4,
                padding: '6px 10px',
                color: '#aaa',
                minWidth: 180,
                lineHeight: 1.6
              }}
              data-testid="panel-debug-overlay"
            >
              <div style={{ color: '#ffd700', fontWeight: 'bold', marginBottom: 2 }}>ANIM DEBUG</div>
              <div>state: <span style={{ color: '#4ade80' }}>{hud.animState || 'idle'}</span></div>
              <div>timer: <span style={{ color: '#60a5fa' }}>{hud.animTimer?.toFixed(2) || '0.00'}</span></div>
              <div>facing: <span style={{ color: '#f59e0b' }}>{hud.facing || 'down'}</span></div>
              <div>floor: <span style={{ color: '#c084fc' }}>{hud.floor}</span></div>
              <div>pos: <span style={{ color: '#888' }}>{hud.px?.toFixed(0)},{hud.py?.toFixed(0)}</span></div>
              {hud.activeEffects.length > 0 && (
                <div style={{ marginTop: 2, borderTop: '1px solid #333', paddingTop: 2 }}>
                  <div style={{ color: '#ffd700' }}>buffs:</div>
                  {hud.activeEffects.map((e, i) => (
                    <div key={i} style={{ color: e.color }}>{e.name} ({e.remaining.toFixed(1)}s)</div>
                  ))}
                </div>
              )}
            </div>
          )}

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
