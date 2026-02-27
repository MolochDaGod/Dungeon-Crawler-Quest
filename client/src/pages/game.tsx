import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  MobaState, HudState, HEROES, ITEMS, CLASS_ABILITIES,
  TEAM_COLORS, TEAM_NAMES, CLASS_COLORS, RARITY_COLORS,
  ItemDef, getPortraitPath
} from '@/game/types';
import {
  createInitialState, updateGame, getHudState,
  MobaRenderer, handlePlayerAbility, handlePlayerAttack,
  handleRightClick, handleAttackMoveClick, handleStopCommand,
  buyItem, handleDodge, handleDashAttack, handleBlock,
  spawnAreaDamageZone
} from '@/game/engine';
import { ThreeRenderer } from '@/game/three-renderer';
import { VoxelRenderer } from '@/game/voxel';
import hudFramePath from '@assets/hud-frame.png';
import shopPanelPath from '@assets/shop-panel.png';
import scoreboardBgPath from '@assets/scoreboard-bg.png';
import {
  loadKeybindings, matchesKeyDown, KeybindAction, KeyBind
} from '@/game/keybindings';
import { createCombatActor, CombatVFX, COMBAT_ACTION_NAMES, COMBAT_HOTKEY_LEGEND } from '@/game/combat-machine';
import { MouseTargetingManager } from '@/game/mouse-targeting';
import { PhysicsWorld, createPhysicsWorld } from '@/game/physics';

