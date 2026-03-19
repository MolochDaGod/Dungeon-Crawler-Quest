import { useState } from 'react';
import css from '../MainPanel.module.css';
import { CharacterData } from '@/game/character-data';
import { AttributeId } from '@/game/attributes';

const ATTR_EMOJI: Record<string, string> = {
  strength: '💪', intellect: '🧠', vitality: '❤️', dexterity: '🎯',
  endurance: '🛡️', wisdom: '📖', agility: '🏃', tactics: '⚔️',
};

interface DerivedRow { label: string; val: string; icon: string; color?: string }

export function AttributesTab({ data }: { data: CharacterData }) {
  const [, forceUpdate] = useState(0);
  const summary = data.attributeSummary;
  if (!summary) return null;
  const d = summary.derived;

  const handleAllocate = (id: AttributeId) => {
    data.allocateAttribute(id);
    forceUpdate(n => n + 1);
  };

  const fmt = (n: number, dec = 1) => n.toFixed(dec);
  const pct = (n: number) => `${fmt(n)}%`;

  const resources: DerivedRow[] = [
    { label: 'Bonus HP',      val: `+${Math.floor(d.health)}`,  icon: '❤️', color: '#ef4444' },
    { label: 'Bonus MP',      val: `+${Math.floor(d.mana)}`,    icon: '💧', color: '#3b82f6' },
    { label: 'Bonus Stamina',  val: `+${Math.floor(d.stamina)}`, icon: '⚡', color: '#f59e0b' },
  ];

  const offense: DerivedRow[] = [
    { label: 'Damage',         val: `+${fmt(d.damage)}`,         icon: '⚔️' },
    { label: 'Crit Chance',    val: pct(d.criticalChance),        icon: '💥', color: '#f59e0b' },
    { label: 'Crit Damage',    val: `×${fmt(d.criticalDamage, 2)}`, icon: '🔥' },
    { label: 'Attack Speed',   val: `+${pct(d.attackSpeed)}`,     icon: '⚡' },
    { label: 'Accuracy',       val: pct(d.accuracy),              icon: '🎯' },
    { label: 'Spell Accuracy', val: pct(d.spellAccuracy),         icon: '✨' },
    { label: 'Armor Pen',      val: pct(d.armorPenetration),      icon: '🗡️' },
    { label: 'Block Pen',      val: pct(d.blockPenetration),      icon: '🔓' },
    { label: 'Def Break',      val: pct(d.defenseBreak),          icon: '💔' },
    { label: 'Stagger',        val: pct(d.stagger),               icon: '🌀' },
    { label: 'Lifesteal',      val: pct(d.drainHealth),           icon: '🧛', color: '#be123c' },
  ];

  const defense: DerivedRow[] = [
    { label: 'Defense',        val: `+${Math.floor(d.defense)}`,  icon: '🛡️' },
    { label: 'Block Chance',   val: pct(d.block),                 icon: '🪨', color: '#6366f1' },
    { label: 'Block Effect',   val: pct(d.blockEffect),           icon: '🛡️' },
    { label: 'Evasion',        val: pct(d.evasion),               icon: '💨', color: '#10b981' },
    { label: 'Resistance',     val: pct(d.resistance),            icon: '🔮' },
    { label: 'Armor',          val: `+${fmt(d.armor)}`,           icon: '🪖' },
    { label: 'CC Resist',      val: pct(d.ccResistance),          icon: '⛓️' },
    { label: 'Crit Evasion',   val: pct(d.criticalEvasion),       icon: '🌀' },
    { label: 'Bleed Resist',   val: pct(d.bleedResist),           icon: '🩸' },
  ];

  const utility: DerivedRow[] = [
    { label: 'Move Speed',     val: `+${pct(d.movementSpeed)}`,   icon: '🏃', color: '#10b981' },
    { label: 'CDR',            val: pct(d.cooldownReduction),     icon: '⏱️' },
    { label: 'HP Regen',       val: `${fmt(d.healthRegen, 2)}/s`, icon: '💚' },
    { label: 'MP Regen',       val: `${fmt(d.manaRegen, 2)}/s`,   icon: '💧' },
    { label: 'Dodge CDR',      val: pct(d.dodge),                 icon: '💨' },
    { label: 'Ability Cost',   val: `-${pct(d.abilityCost)}`,     icon: '📘' },
    { label: 'Heal Power',     val: `×${fmt(d.healPower, 2)}`,    icon: '💚' },
    { label: 'Fall Dmg Reduce', val: pct(d.fallDamage),            icon: '🪂' },
  ];

  const renderSection = (title: string, rows: DerivedRow[]) => (
    <>
      <div className={css.sectionTitle} style={{ fontSize: 11, opacity: 0.75, marginTop: 10, marginBottom: 4 }}>{title}</div>
      <div className={css.attrGrid}>
        {rows.map(r => (
          <div key={r.label} className={css.attrCard} style={{ padding: '6px 10px' }}>
            <div className={css.attrIcon} style={{ fontSize: 13 }}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <div className={css.attrName} style={{ fontSize: 10 }}>{r.label}</div>
            </div>
            <div className={css.attrVal} style={{ fontSize: 11, color: r.color || '#f5e2c1' }}>{r.val}</div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <div className={css.sectionTitle}>
        Attributes
        {summary.unspentPoints > 0 && <span style={{ color: '#6ec96e', fontSize: 11, marginLeft: 8 }}>({summary.unspentPoints} pts)</span>}
      </div>
      <div className={css.attrGrid}>
        {summary.attrs.map(attr => (
          <div key={attr.id} className={css.attrCard}>
            <div className={css.attrIcon}>{ATTR_EMOJI[attr.id] || '✦'}</div>
            <div>
              <div className={css.attrName}>{attr.name}</div>
              <div className={css.attrVal}>{attr.total}</div>
              <div className={css.attrDesc}>{attr.short} — base {attr.base} +{attr.bonus}</div>
            </div>
            {summary.unspentPoints > 0 && (
              <button className={css.attrBtn} onClick={() => handleAllocate(attr.id)}>+</button>
            )}
          </div>
        ))}
      </div>

      {renderSection('⚔️ Resources', resources)}
      {renderSection('⚔️ Offense', offense)}
      {renderSection('🛡️ Defense', defense)}
      {renderSection('🔧 Utility', utility)}
    </>
  );
}
