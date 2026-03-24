import { useState } from 'react';
import css from '../MainPanel.module.css';
import { CharacterData } from '@/game/character-data';
import { EquipmentInstance, EquipSlot } from '@/game/equipment';
import { HeroPreview } from './HeroPreview';

// ── Display helpers ────────────────────────────────────────────

export const TIER_COLORS: Record<number, string> = {
  1: '#9ca3af', 2: '#22c55e', 3: '#3b82f6',
  4: '#a855f7', 5: '#ffd700', 6: '#f97316', 7: '#ef4444', 8: '#ff4fd8',
};

export const SLOT_EMOJIS: Record<string, string> = {
  helm: '🪖', shoulder: '🦺', chest: '👘', hands: '🧤', feet: '👟',
  ring: '💍', necklace: '📿', cape: '🧣', mainhand: '⚔️', offhand: '🛡️',
};

const LEFT_SLOTS:  EquipSlot[] = ['helm', 'shoulder', 'chest', 'hands', 'feet'];
const RIGHT_SLOTS: EquipSlot[] = ['necklace', 'ring', 'cape', 'mainhand', 'offhand'];

export type DragCtx = {
  item: EquipmentInstance;
  source: 'bag' | 'equip';
  slotId?: EquipSlot;
  bagIdx?: number;
} | null;

// ── Props ───────────────────────────────────────────────────────

export interface EquipmentTabProps {
  data: CharacterData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragRef: React.MutableRefObject<any>;
  onEquip: (item: EquipmentInstance) => void;
  onUnequip: (slot: EquipSlot) => void;
  onShowTooltip: (item: EquipmentInstance, x: number, y: number) => void;
  onHideTooltip: () => void;
  onCtxMenu: (item: EquipmentInstance, source: 'bag' | 'equip', x: number, y: number, slotId?: EquipSlot) => void;
}

// ── Single equip slot ───────────────────────────────────────────

interface SlotProps {
  slotId: EquipSlot;
  label: string;
  icon: string;
  item: EquipmentInstance | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragRef: React.MutableRefObject<any>;
  onEquip: (item: EquipmentInstance) => void;
  onUnequip: (slot: EquipSlot) => void;
  onShowTooltip: (item: EquipmentInstance, x: number, y: number) => void;
  onHideTooltip: () => void;
  onCtxMenu: (item: EquipmentInstance, source: 'bag' | 'equip', x: number, y: number, slotId?: EquipSlot) => void;
}

function EquipSlotCell({ slotId, label, icon, item, dragRef, onEquip, onUnequip, onShowTooltip, onHideTooltip, onCtxMenu }: SlotProps) {
  const [over, setOver] = useState(false);
  const tierColor = item ? (TIER_COLORS[item.tier] ?? '#9ca3af') : undefined;

  return (
    <div
      className={`${css.eqSlot} ${over ? css.eqSlotOver : ''}`}
      style={tierColor ? { borderColor: tierColor } : undefined}
      title={item ? `${item.name} (T${item.tier})` : label}
      draggable={!!item}
      onDragStart={e => {
        if (!item) return;
        e.dataTransfer.effectAllowed = 'move';
        dragRef.current = { item, source: 'equip', slotId };
      }}
      onDragEnd={() => { dragRef.current = null; }}
      onDragOver={e => {
        const drag: DragCtx = dragRef.current;
        if (drag?.source === 'bag' && drag.item.slot === slotId) {
          e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false);
        const drag: DragCtx = dragRef.current;
        if (drag?.source === 'bag' && drag.item.slot === slotId) onEquip(drag.item);
        dragRef.current = null;
      }}
      onDoubleClick={() => { if (item) onUnequip(slotId); }}
      onMouseMove={e => { if (item) onShowTooltip(item, e.clientX + 14, e.clientY + 14); }}
      onMouseLeave={() => onHideTooltip()}
      onContextMenu={e => {
        e.preventDefault();
        if (item) onCtxMenu(item, 'equip', e.clientX, e.clientY, slotId);
      }}
    >
      {/* Icon */}
      <div style={{ width: 40, height: 40, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item ? (
          <>
            {item.iconUrl
              ? <img src={item.iconUrl} className={css.invIcon} alt={item.name} />
              : <div className={css.invSlotEmoji} style={{ fontSize: 22 }}>{SLOT_EMOJIS[slotId] ?? '⚔️'}</div>
            }
            <span className={css.invTierBadge} style={{ color: tierColor }}>T{item.tier}</span>
          </>
        ) : (
          <div className={css.invSlotEmoji} style={{ fontSize: 22, opacity: 0.3 }}>{icon}</div>
        )}
      </div>
      {/* Label */}
      <span className={css.eqSlotLabel}>{label}</span>
      {/* Item name */}
      {item
        ? <span className={css.eqSlotItem} style={{ color: tierColor, fontSize: 8, maxWidth: 68, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</span>
        : <span className={css.eqSlotItem} style={{ color: '#4a3520' }}>Empty</span>
      }
    </div>
  );
}

// ── EquipmentTab ────────────────────────────────────────────────

export function EquipmentTab({ data, dragRef, onEquip, onUnequip, onShowTooltip, onHideTooltip, onCtxMenu }: EquipmentTabProps) {
  const slotMap = new Map(data.equipSlots.map(s => [s.slot, s]));

  const renderSlot = (slotId: EquipSlot) => {
    const info = slotMap.get(slotId);
    if (!info) return null;
    return (
      <EquipSlotCell
        key={slotId} slotId={slotId}
        label={info.label} icon={info.icon} item={info.item}
        dragRef={dragRef}
        onEquip={onEquip} onUnequip={onUnequip}
        onShowTooltip={onShowTooltip} onHideTooltip={onHideTooltip}
        onCtxMenu={onCtxMenu}
      />
    );
  };

  return (
    <>
      <div className={css.sectionTitle}>Equipped Gear</div>
      <div className={css.equipLayout}>
        <div className={css.equipStack}>{LEFT_SLOTS.map(renderSlot)}</div>
        <div className={css.eqCenter}>
          <HeroPreview data={data} size={120} showName={false} showStats={false} animate={true} />
        </div>
        <div className={css.equipStack}>{RIGHT_SLOTS.map(renderSlot)}</div>
      </div>
      {data.setBonuses.length > 0 && (
        <>
          <div className={css.sectionTitle}>Set Bonuses</div>
          {data.setBonuses.map((sb, i) => (
            <div key={i} style={{ fontSize: 12, color: '#a87ddb', marginBottom: 4 }}>
              {sb.setName} ({sb.pieces}pc active)
            </div>
          ))}
        </>
      )}
    </>
  );
}