export default function GamePage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MobaState | null>(null);
  const rendererRef = useRef<MobaRenderer | null>(null);
  const threeRendererRef = useRef<ThreeRenderer | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const [hud, setHud] = useState<HudState | null>(null);
  const [renderMode, setRenderMode] = useState<'2d' | '3d'>(() =>
    (localStorage.getItem('grudge_render_mode') as '2d' | '3d') || '3d'
  );
  const portraitCanvasRef = useRef<HTMLCanvasElement>(null);
  const portraitVoxelRef = useRef<VoxelRenderer | null>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; camStartX: number; camStartY: number }>({
    active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0
  });
  const combatActorRef = useRef<ReturnType<typeof createCombatActor> | null>(null);
  const mouseTargetRef = useRef<MouseTargetingManager>(new MouseTargetingManager());
  const physicsRef = useRef<PhysicsWorld | null>(null);
  const [combatAction, setCombatAction] = useState('');

  const heroId = parseInt(localStorage.getItem('grudge_hero_id') || '-1');
  const team = parseInt(localStorage.getItem('grudge_team') || '0');

  useEffect(() => {
    if (heroId < 0) {
      setLocation('/');
      return;
    }

    const state = createInitialState(heroId, team);
    stateRef.current = state;

    const combatActor = createCombatActor();
    combatActor.start();
    combatActorRef.current = combatActor;

    const physics = createPhysicsWorld();
    physicsRef.current = physics;
    const mouseTarget = mouseTargetRef.current;

    let renderer2d: MobaRenderer | null = null;
    let renderer3d: ThreeRenderer | null = null;
    let resizeHandler: (() => void) | null = null;

    if (renderMode === '3d' && containerRef.current) {
      try {
        renderer3d = new ThreeRenderer(containerRef.current);
        threeRendererRef.current = renderer3d;
        renderer3d.loadModels(state);
      } catch (e) {
        console.warn('WebGL not available, falling back to 2D renderer:', e);
        renderer3d = null;
        threeRendererRef.current = null;
      }
    }
    if (!renderer3d && canvasRef.current) {
      const canvas = canvasRef.current;
      resizeHandler = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resizeHandler();
      window.addEventListener('resize', resizeHandler);
      renderer2d = new MobaRenderer(canvas);
      rendererRef.current = renderer2d;
    }

    let lastTime = performance.now();
    let hudTimer = 0;
    let animId = 0;

    const gameLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;

      updateGame(state, dt, keysRef.current);

      physics.step(dt);

      const player = state.heroes[state.playerHeroIndex];
      if (player) {
        mouseTarget.updateHeroPosition(player);
        mouseTarget.updateMouseWorld(state.mouseWorld);
      }

      if (combatActor) {
        combatActor.send({ type: 'TICK', dt });
        const snap = combatActor.getSnapshot();
        const ctx = snap.context;
        const player = state.heroes[state.playerHeroIndex];
        if (player && ctx.currentAction !== 'idle') {
          if (ctx.damage > 0 && ctx.actionTimer > 0) {
            player.animState = ctx.animState as any;
          }
          if (ctx.screenShake > state.screenShake) {
            state.screenShake = ctx.screenShake;
          }
          player.blockActive = !!ctx.blockActive;
          if (ctx.vfxQueue.length > 0) {
            for (const vfx of ctx.vfxQueue) {
              if (vfx.type === 'slash' || vfx.type === 'impact') {
                state.spellEffects.push({
                  x: player.x + Math.cos(player.facing) * 25,
                  y: player.y + Math.sin(player.facing) * 25,
                  type: vfx.type === 'slash' ? 'slash_arc' : 'impact_ring',
                  life: vfx.duration, maxLife: vfx.duration,
                  radius: vfx.radius, color: vfx.color,
                  angle: vfx.angle ?? player.facing
                });
              } else if (vfx.type === 'burst' || vfx.type === 'energy_wave') {
                state.spellEffects.push({
                  x: player.x, y: player.y,
                  type: vfx.type === 'burst' ? 'combo_burst' : 'cast_circle',
                  life: vfx.duration, maxLife: vfx.duration,
                  radius: vfx.radius, color: vfx.color, angle: 0
                });
                const count = vfx.count || 6;
                for (let p = 0; p < count; p++) {
                  const a = (p / count) * Math.PI * 2;
                  state.particles.push({
                    x: player.x, y: player.y,
                    vx: Math.cos(a) * (50 + Math.random() * 60),
                    vy: Math.sin(a) * (50 + Math.random() * 60) - 15,
                    life: vfx.duration, maxLife: vfx.duration,
                    color: vfx.color, size: 2 + Math.random() * 2, type: 'ability'
                  });
                }
              } else if (vfx.type === 'ground_ring' || vfx.type === 'earthquake_ring') {
                state.spellEffects.push({
                  x: player.x, y: player.y,
                  type: 'ground_slam',
                  life: vfx.duration, maxLife: vfx.duration,
                  radius: vfx.radius, color: vfx.color, angle: 0
                });
              } else if (vfx.type === 'projectile') {
                const angle = player.facing;
                state.spellProjectiles.push({
                  id: state.nextEntityId++,
                  x: player.x + Math.cos(angle) * 20,
                  y: player.y + Math.sin(angle) * 20,
                  vx: Math.cos(angle) * 500,
                  vy: Math.sin(angle) * 500,
                  speed: 500,
                  damage: Math.floor(player.atk * ctx.damage),
                  radius: 8,
                  life: 1.2, maxLife: 1.2,
                  team: player.team,
                  sourceId: player.id,
                  color: vfx.color, trailColor: vfx.color,
                  aoeRadius: 0, piercing: false, hitIds: [],
                  spellName: 'Combat Projectile'
                });
              } else if (vfx.type === 'uppercut_trail' || vfx.type === 'launch_trail') {
                state.spellEffects.push({
                  x: player.x, y: player.y,
                  type: 'dash_trail',
                  life: vfx.duration, maxLife: vfx.duration,
                  radius: vfx.radius, color: vfx.color,
                  angle: vfx.type === 'uppercut_trail' ? -Math.PI / 2 : player.facing
                });
              } else if (vfx.type === 'spin_trail') {
                for (let s = 0; s < 4; s++) {
                  state.spellEffects.push({
                    x: player.x, y: player.y,
                    type: 'whirlwind_slash',
                    life: vfx.duration, maxLife: vfx.duration,
                    radius: vfx.radius, color: vfx.color,
                    angle: (s / 4) * Math.PI * 2
                  });
                }
              }
            }
          }
        }
      }

      if (renderer3d) {
        renderer3d.render(state);
      } else if (renderer2d) {
        renderer2d.render(state);
      }

      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        setHud(getHudState(state));
        if (combatActor) {
          const snap = combatActor.getSnapshot();
          setCombatAction(snap.context.currentAction);
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };
    animId = requestAnimationFrame(gameLoop);

    const bindings = loadKeybindings();

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      const tryAbility = (idx: number) => {
        const p = state.heroes[state.playerHeroIndex];
        if (!p) return;
        const hd = HEROES[p.heroDataId];
        const abilities = hd ? CLASS_ABILITIES[hd.heroClass] : null;
        const ab = abilities?.[idx];
        if (ab && ab.castType === 'ground_aoe') {
          const classColors: Record<string, string> = { Mage: '#a855f7', Warrior: '#ef4444', Ranger: '#22c55e', Worg: '#f97316' };
          mouseTarget.startAOETargeting(idx, ab.radius || 80, ab.range || 500, classColors[hd?.heroClass || ''] || '#ef4444');
          state.selectedAbility = idx;
          state.cursorMode = 'ability';
          return;
        }
        handlePlayerAbility(state, idx);
      };
      if (matchesKeyDown(bindings[KeybindAction.Ability1], e)) tryAbility(0);
      else if (matchesKeyDown(bindings[KeybindAction.Ability2], e)) tryAbility(1);
      else if (matchesKeyDown(bindings[KeybindAction.Ability3], e)) tryAbility(2);
      else if (matchesKeyDown(bindings[KeybindAction.Ability4], e)) tryAbility(3);

      if (matchesKeyDown(bindings[KeybindAction.Attack], e)) handlePlayerAttack(state);
      if (matchesKeyDown(bindings[KeybindAction.ToggleShop], e)) state.showShop = !state.showShop;
      if (matchesKeyDown(bindings[KeybindAction.ToggleScoreboard], e)) { e.preventDefault(); state.showScoreboard = true; }
      if (matchesKeyDown(bindings[KeybindAction.Pause], e)) {
        if (mouseTarget.aoeIndicator.active) {
          mouseTarget.cancelTargeting();
          state.selectedAbility = -1;
          state.cursorMode = 'default';
        } else if (state.selectedAbility >= 0) {
          state.selectedAbility = -1;
          state.cursorMode = 'default';
        } else {
          state.showShop = false;
          state.showScoreboard = false;
          state.paused = !state.paused;
        }
      }
      if (matchesKeyDown(bindings[KeybindAction.CenterCamera], e)) {
        e.preventDefault();
        const player = state.heroes[state.playerHeroIndex];
        if (player) { state.camera.x = player.x; state.camera.y = player.y; }
      }

      if (matchesKeyDown(bindings[KeybindAction.StopMove], e)) {
        handleStopCommand(state);
      }

      if (key === 's' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        handleStopCommand(state);
      }

      if (key === 'a') {
        state.aKeyHeld = true;
        state.cursorMode = 'attackmove';
      }

      if (matchesKeyDown(bindings[KeybindAction.Dodge], e)) {
        e.preventDefault();
        handleDodge(state);
        combatActor.send({ type: 'SPACE_DOWN' });
      }
      if (matchesKeyDown(bindings[KeybindAction.DashAttack], e)) {
        handleDashAttack(state);
      }
      if (matchesKeyDown(bindings[KeybindAction.Block], e)) {
        handleBlock(state, true);
      }

      if (matchesKeyDown(bindings[KeybindAction.LevelUpAbility1], e)) handlePlayerAbility(state, 0);
      if (matchesKeyDown(bindings[KeybindAction.LevelUpAbility2], e)) handlePlayerAbility(state, 1);
      if (matchesKeyDown(bindings[KeybindAction.LevelUpAbility3], e)) handlePlayerAbility(state, 2);
      if (matchesKeyDown(bindings[KeybindAction.LevelUpAbility4], e)) handlePlayerAbility(state, 3);

      if (key === 'shift') combatActor.send({ type: 'SHIFT_DOWN' });
      if (key === 'r') combatActor.send({ type: 'R_DOWN' });
      if (key === 'e') combatActor.send({ type: 'E_DOWN' });
      if (key === ' ') combatActor.send({ type: 'SPACE_DOWN' });
      if (key === '1') combatActor.send({ type: 'KEY_1' });
      if (key === '2') combatActor.send({ type: 'KEY_2' });
      if (key === '3') combatActor.send({ type: 'KEY_3' });
      if (key === 'j') combatActor.send({ type: 'KEY_J' });
      if (key === 'k') combatActor.send({ type: 'KEY_K' });
      if (key === 'l') combatActor.send({ type: 'KEY_L' });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.delete(key);
      if (matchesKeyDown(bindings[KeybindAction.ToggleScoreboard], e) || key === 'tab') {
        state.showScoreboard = false;
      }
      if (key === 'a') {
        state.aKeyHeld = false;
        if (state.cursorMode === 'attackmove') {
          state.cursorMode = state.hoveredEntityId !== null ? 'attack' : 'default';
        }
      }
      if (matchesKeyDown(bindings[KeybindAction.Block], e)) {
        handleBlock(state, false);
      }
      if (key === 'shift') combatActor.send({ type: 'SHIFT_UP' });
      if (key === 'r') combatActor.send({ type: 'R_UP' });
      if (key === 'e') combatActor.send({ type: 'E_UP' });
      if (key === ' ') combatActor.send({ type: 'SPACE_UP' });
    };

    const eventTarget = renderer3d ? renderer3d.getCanvas() : (canvasRef.current || document.body);

    const getWorldPos = (e: MouseEvent) => {
      if (renderer3d) {
        return renderer3d.screenToWorld(e.clientX, e.clientY);
      }
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return {
        x: (sx - canvas.width / 2) / state.camera.zoom + state.camera.x,
        y: (sy - canvas.height / 2) / state.camera.zoom + state.camera.y
      };
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      combatActor.send({ type: 'RMB_DOWN' });
      if (mouseTarget.aoeIndicator.active) {
        mouseTarget.cancelTargeting();
        state.selectedAbility = -1;
        state.cursorMode = 'default';
        return;
      }
      const wp = getWorldPos(e);
      state.cursorMode = 'move';
      handleRightClick(state, wp.x, wp.y);
      setTimeout(() => { if (state.cursorMode === 'move') state.cursorMode = 'default'; }, 250);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        combatActor.send({ type: 'LMB_DOWN' });
        const wp = getWorldPos(e);
        if (mouseTarget.aoeIndicator.active) {
          const targetPos = mouseTarget.confirmAOETarget();
          if (targetPos) {
            const p = state.heroes[state.playerHeroIndex];
            if (p) {
              const hd = HEROES[p.heroDataId];
              const abilities = hd ? CLASS_ABILITIES[hd.heroClass] : null;
              const abIdx = mouseTarget.aoeIndicator.abilityIndex >= 0 ? mouseTarget.aoeIndicator.abilityIndex : state.selectedAbility;
              const ab = abilities?.[abIdx];
              if (ab) {
                handlePlayerAbility(state, abIdx);
                const zoneTypeMap: Record<string, 'fire' | 'frost' | 'poison' | 'lightning' | 'holy' | 'shadow'> = {
                  'Mage': 'frost', 'Warrior': 'fire', 'Ranger': 'poison', 'Worg': 'shadow'
                };
                spawnAreaDamageZone(
                  state, targetPos.x, targetPos.y,
                  ab.radius || 80, ab.damage || 30,
                  p.team, p.id,
                  10, 1.0,
                  0.15, 1.5,
                  ab.type === 'aoe' ? '#ef4444' : '#a855f7',
                  zoneTypeMap[hd?.heroClass || ''] || 'fire'
                );
              }
            }
            state.selectedAbility = -1;
            state.cursorMode = 'default';
          }
        } else if (state.aKeyHeld) {
          handleAttackMoveClick(state, wp.x, wp.y);
          state.cursorMode = 'attackmove';
        } else if (state.selectedAbility >= 0) {
          const abIdx = state.selectedAbility;
          state.selectedAbility = -1;
          state.cursorMode = 'default';
          handlePlayerAbility(state, abIdx);
        } else {
        }
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
      if (e.button === 0) combatActor.send({ type: 'LMB_UP' });
      if (e.button === 2) combatActor.send({ type: 'RMB_UP' });
      if (e.button === 1) panRef.current.active = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const wp = getWorldPos(e);
      state.mouseWorld.x = wp.x;
      state.mouseWorld.y = wp.y;

      if (panRef.current.active && !renderer3d) {
        const dx = (e.clientX - panRef.current.startX) / state.camera.zoom;
        const dy = (e.clientY - panRef.current.startY) / state.camera.zoom;
        state.camera.x = panRef.current.camStartX - dx;
        state.camera.y = panRef.current.camStartY - dy;
      }

      if (state.aKeyHeld) {
        state.cursorMode = 'attackmove';
      } else if (state.selectedAbility >= 0) {
        state.cursorMode = 'ability';
      } else if (state.hoveredEntityId !== null) {
        state.cursorMode = 'attack';
      } else {
        state.cursorMode = 'default';
      }
    };

    const onWheel = (e: WheelEvent) => {
      state.camera.zoom = Math.max(0.4, Math.min(2, state.camera.zoom - e.deltaY * 0.001));
    };

    eventTarget.addEventListener('contextmenu', onContextMenu);
    eventTarget.addEventListener('mousedown', onMouseDown);
    eventTarget.addEventListener('mouseup', onMouseUp);
    eventTarget.addEventListener('mousemove', onMouseMove);
    eventTarget.addEventListener('wheel', onWheel);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(animId);
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      eventTarget.removeEventListener('contextmenu', onContextMenu);
      eventTarget.removeEventListener('mousedown', onMouseDown);
      eventTarget.removeEventListener('mouseup', onMouseUp);
      eventTarget.removeEventListener('mousemove', onMouseMove);
      eventTarget.removeEventListener('wheel', onWheel);
      if (renderer3d) renderer3d.dispose();
      if (physics) physics.clear();
      combatActor.stop();
    };
  }, [heroId, team, setLocation, renderMode]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const heroData = HEROES.find(h => h.id === heroId);
  const abilities = heroData ? CLASS_ABILITIES[heroData.heroClass] || [] : [];

  useEffect(() => {
    if (!hud || !portraitCanvasRef.current) return;
    const canvas = portraitCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!portraitVoxelRef.current) portraitVoxelRef.current = new VoxelRenderer();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    portraitVoxelRef.current.drawHeroPortrait(
      ctx, 0, 0, canvas.width, canvas.height,
      hud.heroRace, hud.heroClass, hud.heroName
    );
  }, [hud?.heroRace, hud?.heroClass, hud?.heroName]);

  const toggleRenderMode = () => {
    const newMode = renderMode === '2d' ? '3d' : '2d';
    localStorage.setItem('grudge_render_mode', newMode);
    setRenderMode(newMode);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" data-testid="game-page">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'none', display: renderMode === '2d' || !threeRendererRef.current ? 'block' : 'none' }} data-testid="canvas-game" />
      {renderMode === '3d' && (
        <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'crosshair' }} data-testid="three-container" />
      )}

      {hud && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999, fontFamily: "'Oxanium', sans-serif" }}>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center pointer-events-auto" data-testid="panel-top-bar"
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
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
              <span className="text-lg font-black text-blue-400" style={{ textShadow: '0 0 10px rgba(59,130,246,0.5)' }} data-testid="text-team-score">
                {hud.allHeroes.filter(h => h.team === 0).reduce((s, h) => s + h.kills, 0)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-600 uppercase tracking-widest">Time</span>
              <span className="text-sm text-[#c5a059] font-bold" data-testid="text-game-time">{formatTime(hud.gameTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-red-400" style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>
                {hud.allHeroes.filter(h => h.team === 1).reduce((s, h) => s + h.kills, 0)}
              </span>
              <div className="w-5 h-5 rounded-full" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
            </div>
            <button
              onClick={toggleRenderMode}
              className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
              style={{
                background: renderMode === '3d' ? 'linear-gradient(135deg, #c5a059, #8b6914)' : 'rgba(197,160,89,0.2)',
                border: '1px solid #c5a059',
                color: '#c5a059',
                cursor: 'pointer',
              }}
              data-testid="button-toggle-render"
            >
              {renderMode === '3d' ? '3D' : '2D'}
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex items-end pointer-events-auto" style={{ padding: '0 8px 8px 8px', gap: 8, maxHeight: '45vh' }}>

            <div className="flex flex-col" style={{ width: 220, flexShrink: 0 }}>
              <div
                className="flex flex-col text-xs overflow-y-auto"
                style={{
                  height: 140,
                  background: 'linear-gradient(to bottom, rgba(20,15,10,0.95), rgba(8,5,0,0.95))',
                  border: '1px solid #c5a059',
                  borderRadius: 4,
                  padding: '8px 10px',
                  boxShadow: '0 0 20px rgba(0,0,0,0.9), inset 0 0 15px rgba(0,0,0,0.5)'
                }}
                data-testid="panel-chat"
              >
                <div style={{ color: '#c5a059', fontSize: 10, marginBottom: 4 }}>BATTLE LOG</div>
                <div style={{ color: '#888', fontSize: 10 }}>Destroy the enemy nexus!</div>
                {hud.killFeed.slice(-8).map((k, i) => (
                  <div key={i} style={{ color: k.color, fontSize: 10, lineHeight: 1.4 }}>{k.text}</div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex justify-center" style={{ minWidth: 0 }}>
              <div
                className="flex flex-col items-center relative"
                style={{
                  background: `linear-gradient(to bottom, rgba(20,15,10,0.96), rgba(8,5,0,0.96))`,
                  border: '2px solid #c5a059',
                  borderRadius: 6,
                  padding: '10px 14px 8px 14px',
                  maxWidth: 580,
                  width: '100%',
                  boxShadow: '0 -4px 30px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.4), 0 0 1px rgba(197,160,89,0.4)',
                  backgroundImage: `url(${hudFramePath})`,
                  backgroundSize: '100% 100%',
                  backgroundBlendMode: 'overlay'
                }}
                data-testid="panel-hotbar"
              >
                <div style={{ position: 'absolute', top: -1, left: -1, width: 6, height: 6, background: '#c5a059', borderRadius: '0 0 2px 0', boxShadow: '0 0 4px rgba(197,160,89,0.6)' }} />
                <div style={{ position: 'absolute', top: -1, right: -1, width: 6, height: 6, background: '#c5a059', borderRadius: '0 0 0 2px', boxShadow: '0 0 4px rgba(197,160,89,0.6)' }} />

                <div className="flex items-center w-full mb-1.5" style={{ gap: 8 }}>
                  <div className="flex items-center" style={{ gap: 4, flex: 1 }}>
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden"
                      style={{
                        border: '2px solid #c5a059',
                        boxShadow: '0 0 8px rgba(0,0,0,0.6)',
                        background: `linear-gradient(135deg, ${CLASS_COLORS[hud.heroClass] || '#333'}, ${CLASS_COLORS[hud.heroClass] || '#333'}88)`
                      }}
                      data-testid="portrait-hotbar"
                    >
                      <canvas ref={portraitCanvasRef} width={40} height={40} className="w-full h-full" />
                    </div>
                    <div className="flex flex-col" style={{ gap: 2, flex: 1 }}>
                      <div className="flex items-center" style={{ gap: 4 }}>
                        <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#200', border: '1px solid #500' }}>
                          <div className="h-full transition-all" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: 'linear-gradient(to right, #b91c1c, #ef4444)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }} data-testid="bar-hp" />
                        </div>
                        <span className="text-[9px] text-red-300 w-16 text-right">{Math.floor(hud.hp)}/{hud.maxHp}</span>
                      </div>
                      <div className="flex items-center" style={{ gap: 4 }}>
                        <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#002', border: '1px solid #005' }}>
                          <div className="h-full transition-all" style={{ width: `${(hud.mp / hud.maxMp) * 100}%`, background: 'linear-gradient(to right, #1e40af, #3b82f6)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }} data-testid="bar-mp" />
                        </div>
                        <span className="text-[9px] text-blue-300 w-16 text-right">{Math.floor(hud.mp)}/{hud.maxMp}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center" style={{ gap: 1 }}>
                    <span className="text-sm text-[#c5a059] font-black" data-testid="text-hero-level">Lv{hud.level}</span>
                    <div className="h-1 rounded-full overflow-hidden" style={{ width: 40, background: '#333' }}>
                      <div className="h-full transition-all" style={{ width: `${(hud.xp / hud.xpToNext) * 100}%`, background: 'linear-gradient(to right, #ca8a04, #eab308)' }} data-testid="bar-xp" />
                    </div>
                  </div>
                </div>

                {hud.activeEffects.length > 0 && (
                  <div className="flex flex-wrap justify-center mb-1.5" style={{ gap: 3 }} data-testid="panel-active-effects">
                    {hud.activeEffects.map((eff, i) => (
                      <div
                        key={i}
                        className="flex items-center font-bold"
                        style={{
                          background: `${eff.color}18`,
                          border: `1px solid ${eff.color}44`,
                          color: eff.color,
                          padding: '1px 5px',
                          borderRadius: 3,
                          fontSize: 9,
                          gap: 2
                        }}
                        title={`${eff.name} (${eff.remaining.toFixed(1)}s)`}
                        data-testid={`effect-${eff.name}-${i}`}
                      >
                        {eff.name}{eff.stacks > 1 ? ` x${eff.stacks}` : ''} {eff.remaining.toFixed(1)}s
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center flex-wrap" style={{ gap: 4 }}>
                  {abilities.map((ab, i) => {
                    const cd = hud.abilityCooldowns[i] || 0;
                    const maxCharges = hud.abilityMaxCharges?.[i] || 0;
                    const charges = hud.abilityCharges?.[i] || 0;
                    const hasCharges = maxCharges > 0;
                    const onCd = hasCharges ? charges <= 0 : cd > 0;
                    const ready = !onCd && hud.mp >= ab.manaCost;
                    const selected = stateRef.current?.selectedAbility === i;
                    return (
                      <div key={i} className="relative flex flex-col items-center group" style={{ gap: 1 }}>
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block pointer-events-none"
                          style={{ width: 200, zIndex: 10 }}
                          data-testid={`tooltip-ability-${i}`}
                        >
                          <div
                            className="p-2 rounded text-left"
                            style={{
                              background: 'linear-gradient(to bottom, rgba(15,10,5,0.98), rgba(5,2,0,0.98))',
                              border: '1px solid #c5a059',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.9), 0 0 4px rgba(197,160,89,0.3)'
                            }}
                          >
                            <div className="text-xs font-black text-[#c5a059] mb-1">{ab.name}</div>
                            <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">{ab.description}</p>
                            <div className="flex justify-between text-[9px]">
                              <span style={{ color: '#60a5fa' }}>Mana: {ab.manaCost}</span>
                              <span style={{ color: '#fbbf24' }}>CD: {ab.cooldown}s</span>
                            </div>
                            {ab.damage > 0 && <div className="text-[9px] mt-0.5" style={{ color: '#f87171' }}>Damage: {ab.damage}</div>}
                            {ab.range > 0 && <div className="text-[9px]" style={{ color: '#4ade80' }}>Range: {ab.range}</div>}
                            {hasCharges && <div className="text-[9px] mt-0.5" style={{ color: '#a78bfa' }}>Charges: {charges}/{maxCharges}</div>}
                          </div>
                        </div>
                        <button
                          className="relative flex items-center justify-center font-bold text-white"
                          style={{
                            width: 48, height: 48,
                            background: onCd ? 'linear-gradient(135deg, #1a1a1a, #0a0a0a)' : `linear-gradient(135deg, ${CLASS_COLORS[hud.heroClass] || '#333'}, ${CLASS_COLORS[hud.heroClass] || '#333'}88)`,
                            border: `2px solid ${selected ? '#ffd700' : onCd ? '#333' : '#c5a059'}`,
                            borderRadius: 4,
                            boxShadow: selected
                              ? '0 0 12px rgba(255,215,0,0.5)'
                              : ready
                              ? `0 0 10px ${CLASS_COLORS[hud.heroClass] || '#c5a059'}66, inset 0 0 8px rgba(0,0,0,0.4)`
                              : 'inset 0 0 8px rgba(0,0,0,0.6)',
                            opacity: onCd ? 0.6 : 1,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onClick={() => {
                            if (stateRef.current) {
                              stateRef.current.selectedAbility = i;
                              stateRef.current.cursorMode = 'ability';
                            }
                          }}
                          data-testid={`button-ability-${i}`}
                        >
                          <span className="absolute text-[9px] font-bold" style={{ top: 2, left: 4, color: selected ? '#ffd700' : '#888' }}>{ab.key}</span>
                          <span className="text-xs font-black" style={{ textShadow: '0 1px 2px #000' }}>{ab.name.substring(0, 2)}</span>
                          {hasCharges && charges > 0 ? (
                            <span className="absolute text-[10px] font-black" style={{ bottom: 2, right: 4, color: '#a78bfa', textShadow: '0 0 4px rgba(167,139,250,0.5)' }} data-testid={`text-charges-${i}`}>{charges}</span>
                          ) : onCd ? (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 2 }}>
                              <span className="text-sm font-black text-white" style={{ textShadow: '0 0 4px #000' }}>{cd.toFixed(1)}</span>
                            </div>
                          ) : null}
                        </button>
                        <div className="flex items-center" style={{ gap: 2 }}>
                          <span className="text-[8px] font-bold" style={{ color: hud.mp >= ab.manaCost ? '#60a5fa' : '#f87171' }}>{ab.manaCost}</span>
                          {hasCharges && (
                            <div className="flex" style={{ gap: 1 }} data-testid={`pips-charges-${i}`}>
                              {Array.from({ length: maxCharges }).map((_, ci) => (
                                <div
                                  key={ci}
                                  style={{
                                    width: 4, height: 4,
                                    borderRadius: '50%',
                                    background: ci < charges ? '#a78bfa' : '#333',
                                    boxShadow: ci < charges ? '0 0 3px rgba(167,139,250,0.5)' : 'none',
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, #c5a059, transparent)', margin: '0 4px' }} />

                  {[
                    { name: 'Dodge', key: 'SPACE', cd: hud.dodgeCooldown, color: '#22d3ee', cost: 15, action: () => stateRef.current && handleDodge(stateRef.current) },
                    { name: 'Dash', key: 'F', cd: hud.dashAttackCooldown, color: '#f97316', cost: 25, action: () => stateRef.current && handleDashAttack(stateRef.current) },
                    { name: 'Block', key: 'V', cd: hud.blockCooldown, color: '#f59e0b', cost: 0, active: hud.blockActive, action: () => stateRef.current && handleBlock(stateRef.current, !hud.blockActive) },
                  ].map((act, i) => {
                    const onCd = act.cd > 0;
                    const ready = !onCd && (!act.cost || hud.mp >= act.cost);
                    return (
                      <div key={i} className="relative flex flex-col items-center" style={{ gap: 1 }}>
                        <button
                          className="relative flex items-center justify-center font-bold text-white"
                          style={{
                            width: 36, height: 36,
                            background: act.active ? `linear-gradient(135deg, ${act.color}44, ${act.color}22)` : onCd ? 'linear-gradient(135deg, #1a1a1a, #0a0a0a)' : `linear-gradient(135deg, ${act.color}33, ${act.color}11)`,
                            border: `2px solid ${act.active ? act.color : onCd ? '#333' : act.color + '80'}`,
                            borderRadius: 4,
                            opacity: onCd ? 0.5 : 1,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            boxShadow: act.active ? `0 0 8px ${act.color}66` : 'none'
                          }}
                          onClick={act.action}
                          data-testid={`button-combat-${act.name.toLowerCase()}`}
                        >
                          <span className="absolute text-[7px] font-bold" style={{ top: 1, left: 2, color: '#888' }}>{act.key}</span>
                          <span className="text-[9px] font-black" style={{ color: act.color, textShadow: '0 1px 2px #000' }}>{act.name.substring(0, 3)}</span>
                          {onCd && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 2 }}>
                              <span className="text-[10px] font-black text-white" style={{ textShadow: '0 0 4px #000' }}>{act.cd.toFixed(1)}</span>
                            </div>
                          )}
                        </button>
                        {act.cost > 0 && <span className="text-[7px] font-bold" style={{ color: hud.mp >= act.cost ? '#60a5fa' : '#f87171' }}>{act.cost}</span>}
                      </div>
                    );
                  })}

                  {hud.comboCount > 0 && hud.comboTimer > 0 && (
                    <div className="flex flex-col items-center justify-center" style={{ gap: 1 }}>
                      <div className="text-xs font-black" style={{ color: '#ffd700', textShadow: '0 0 6px rgba(255,215,0,0.5)' }} data-testid="text-combo-count">
                        x{hud.comboCount}
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ width: 24, background: '#333' }}>
                        <div className="h-full transition-all" style={{ width: `${(hud.comboTimer / 2) * 100}%`, background: '#ffd700' }} />
                      </div>
                      <span className="text-[7px]" style={{ color: '#ffd700' }}>COMBO</span>
                    </div>
                  )}

                  <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, #c5a059, transparent)', margin: '0 4px' }} />

                  {hud.items.map((item, i) => (
                    <div
                      key={i}
                      className="relative flex items-center justify-center group"
                      style={{
                        width: 40, height: 40,
                        background: item ? 'linear-gradient(135deg, #1a1a2e, #0a0a15)' : 'linear-gradient(135deg, #0a0a0a, #050505)',
                        border: item ? '1px solid #c5a05980' : '1px dashed #333',
                        borderRadius: 3,
                        color: item ? '#c5a059' : '#333',
                        fontSize: 9,
                        fontWeight: 'bold',
                        boxShadow: 'inset 0 0 6px rgba(0,0,0,0.5)'
                      }}
                      data-testid={`slot-item-${i}`}
                    >
                      {item ? item.name.split(' ').map(w => w[0]).join('') : ''}
                      {item && (
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block pointer-events-none"
                          style={{ width: 160, zIndex: 10 }}
                          data-testid={`tooltip-item-${i}`}
                        >
                          <div
                            className="p-2 rounded text-left"
                            style={{
                              background: 'linear-gradient(to bottom, rgba(15,10,5,0.98), rgba(5,2,0,0.98))',
                              border: '1px solid #c5a059',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.9), 0 0 4px rgba(197,160,89,0.3)'
                            }}
                          >
                            <div className="text-xs font-black text-[#c5a059] mb-1">{item.name}</div>
                            <p className="text-[10px] text-gray-400 leading-tight">{item.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end" style={{ width: 200, flexShrink: 0, gap: 6 }}>
              <div className="flex" style={{ gap: 4, marginBottom: -4, paddingRight: 8, zIndex: 2 }}>
                <button
                  className="flex items-center justify-center font-bold text-[#c5a059] cursor-pointer pointer-events-auto"
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2a2a2a, #111)',
                    border: '2px solid #c5a059',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 4px rgba(197,160,89,0.3)',
                    fontSize: 11
                  }}
                  onClick={() => stateRef.current && (stateRef.current.showShop = !stateRef.current.showShop)}
                  title="Shop (B)"
                  data-testid="button-shop"
                >B</button>
                <button
                  className="flex items-center justify-center font-bold text-[#c5a059] cursor-pointer pointer-events-auto"
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2a2a2a, #111)',
                    border: '2px solid #c5a059',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 4px rgba(197,160,89,0.3)',
                    fontSize: 11
                  }}
                  onClick={() => stateRef.current && (stateRef.current.showScoreboard = !stateRef.current.showScoreboard)}
                  title="Scoreboard (Tab)"
                  data-testid="button-scoreboard"
                >TAB</button>
              </div>
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
                data-testid="panel-stats"
              >
                <div className="flex flex-col items-center" style={{ gap: 4 }}>
                  <img
                    src={getPortraitPath(hud.heroRace, hud.heroClass, hud.heroName)}
                    alt={`${hud.heroRace} ${hud.heroClass}`}
                    data-testid="img-hero-portrait"
                    style={{
                      width: 48, height: 48,
                      borderRadius: 6,
                      border: '2px solid #c5a059',
                      boxShadow: '0 0 10px rgba(0,0,0,0.6), 0 0 4px rgba(197,160,89,0.2)',
                      objectFit: 'cover',
                      background: '#1a1a2e'
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-[10px] font-bold flex items-center" style={{ gap: 2 }}>
                    <span style={{ color: '#ffd700' }}>{Math.floor(hud.gold)}</span>
                    <span style={{ color: '#c5a059' }}>g</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ fontSize: 10, maxHeight: 120 }}>
                  <div className="font-bold truncate" style={{ color: '#c5a059', fontSize: 11, marginBottom: 4, borderBottom: '1px solid #333', paddingBottom: 3 }}>{hud.heroName.split(' ').pop()}</div>
                  <div className="flex justify-between" style={{ gap: 8 }}>
                    <div className="flex flex-col" style={{ gap: 1 }}>
                      <span style={{ color: '#888' }}>ATK <span className="font-bold" style={{ color: '#fbbf24' }}>{hud.atk}</span></span>
                      <span style={{ color: '#888' }}>DEF <span className="font-bold" style={{ color: '#60a5fa' }}>{hud.def}</span></span>
                      <span style={{ color: '#888' }}>SPD <span className="font-bold" style={{ color: '#4ade80' }}>{hud.spd}</span></span>
                    </div>
                    <div className="flex flex-col items-end" style={{ gap: 1 }}>
                      <span className="font-bold" style={{ fontSize: 14, letterSpacing: 1 }}>
                        <span style={{ color: '#4ade80' }}>{hud.kills}</span>
                        <span style={{ color: '#555' }}>/</span>
                        <span style={{ color: '#f87171' }}>{hud.deaths}</span>
                        <span style={{ color: '#555' }}>/</span>
                        <span style={{ color: '#fbbf24' }}>{hud.assists}</span>
                      </span>
                      <span style={{ color: '#555', fontSize: 8 }}>KDA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hud.dead && !hud.gameOver && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" data-testid="overlay-respawn"
              style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10 }}
            >
              <div className="text-center">
                <div
                  className="text-5xl font-black mb-2"
                  style={{
                    fontFamily: "'Oxanium', sans-serif",
                    color: '#ef4444',
                    textShadow: '0 0 40px rgba(239,68,68,0.6), 0 2px 8px rgba(0,0,0,0.8)'
                  }}
                  data-testid="text-respawn-timer"
                >
                  RESPAWNING IN {hud.respawnTimer.toFixed(1)}s
                </div>
                <div className="text-gray-500 text-sm" style={{ fontFamily: "'Oxanium', sans-serif" }}>You have been slain</div>
              </div>
            </div>
          )}

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
            <span className="text-yellow-500 text-sm font-bold" data-testid="text-shop-gold">{Math.floor(hud.gold)}g</span>
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
        className="p-4 rounded-lg overflow-y-auto"
        style={{
          width: 700,
          maxHeight: '85vh',
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
                <div key={i} className="flex items-center gap-2 bg-black/30 px-2 py-1 rounded text-xs" data-testid={`row-scoreboard-${t}-${i}`}>
                  <img
                    src={getPortraitPath(h.heroRace, h.heroClass, h.name)}
                    alt={`${h.heroRace} ${h.heroClass}`}
                    data-testid={`img-scoreboard-portrait-${t}-${i}`}
                    style={{
                      width: 24, height: 24,
                      borderRadius: 4,
                      border: '1px solid #c5a059',
                      objectFit: 'cover',
                      background: '#1a1a2e',
                      flexShrink: 0
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-gray-300 truncate" style={{ width: 110, flexShrink: 0 }}>{h.name.split(' ').pop()}</span>
                  <span className="text-gray-500" style={{ width: 28, flexShrink: 0 }}>Lv{h.level}</span>
                  <span className="text-green-400 w-5 text-center" style={{ flexShrink: 0 }}>{h.kills}</span>
                  <span className="text-gray-600" style={{ flexShrink: 0 }}>/</span>
                  <span className="text-red-400 w-5 text-center" style={{ flexShrink: 0 }}>{h.deaths}</span>
                  <span className="text-gray-600" style={{ flexShrink: 0 }}>/</span>
                  <span className="text-yellow-400 w-5 text-center" style={{ flexShrink: 0 }}>{h.assists}</span>
                  <div className="flex" style={{ gap: 2, flexShrink: 0 }}>
                    {(h.items || []).slice(0, 6).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-center"
                        style={{
                          width: 18, height: 18,
                          background: item ? 'linear-gradient(135deg, #1a1a2e, #0a0a15)' : 'rgba(10,10,10,0.5)',
                          border: item ? '1px solid #c5a05960' : '1px solid #222',
                          borderRadius: 2,
                          fontSize: 7,
                          fontWeight: 'bold',
                          color: '#c5a059'
                        }}
                        title={item?.name || ''}
                        data-testid={`scoreboard-item-${t}-${i}-${idx}`}
                      >
                        {item ? item.name.split(' ').map(w => w[0]).join('') : ''}
                      </div>
                    ))}
                  </div>
                  <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden" style={{ flexShrink: 0 }}>
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
