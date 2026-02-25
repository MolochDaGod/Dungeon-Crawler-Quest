import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Heart, Droplets, Zap, Shield, Sword, Skull, X, ChevronLeft,
  Swords, ShieldCheck, Wind, Target, RotateCcw, Package, User,
  Map as MapIcon, Pause, Play, Plus, Minus,
} from 'lucide-react';
import {
  GameState, RARITY_COLORS, Item, EquipmentSlot, Attributes,
  calculateDerivedStats, CHARACTER_CLASSES,
} from '@/game/types';
import {
  createGameState, updateGameState, renderGame, renderMinimap,
  useAbility, playerAttack, recalculatePlayerStats,
} from '@/game/engine';

function HealthOrb({ current, max, color, label, icon: Icon }: {
  current: number; max: number; color: string; label: string; icon: typeof Heart;
}) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  return (
    <div className="flex flex-col items-center" data-testid={`orb-${label.toLowerCase()}`}>
      <div className="relative w-16 h-16 rounded-full border-2 overflow-hidden"
        style={{ borderColor: color, backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-300"
          style={{ height: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-5 h-5 text-white/80" />
        </div>
      </div>
      <span className="text-xs mt-1 text-neutral-400 font-medium">
        {Math.floor(current)}/{Math.floor(max)}
      </span>
    </div>
  );
}

function AbilityButton({ ability, cooldownRemaining, onClick, index }: {
  ability: { id: string; name: string; color: string; key: string; manaCost: number; cooldown: number };
  cooldownRemaining: number;
  onClick: () => void;
  index: number;
}) {
  const onCooldown = cooldownRemaining > 0;
  return (
    <button
      onClick={onClick}
      disabled={onCooldown}
      className={`relative w-12 h-12 rounded-md border flex items-center justify-center transition-all ${
        onCooldown ? 'opacity-50 border-neutral-700' : 'border-neutral-600 hover:border-neutral-400'
      }`}
      style={{ backgroundColor: onCooldown ? '#1a1a1a' : `${ability.color}20` }}
      data-testid={`button-ability-${index}`}
    >
      <span className="text-sm font-bold" style={{ color: onCooldown ? '#666' : ability.color }}>
        {ability.key}
      </span>
      {onCooldown && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
          <span className="text-xs text-neutral-400">{cooldownRemaining.toFixed(1)}</span>
        </div>
      )}
      <span className="absolute -bottom-4 text-[9px] text-neutral-500 whitespace-nowrap truncate max-w-[48px]">
        {ability.name}
      </span>
    </button>
  );
}

function InventoryPanel({ state, onClose, onEquip, onDrop }: {
  state: GameState;
  onClose: () => void;
  onEquip: (item: Item) => void;
  onDrop: (item: Item) => void;
}) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const equipment = state.player.equipment;
  const slots: { key: EquipmentSlot; label: string }[] = [
    { key: 'weapon', label: 'Weapon' },
    { key: 'helmet', label: 'Helmet' },
    { key: 'chest', label: 'Chest' },
    { key: 'legs', label: 'Legs' },
    { key: 'boots', label: 'Boots' },
    { key: 'gloves', label: 'Gloves' },
    { key: 'ring', label: 'Ring' },
    { key: 'amulet', label: 'Amulet' },
  ];

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-neutral-950/95 border-l border-neutral-800/60 z-30 flex flex-col" data-testid="panel-inventory">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-neutral-800/50">
        <h3 className="text-sm tracking-wider text-neutral-300" style={{ fontFamily: 'Oxanium, sans-serif' }}>INVENTORY</h3>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-inventory">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <p className="text-xs text-neutral-500 mb-2 tracking-wider" style={{ fontFamily: 'Oxanium, sans-serif' }}>EQUIPPED</p>
          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {slots.map(({ key, label }) => {
              const item = equipment[key];
              return (
                <div
                  key={key}
                  className="aspect-square rounded-md border border-neutral-800/60 flex flex-col items-center justify-center bg-neutral-900/50 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                  onClick={() => item && setSelectedItem(item)}
                  data-testid={`slot-${key}`}
                >
                  {item ? (
                    <>
                      <span className="text-lg font-bold" style={{ color: item.color }}>{item.icon}</span>
                      <span className="text-[8px] text-neutral-500 truncate max-w-full px-0.5">{label}</span>
                    </>
                  ) : (
                    <span className="text-[8px] text-neutral-600">{label}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs text-neutral-500 tracking-wider" style={{ fontFamily: 'Oxanium, sans-serif' }}>
              BACKPACK ({state.player.inventory.length}/30)
            </p>
            <Badge variant="secondary" className="text-xs">{state.gold}g</Badge>
          </div>

          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {state.player.inventory.map((item, i) => (
              <div
                key={item.id}
                className="aspect-square rounded-md border flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-800/50 transition-colors"
                style={{ borderColor: `${item.color}40`, backgroundColor: `${item.color}08` }}
                onClick={() => setSelectedItem(item)}
                data-testid={`inventory-item-${i}`}
              >
                <span className="text-sm font-bold" style={{ color: item.color }}>{item.icon}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 30 - state.player.inventory.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square rounded-md border border-neutral-800/30 bg-neutral-900/20" />
            ))}
          </div>

          {selectedItem && (
            <div className="bg-neutral-900/80 rounded-md border p-3 mb-2" style={{ borderColor: `${selectedItem.color}40` }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium" style={{ color: selectedItem.color }}>{selectedItem.name}</span>
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: selectedItem.color, color: selectedItem.color }}>
                  {selectedItem.rarity}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 mb-2">{selectedItem.description}</p>
              <p className="text-xs text-neutral-600 mb-2">Level {selectedItem.level} | {selectedItem.slot}</p>
              <div className="space-y-0.5 mb-3">
                {Object.entries(selectedItem.stats).map(([key, val]) => {
                  if (!val) return null;
                  const isPercent = typeof val === 'number' && val < 1 && val > 0;
                  return (
                    <p key={key} className="text-xs text-green-400">
                      +{isPercent ? `${(val * 100).toFixed(1)}%` : val} {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </p>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                {selectedItem.slot && (
                  <Button size="sm" onClick={() => { onEquip(selectedItem); setSelectedItem(null); }} className="text-xs" data-testid="button-equip-item">
                    Equip
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => { onDrop(selectedItem); setSelectedItem(null); }} className="text-xs" data-testid="button-drop-item">
                  Drop
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CharacterSheet({ state, onClose, onAllocate }: {
  state: GameState;
  onClose: () => void;
  onAllocate: (attr: keyof Attributes) => void;
}) {
  const attrs = state.player.attributes;
  const stats = state.player.stats;

  const attrList: { key: keyof Attributes; label: string; color: string }[] = [
    { key: 'strength', label: 'STR', color: '#ef4444' },
    { key: 'intellect', label: 'INT', color: '#3b82f6' },
    { key: 'vitality', label: 'VIT', color: '#22c55e' },
    { key: 'dexterity', label: 'DEX', color: '#f59e0b' },
    { key: 'endurance', label: 'END', color: '#8b5cf6' },
    { key: 'wisdom', label: 'WIS', color: '#06b6d4' },
    { key: 'agility', label: 'AGI', color: '#10b981' },
    { key: 'tactics', label: 'TAC', color: '#f97316' },
  ];

  return (
    <div className="absolute left-0 top-0 bottom-0 w-72 bg-neutral-950/95 border-r border-neutral-800/60 z-30 flex flex-col" data-testid="panel-character">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-neutral-800/50">
        <h3 className="text-sm tracking-wider text-neutral-300" style={{ fontFamily: 'Oxanium, sans-serif' }}>CHARACTER</h3>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-character">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <div className="text-center mb-4">
            <p className="text-lg font-bold text-neutral-200">{state.player.name}</p>
            <p className="text-xs text-neutral-500">Level {state.player.level} {CHARACTER_CLASSES.find(c => c.id === state.player.classId)?.name}</p>
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 mb-1">
                <span>XP</span>
                <span>{state.player.experience}/{state.player.experienceToLevel}</span>
              </div>
              <Progress value={(state.player.experience / state.player.experienceToLevel) * 100} className="h-1.5" />
            </div>
          </div>

          {state.player.unallocatedPoints > 0 && (
            <Badge className="w-full justify-center mb-3 bg-amber-900/30 text-amber-400 border-amber-700/50">
              {state.player.unallocatedPoints} points available
            </Badge>
          )}

          <p className="text-xs text-neutral-500 mb-2 tracking-wider" style={{ fontFamily: 'Oxanium, sans-serif' }}>ATTRIBUTES</p>
          <div className="space-y-1.5 mb-4">
            {attrList.map(({ key, label, color }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-8" style={{ color }}>{label}</span>
                  <span className="text-sm text-neutral-300">{attrs[key]}</span>
                </div>
                {state.player.unallocatedPoints > 0 && (
                  <button
                    onClick={() => onAllocate(key)}
                    className="w-5 h-5 rounded flex items-center justify-center text-amber-400 hover:bg-amber-900/30 transition-colors"
                    data-testid={`button-allocate-${key}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-neutral-500 mb-2 tracking-wider" style={{ fontFamily: 'Oxanium, sans-serif' }}>COMBAT STATS</p>
          <div className="space-y-1 text-xs">
            {[
              { l: 'Health', v: `${Math.floor(state.player.currentHealth)}/${stats.maxHealth}`, c: '#22c55e' },
              { l: 'Mana', v: `${Math.floor(state.player.currentMana)}/${stats.maxMana}`, c: '#3b82f6' },
              { l: 'Damage', v: stats.damage.toFixed(1), c: '#ef4444' },
              { l: 'Magic DMG', v: stats.magicDamage.toFixed(1), c: '#a855f7' },
              { l: 'Defense', v: stats.defense.toFixed(1), c: '#6366f1' },
              { l: 'Crit', v: `${(stats.criticalChance * 100).toFixed(1)}%`, c: '#fbbf24' },
              { l: 'Crit DMG', v: `${(stats.criticalDamage * 100).toFixed(0)}%`, c: '#fbbf24' },
              { l: 'Atk Speed', v: stats.attackSpeed.toFixed(2), c: '#14b8a6' },
              { l: 'Move Speed', v: stats.movementSpeed.toFixed(2), c: '#10b981' },
              { l: 'Block', v: `${(stats.blockChance * 100).toFixed(1)}%`, c: '#8b5cf6' },
              { l: 'Evasion', v: `${(stats.evasion * 100).toFixed(1)}%`, c: '#06b6d4' },
              { l: 'Resist', v: `${(stats.resistance * 100).toFixed(1)}%`, c: '#8b5cf6' },
              { l: 'Lifesteal', v: `${(stats.drainHealth * 100).toFixed(1)}%`, c: '#dc2626' },
              { l: 'Armor Pen', v: `${(stats.armorPenetration * 100).toFixed(1)}%`, c: '#f97316' },
            ].map(({ l, v, c }) => (
              <div key={l} className="flex items-center justify-between gap-1 py-0.5 border-b border-neutral-800/30">
                <span className="text-neutral-500">{l}</span>
                <span className="font-medium" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-xs text-neutral-500 mb-1 tracking-wider" style={{ fontFamily: 'Oxanium, sans-serif' }}>SESSION</p>
            <p className="text-xs text-neutral-400">Kills: <span className="text-red-400">{state.killCount}</span></p>
            <p className="text-xs text-neutral-400">Items: <span className="text-green-400">{state.itemsCollected}</span></p>
            <p className="text-xs text-neutral-400">Gold: <span className="text-amber-400">{state.gold}</span></p>
            <p className="text-xs text-neutral-400">Floor: <span className="text-purple-400">{state.currentFloor}</span></p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default function GamePage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const keysRef = useRef(new Set<string>());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const [hudState, setHudState] = useState({
    health: 0, maxHealth: 0, mana: 0, maxMana: 0, stamina: 0, maxStamina: 0,
    level: 1, experience: 0, experienceToLevel: 100,
    floor: 1, gold: 0, killCount: 0, unallocatedPoints: 0,
    showInventory: false, showCharacterSheet: false, isPaused: false,
    isDead: false, respawnTimer: 0,
  });
  const [abilities, setAbilities] = useState<{ id: string; name: string; color: string; key: string; manaCost: number; cooldown: number }[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const savedData = localStorage.getItem('grudge_new_game');
    if (!savedData) {
      setLocation('/');
      return;
    }

    const { classId, playerName, attributes } = JSON.parse(savedData);
    const state = createGameState(classId, playerName);

    if (attributes) {
      state.player.attributes = attributes;
      recalculatePlayerStats(state.player);
      state.player.currentHealth = state.player.stats.maxHealth;
      state.player.currentMana = state.player.stats.maxMana;
      state.player.currentStamina = state.player.stats.maxStamina;
    }

    gameStateRef.current = state;
    setAbilities(state.player.abilities.map(a => ({
      id: a.id, name: a.name, color: a.color, key: a.key, manaCost: a.manaCost, cooldown: a.cooldown,
    })));

    localStorage.removeItem('grudge_new_game');
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      const state = gameStateRef.current;
      if (!state) return;

      if (key === 'escape') {
        state.isPaused = !state.isPaused;
        state.showInventory = false;
        state.showCharacterSheet = false;
      }
      if (key === 'i') {
        state.showInventory = !state.showInventory;
        state.showCharacterSheet = false;
      }
      if (key === 'c') {
        state.showCharacterSheet = !state.showCharacterSheet;
        state.showInventory = false;
      }
      if (key === 'm') {
        state.showMap = !state.showMap;
      }

      if (['1', '2', '3', '4'].includes(key)) {
        useAbility(state, parseInt(key) - 1);
      }

      setForceUpdate(f => f + 1);
    }

    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key.toLowerCase());
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function gameLoop(time: number) {
      const state = gameStateRef.current;
      if (!state) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const dt = Math.min(0.05, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      updateGameState(state, dt, keysRef.current);
      renderGame(ctx, state, canvas!.width, canvas!.height);

      const minimapCanvas = minimapCanvasRef.current;
      if (minimapCanvas) {
        const mctx = minimapCanvas.getContext('2d');
        if (mctx) {
          mctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
          renderMinimap(mctx, state, 0, 0, minimapCanvas.width);
        }
      }

      if (Math.floor(time / 100) % 2 === 0) {
        const now = state.gameTime;
        const cds: Record<string, number> = {};
        for (const ab of state.player.abilities) {
          const cdEnd = state.player.abilityCooldowns[ab.id] || 0;
          cds[ab.id] = Math.max(0, cdEnd - now);
        }
        setCooldowns(cds);

        setHudState({
          health: state.player.currentHealth,
          maxHealth: state.player.stats.maxHealth,
          mana: state.player.currentMana,
          maxMana: state.player.stats.maxMana,
          stamina: state.player.currentStamina,
          maxStamina: state.player.stats.maxStamina,
          level: state.player.level,
          experience: state.player.experience,
          experienceToLevel: state.player.experienceToLevel,
          floor: state.currentFloor,
          gold: state.gold,
          killCount: state.killCount,
          unallocatedPoints: state.player.unallocatedPoints,
          showInventory: state.showInventory,
          showCharacterSheet: state.showCharacterSheet,
          isPaused: state.isPaused,
          isDead: state.player.isDead,
          respawnTimer: state.player.respawnTimer,
        });
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleEquip = useCallback((item: Item) => {
    const state = gameStateRef.current;
    if (!state || !item.slot) return;

    const slot = item.slot as EquipmentSlot;
    const existing = state.player.equipment[slot];

    if (existing) {
      state.player.inventory.push(existing);
    }

    state.player.equipment[slot] = item;
    state.player.inventory = state.player.inventory.filter(i => i.id !== item.id);
    recalculatePlayerStats(state.player);
    setForceUpdate(f => f + 1);
  }, []);

  const handleDrop = useCallback((item: Item) => {
    const state = gameStateRef.current;
    if (!state) return;

    const slots = ['weapon', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet'] as const;
    for (const slot of slots) {
      if (state.player.equipment[slot]?.id === item.id) {
        state.player.equipment[slot] = null;
        recalculatePlayerStats(state.player);
        setForceUpdate(f => f + 1);
        return;
      }
    }

    state.player.inventory = state.player.inventory.filter(i => i.id !== item.id);
    setForceUpdate(f => f + 1);
  }, []);

  const handleAllocate = useCallback((attr: keyof Attributes) => {
    const state = gameStateRef.current;
    if (!state || state.player.unallocatedPoints <= 0) return;

    state.player.attributes[attr]++;
    state.player.unallocatedPoints--;
    recalculatePlayerStats(state.player);
    setForceUpdate(f => f + 1);
  }, []);

  const xpPct = hudState.experienceToLevel > 0 ? (hudState.experience / hudState.experienceToLevel) * 100 : 0;
  const state = gameStateRef.current;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black" data-testid="page-game">
      <canvas ref={canvasRef} className="absolute inset-0" />

      <canvas
        ref={minimapCanvasRef}
        width={160}
        height={160}
        className="absolute top-3 right-3 z-20 rounded-md"
        data-testid="minimap"
      />

      <div className="absolute top-3 left-3 z-20 flex items-center gap-2" data-testid="hud-top-left">
        <Badge className="bg-neutral-950/80 text-neutral-300 border-neutral-700/50 text-xs">
          Floor {hudState.floor}
        </Badge>
        <Badge className="bg-neutral-950/80 text-amber-400 border-amber-800/50 text-xs">
          {hudState.gold}g
        </Badge>
        <Badge className="bg-neutral-950/80 text-red-400 border-red-800/50 text-xs">
          {hudState.killCount} kills
        </Badge>
        {hudState.unallocatedPoints > 0 && (
          <Badge className="bg-amber-900/60 text-amber-300 border-amber-600/50 text-xs animate-pulse">
            {hudState.unallocatedPoints} pts!
          </Badge>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="w-full h-1 bg-neutral-900/60">
          <div className="h-full bg-purple-600/60 transition-all duration-300" style={{ width: `${xpPct}%` }} />
        </div>

        <div className="flex items-end justify-center gap-6 pb-4 px-4 pointer-events-auto">
          <HealthOrb current={hudState.health} max={hudState.maxHealth} color="#ef4444" label="Health" icon={Heart} />

          <div className="flex items-center gap-2 mb-2">
            {abilities.map((ability, i) => (
              <AbilityButton
                key={ability.id}
                ability={ability}
                cooldownRemaining={cooldowns[ability.id] || 0}
                onClick={() => {
                  const s = gameStateRef.current;
                  if (s) useAbility(s, i);
                }}
                index={i}
              />
            ))}
          </div>

          <HealthOrb current={hudState.mana} max={hudState.maxMana} color="#3b82f6" label="Mana" icon={Droplets} />
        </div>
      </div>

      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 text-[10px] text-neutral-500" style={{ fontFamily: 'Oxanium, sans-serif' }}>
        <span>Lv.{hudState.level}</span>
        <span className="text-neutral-700">|</span>
        <span>{hudState.experience}/{hudState.experienceToLevel} XP</span>
      </div>

      <div className="absolute bottom-24 right-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => { if (state) { state.showInventory = !state.showInventory; state.showCharacterSheet = false; setForceUpdate(f => f + 1); } }}
          className="w-9 h-9 rounded-md bg-neutral-950/70 border border-neutral-700/50 flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
          data-testid="button-toggle-inventory"
        >
          <Package className="w-4 h-4" />
        </button>
        <button
          onClick={() => { if (state) { state.showCharacterSheet = !state.showCharacterSheet; state.showInventory = false; setForceUpdate(f => f + 1); } }}
          className="w-9 h-9 rounded-md bg-neutral-950/70 border border-neutral-700/50 flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
          data-testid="button-toggle-character"
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      {hudState.showInventory && state && (
        <InventoryPanel
          state={state}
          onClose={() => { state.showInventory = false; setForceUpdate(f => f + 1); }}
          onEquip={handleEquip}
          onDrop={handleDrop}
        />
      )}

      {hudState.showCharacterSheet && state && (
        <CharacterSheet
          state={state}
          onClose={() => { state.showCharacterSheet = false; setForceUpdate(f => f + 1); }}
          onAllocate={handleAllocate}
        />
      )}

      {hudState.isPaused && (
        <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center" data-testid="overlay-paused">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-neutral-200 mb-4" style={{ fontFamily: 'Oxanium, sans-serif' }}>PAUSED</h2>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => { if (state) { state.isPaused = false; setForceUpdate(f => f + 1); } }}
                className="bg-gradient-to-r from-red-800 to-red-700"
                data-testid="button-resume"
              >
                <Play className="w-4 h-4 mr-2" /> Resume
              </Button>
              <Button
                variant="secondary"
                onClick={() => setLocation('/')}
                data-testid="button-quit"
              >
                Quit to Menu
              </Button>
            </div>
            <div className="mt-6 text-xs text-neutral-600 space-y-1">
              <p>WASD - Move | SPACE - Attack</p>
              <p>1-4 - Abilities | E - Interact</p>
              <p>I - Inventory | C - Character | ESC - Pause</p>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <p className="text-[10px] text-neutral-600 tracking-wider" style={{ fontFamily: 'Oxanium, sans-serif' }}>
          SPACE attack | E interact/descend | 1-4 abilities | I inventory | C stats | ESC pause
        </p>
      </div>
    </div>
  );
}
