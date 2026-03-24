import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { RACE_COLORS, CLASS_COLORS, RARITY_COLORS } from '@/game/types';
import { VoxelRenderer } from '@/game/voxel';
import { loadCharacterData } from '@/game/character-data';
import {
  saveEquipment, loadEquipment, saveEquipmentBag, loadEquipmentBag,
  computeEquipmentStats, computeSetBonuses,
  PlayerEquipment, EquipmentBag, EquipmentInstance, EquipSlot, EQUIP_SLOTS,
  generateRandomEquipment, generateWeaponDrop,
} from '@/game/equipment';
import css from '@/components/MainPanel.module.css';
import { TIER_COLORS, SLOT_EMOJIS, DragCtx } from '@/components/character-tabs/EquipmentTab';
import {
  EquipmentTab, AttributesTab, ClassSkillsTab, WeaponSkillsTab,
  UpgradesTab, CraftingTab, QuestsTab, GuildTab,
} from '@/components/character-tabs';

// ── Tabs ───────────────────────────────────────────────────────

type Tab = 'equip' | 'attrs' | 'class' | 'weapon' | 'upgrades' | 'crafting' | 'quests' | 'guild';
const TABS: { id: Tab; label: string }[] = [
  { id: 'equip',    label: 'Equipment'    },
  { id: 'attrs',    label: 'Attributes'   },
  { id: 'class',    label: 'Class Skills' },
  { id: 'weapon',   label: 'Weapon Skills'},
  { id: 'upgrades', label: 'Upgrades'     },
  { id: 'crafting', label: 'Crafting'     },
  { id: 'quests',   label: 'Quests'       },
  { id: 'guild',    label: 'Guild'        },
];

// ── ItemTooltip ─────────────────────────────────────────────────

function ItemTooltip({ item }: { item: EquipmentInstance }) {
  const color = TIER_COLORS[item.tier] ?? '#9ca3af';
  const stats: string[] = [];
  if (item.atk)   stats.push(`+${item.atk} ATK`);
  if (item.def)   stats.push(`+${item.def} DEF`);
  if (item.hp)    stats.push(`+${item.hp} HP`);
  if (item.mp)    stats.push(`+${item.mp} MP`);
  if (item.spd)   stats.push(`+${item.spd} SPD`);
  if (item.crit)  stats.push(`+${item.crit.toFixed(1)}% Crit`);
  if (item.block) stats.push(`+${item.block.toFixed(1)}% Block`);
  return (
    <div className={css.itemTooltip}>
      <div className={css.ttTitle} style={{ color }}>{item.name}</div>
      <div className={css.ttMeta}>T{item.tier} · {item.material} · {item.setName} Set · {item.slot}</div>
      {stats.length > 0 && (
        <div className={css.ttStats}>
          {stats.map((s, i) => <span key={i} className={css.ttStat} style={{ color }}>{s}</span>)}
        </div>
      )}
      {item.passive && <div className={css.ttPassive}>◆ {item.passive}</div>}
      {item.lore   && <div className={css.ttLore}>"{item.lore}"</div>}
      <div className={css.ttHint}>Double-click equip · Right-click for options</div>
    </div>
  );
}

// ── InventoryCell ───────────────────────────────────────────────

interface CellProps {
  item?: EquipmentInstance;
  index: number;
  dragRef: React.MutableRefObject<DragCtx>;
  onEquip: (item: EquipmentInstance) => void;
  onUnequip: (slot: EquipSlot) => void;
  onMoveBag: (from: number, to: number) => void;
  onShowTooltip: (item: EquipmentInstance, x: number, y: number) => void;
  onHideTooltip: () => void;
  onCtxMenu: (item: EquipmentInstance, x: number, y: number) => void;
}

function InventoryCell({ item, index, dragRef, onEquip, onUnequip, onMoveBag, onShowTooltip, onHideTooltip, onCtxMenu }: CellProps) {
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const tierColor = item ? (TIER_COLORS[item.tier] ?? '#9ca3af') : undefined;

  return (
    <div
      className={`${css.invCell} ${item ? css.invCellFilled : ''} ${dragging ? css.invCellDragging : ''} ${over ? css.invCellOver : ''}`}
      style={tierColor ? { borderColor: tierColor } : undefined}
      draggable={!!item}
      onDragStart={e => {
        if (!item) return;
        e.dataTransfer.effectAllowed = 'move';
        dragRef.current = { item, source: 'bag', bagIdx: index };
        setDragging(true);
      }}
      onDragEnd={() => { setDragging(false); dragRef.current = null; }}
      onDragOver={e => {
        if (dragRef.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false);
        const drag = dragRef.current;
        if (!drag) return;
        if (drag.source === 'bag' && drag.bagIdx !== undefined && drag.bagIdx !== index)
          onMoveBag(drag.bagIdx, index);
        else if (drag.source === 'equip' && drag.slotId)
          onUnequip(drag.slotId);
        dragRef.current = null;
      }}
      onDoubleClick={() => { if (item) onEquip(item); }}
      onMouseMove={e => { if (item) onShowTooltip(item, e.clientX + 14, e.clientY + 14); }}
      onMouseLeave={() => onHideTooltip()}
      onContextMenu={e => { e.preventDefault(); if (item) onCtxMenu(item, e.clientX, e.clientY); }}
    >
      {item && (
        <>
          {item.iconUrl
            ? <img src={item.iconUrl} className={css.invIcon} alt={item.name} />
            : <div className={css.invSlotEmoji}>{SLOT_EMOJIS[item.slot] ?? '⚔️'}</div>
          }
          <span className={css.invTierBadge} style={{ color: tierColor }}>T{item.tier}</span>
        </>
      )}
    </div>
  );
}

// ── CharacterPage ──────────────────────────────────────────────

export default function CharacterPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('equip');

  // ── Reactive inventory state
  const [equipment, setEquipment] = useState<PlayerEquipment>(() => loadEquipment());
  const [bagItems,  setBagItems]  = useState<EquipmentBag>(()  => loadEquipmentBag());

  // ── UI overlay state
  const [tooltip, setTooltip] = useState<{ item: EquipmentInstance; x: number; y: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    item: EquipmentInstance;
    source: 'bag' | 'equip';
    slotId?: EquipSlot;
    x: number; y: number;
  } | null>(null);

  const dragRef = useRef<DragCtx>(null);

  // ── data rebuilt whenever equipment / bag changes (reactive derived stats)
  const data = useMemo(() => {
    const d = loadCharacterData();
    d.equipment  = equipment;
    d.equipSlots = EQUIP_SLOTS.map(s => ({ slot: s.id, label: s.label, icon: s.icon, item: equipment.slots[s.id] }));
    d.equipStats = computeEquipmentStats(equipment);
    d.setBonuses = computeSetBonuses(equipment);
    d.bagItems   = bagItems;
    if (d.hero && d.attributeSummary) {
      const { derived } = d.attributeSummary;
      d.hp = d.maxHp = d.hero.hp + derived.bonusHp + d.equipStats.hp;
      d.mp = d.maxMp = d.hero.mp + derived.bonusMp + d.equipStats.mp;
      d.atk = d.hero.atk + derived.bonusAtk + d.equipStats.atk;
      d.def = d.hero.def + derived.bonusDef + d.equipStats.def;
      d.spd = d.hero.spd + derived.bonusSpd + d.equipStats.spd;
    }
    return d;
  }, [equipment, bagItems]);

  // ── Canvas animation
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef  = useRef<VoxelRenderer | null>(null);
  useEffect(() => {
    if (!data.hero || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    if (!voxelRef.current) voxelRef.current = new VoxelRenderer();
    const voxel = voxelRef.current;
    const hero = data.hero;
    let animId = 0, t = 0;
    const animate = () => {
      t += 0.016;
      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const rc = RACE_COLORS[hero.race]  || '#888';
      const cc = CLASS_COLORS[hero.heroClass] || '#888';
      ctx.fillStyle = rc + '0a';
      ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2, 80, 0, Math.PI*2); ctx.fill();
      voxel.drawHeroVoxel(ctx, canvas.width/2, canvas.height/2+20, rc, cc, hero.heroClass,
        Math.sin(t*.4)*.2, 'idle', t, hero.race, hero.name);
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [data.hero]);

  // ── Persist helpers
  const persist = useCallback((eq: PlayerEquipment, bag: EquipmentBag) => {
    saveEquipment(eq);
    saveEquipmentBag(bag);
    const gid = localStorage.getItem('grudge_id');
    if (gid) fetch(`/api/characters/${gid}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment: eq, bagItems: bag }),
    }).catch(() => {});
  }, []);

  // ── Equip item from bag
  const handleEquip = useCallback((item: EquipmentInstance) => {
    const newBag: EquipmentBag = { ...bagItems, items: bagItems.items.filter(i => i.id !== item.id) };
    const displaced = equipment.slots[item.slot];
    const newEq: PlayerEquipment = { ...equipment, slots: { ...equipment.slots, [item.slot]: item } };
    if (displaced) newBag.items = [...newBag.items, displaced];
    setEquipment(newEq); setBagItems(newBag); persist(newEq, newBag); setCtxMenu(null);
  }, [equipment, bagItems, persist]);

  // ── Unequip slot to bag
  const handleUnequip = useCallback((slot: EquipSlot) => {
    const item = equipment.slots[slot];
    if (!item || bagItems.items.length >= bagItems.maxSlots) return;
    const newEq: PlayerEquipment = { ...equipment, slots: { ...equipment.slots, [slot]: null } };
    const newBag: EquipmentBag   = { ...bagItems,  items: [...bagItems.items, item] };
    setEquipment(newEq); setBagItems(newBag); persist(newEq, newBag); setCtxMenu(null);
  }, [equipment, bagItems, persist]);

  // ── Reorder within bag
  const handleMoveBag = useCallback((from: number, to: number) => {
    if (from === to) return;
    const items = [...bagItems.items];
    const fromItem = items[from];
    if (!fromItem) return;
    const toItem = items[to];
    if (toItem) { items[from] = toItem; items[to] = fromItem; }
    else { items.splice(from, 1); items.splice(Math.min(to, items.length), 0, fromItem); }
    const newBag = { ...bagItems, items };
    setBagItems(newBag); saveEquipmentBag(newBag);
  }, [bagItems]);

  // ── Destroy
  const handleDestroy = useCallback((item: EquipmentInstance, source: 'bag' | 'equip', slotId?: EquipSlot) => {
    if (source === 'bag') {
      const newBag = { ...bagItems, items: bagItems.items.filter(i => i.id !== item.id) };
      setBagItems(newBag); saveEquipmentBag(newBag);
    } else if (source === 'equip' && slotId) {
      const newEq = { ...equipment, slots: { ...equipment.slots, [slotId]: null } };
      setEquipment(newEq); saveEquipment(newEq);
    }
    setCtxMenu(null);
  }, [equipment, bagItems]);

  // ── Test loot fill
  const handleFillBag = useCallback(() => {
    const WPN = ['swords', 'bows', 'staffs', 'daggers', 'hammers', 'axes'];
    const items = [...bagItems.items];
    for (let i = 0; i < 12 && items.length < bagItems.maxSlots; i++) {
      if (i % 3 === 0) items.push(generateWeaponDrop(Math.ceil(Math.random()*5), WPN[i % WPN.length]));
      else             items.push(generateRandomEquipment(Math.ceil(Math.random()*5)));
    }
    const newBag = { ...bagItems, items };
    setBagItems(newBag); saveEquipmentBag(newBag);
  }, [bagItems]);

  // ── Guard
  if (!data.hero) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] text-white flex items-center justify-center flex-col gap-4">
        <p className="text-gray-400">No hero selected.</p>
        <Button variant="outline" onClick={() => setLocation('/character-select')}>Select Hero</Button>
      </div>
    );
  }

  const rarityColor = RARITY_COLORS[data.hero.rarity] || '#888';
  const hpPct = data.maxHp > 0 ? (data.hp / data.maxHp) * 100 : 0;
  const mpPct = data.maxMp > 0 ? (data.mp / data.maxMp) * 100 : 0;

  return (
    <div className={css.overlay} style={{ position: 'relative' }} onClick={() => setCtxMenu(null)}>

      {/* ═══ TOP BAR ═══ */}
      <div className={css.topBar}>
        <div className={css.logo}>
          <h1 className={css.logoTitle}>Grudge Warlords</h1>
          <span className={css.logoSub}>— {data.heroClass} —</span>
        </div>
        <div className={css.resourceBars}>
          <div className={css.resBar}>
            <div className={`${css.resFill} ${css.hpFill}`} style={{ width: `${hpPct}%` }} />
            <span className={css.resLabel}>{data.hp}/{data.maxHp}</span>
          </div>
          <div className={css.resBar}>
            <div className={`${css.resFill} ${css.mpFill}`} style={{ width: `${mpPct}%` }} />
            <span className={css.resLabel}>{data.mp}/{data.maxMp}</span>
          </div>
        </div>
        <div className={css.playerInfo}>
          <span className={css.playerName}>{data.heroName}</span>
          <span className={css.playerLevel}>Lv{data.level} {data.heroRace} {data.heroClass}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="outline" size="sm" onClick={() => setLocation('/character-select')}>Switch Hero</Button>
          <Button variant="outline" size="sm" onClick={() => setLocation('/island')}>Islands</Button>
          <Button variant="outline" size="sm" onClick={() => setLocation('/open-world')}>Play</Button>
          <Button variant="outline" size="sm" onClick={() => setLocation('/')}>Home</Button>
        </div>
      </div>

      {/* ═══ MAIN BODY ═══ */}
      <div className={css.mainBody}>

        {/* ── Left Column ── */}
        <div className={css.leftCol}>
          <div className={css.charPreview}>
            <canvas ref={canvasRef} width={200} height={200} style={{ display: 'block', borderRadius: 8 }} />
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: rarityColor, fontWeight: 700 }}>{data.hero.title}</div>
          </div>
          <div className={css.statSection}>
            <h3>Core Stats</h3>
            <div className={css.statRow}><span className={css.statKey}>ATK</span><span className={css.statVal}>{data.atk}</span></div>
            <div className={css.statRow}><span className={css.statKey}>DEF</span><span className={css.statVal}>{data.def}</span></div>
            <div className={css.statRow}><span className={css.statKey}>SPD</span><span className={css.statVal}>{data.spd}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Level</span><span className={css.statVal}>{data.level}</span></div>
          </div>
          {data.attributeSummary && (
            <div className={css.statSection}>
              <h3>Derived Stats</h3>
              <div className={css.statRow}><span className={css.statKey}>Bonus HP</span><span className={css.statValGreen}>+{data.attributeSummary.derived.bonusHp}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Bonus MP</span><span className={css.statVal}>+{data.attributeSummary.derived.bonusMp}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Phys ATK</span><span className={css.statVal}>+{data.attributeSummary.derived.bonusAtk}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Mag ATK</span><span className={css.statVal}>+{data.attributeSummary.derived.bonusMagicDmg}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Crit</span><span className={css.statVal}>{data.attributeSummary.derived.criticalChance.toFixed(1)}%</span></div>
              <div className={css.statRow}><span className={css.statKey}>Evasion</span><span className={css.statVal}>{data.attributeSummary.derived.evasionChance.toFixed(1)}%</span></div>
            </div>
          )}
          <div className={css.statSection}>
            <h3>Progress</h3>
            <div className={css.statRow}><span className={css.statKey}>Reputation</span><span className={css.statVal} style={{ color: data.reputationColor }}>{data.reputationRank}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Zones</span><span className={css.statVal}>{data.zonesDiscovered}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Kills</span><span className={css.statVal}>{data.monstersSlain}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Bosses</span><span className={css.statVal}>{data.bossesDefeated}</span></div>
          </div>
        </div>

        {/* ── Center Column: Tabs ── */}
        <div className={css.centerCol}>
          <div className={css.tabStrip}>
            {TABS.map(t => (
              <button key={t.id} className={tab === t.id ? css.tabBtnActive : css.tabBtn} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className={css.contentArea}>
            {tab === 'equip' && (
              <EquipmentTab
                data={data}
                dragRef={dragRef}
                onEquip={handleEquip}
                onUnequip={handleUnequip}
                onShowTooltip={(item, x, y) => setTooltip({ item, x, y })}
                onHideTooltip={() => setTooltip(null)}
                onCtxMenu={(item, source, x, y, slotId) => setCtxMenu({ item, source, slotId, x, y })}
              />
            )}
            {tab === 'attrs'    && <AttributesTab data={data} />}
            {tab === 'class'    && <ClassSkillsTab data={data} />}
            {tab === 'weapon'   && <WeaponSkillsTab data={data} />}
            {tab === 'upgrades' && <UpgradesTab />}
            {tab === 'crafting' && <CraftingTab data={data} />}
            {tab === 'quests'   && <QuestsTab data={data} />}
            {tab === 'guild'    && <GuildTab />}
          </div>
        </div>

        {/* ── Right Column: Inventory ── */}
        <div className={css.rightCol}>
          <div className={css.invHeader}>
            <h3>Inventory
              <span style={{ color: '#6b5535', fontSize: 10, fontFamily: 'monospace', marginLeft: 6 }}>
                {bagItems.items.length}/{bagItems.maxSlots}
              </span>
            </h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={css.goldDisplay}>🪙 {data.gold}</span>
              <button className={css.invFillBtn}
                onClick={e => { e.stopPropagation(); handleFillBag(); }}
                title="Generate test loot">
                + Loot
              </button>
            </div>
          </div>

          <div className={css.invGrid}>
            {Array.from({ length: 36 }).map((_, i) => (
              <InventoryCell
                key={i} index={i}
                item={bagItems.items[i]}
                dragRef={dragRef}
                onEquip={handleEquip}
                onUnequip={handleUnequip}
                onMoveBag={handleMoveBag}
                onShowTooltip={(item, x, y) => setTooltip({ item, x, y })}
                onHideTooltip={() => setTooltip(null)}
                onCtxMenu={(item, x, y) => setCtxMenu({ item, source: 'bag', x, y })}
              />
            ))}
          </div>

          {/* Trash zone */}
          <div
            className={css.trashZone}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={e => {
              e.preventDefault();
              const drag = dragRef.current;
              if (!drag) return;
              handleDestroy(drag.item, drag.source, drag.slotId);
              dragRef.current = null;
            }}
          >
            <div className={css.trashSlot}>🗑️</div>
            <span className={css.trashLabel}>Drag here to destroy</span>
          </div>
        </div>
      </div>

      {/* ═══ TOOLTIP ═══ */}
      {tooltip && (
        <div
          className={css.ttFixed}
          style={{
            left: Math.min(tooltip.x, window.innerWidth  - 290),
            top:  Math.min(tooltip.y, window.innerHeight - 220),
          }}
        >
          <ItemTooltip item={tooltip.item} />
        </div>
      )}

      {/* ═══ CONTEXT MENU ═══ */}
      {ctxMenu && (
        <>
          {/* Backdrop to close on outside click */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 99997 }} onClick={() => setCtxMenu(null)} />
          <div
            className={css.ctxMenu}
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth  - 170),
              top:  Math.min(ctxMenu.y, window.innerHeight - 180),
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className={css.ctxItemName}>{ctxMenu.item.name}</div>
            <div className={css.ctxSep} />
            {ctxMenu.source === 'bag' && (
              <div className={css.ctxItem} onClick={() => handleEquip(ctxMenu.item)}>
                ⚔️ Equip
              </div>
            )}
            {ctxMenu.source === 'equip' && ctxMenu.slotId && (
              <div className={css.ctxItem} onClick={() => handleUnequip(ctxMenu.slotId!)}>
                📦 Unequip
              </div>
            )}
            <div className={css.ctxItem} onClick={() => {
              setTooltip({ item: ctxMenu.item, x: ctxMenu.x + 12, y: ctxMenu.y });
              setCtxMenu(null);
            }}>
              🔍 Inspect
            </div>
            <div className={css.ctxSep} />
            <div
              className={`${css.ctxItem} ${css.ctxItemDanger}`}
              onClick={() => handleDestroy(ctxMenu.item, ctxMenu.source, ctxMenu.slotId)}
            >
              🗑️ Destroy
            </div>
          </div>
        </>
      )}
    </div>
  );
}
