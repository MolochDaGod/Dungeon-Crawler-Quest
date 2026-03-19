import { useState } from 'react';
import css from '../MainPanel.module.css';
import { CharacterData } from '@/game/character-data';
import { AttributeId } from '@/game/attributes';

const ATTR_EMOJI: Record<string, string> = {
  strength: '💪', intellect: '🧠', vitality: '❤️', dexterity: '🎯',
  endurance: '🛡️', wisdom: '📖', agility: '🏃', tactics: '⚔️',
};

export function AttributesTab({ data }: { data: CharacterData }) {
  const [, forceUpdate] = useState(0);
  const summary = data.attributeSummary;
  if (!summary) return null;

  const handleAllocate = (id: AttributeId) => {
    data.allocateAttribute(id);
    forceUpdate(n => n + 1);
  };

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

      <div className={css.sectionTitle}>Derived Bonuses</div>
      <div className={css.attrGrid}>
        {[
          { label: 'Heal Power', val: `×${summary.derived.healPower.toFixed(2)}`, icon: '💚' },
          { label: 'Ability Bonus', val: `×${summary.derived.abilityBonus.toFixed(2)}`, icon: '🔮' },
          { label: 'Crit Chance', val: `${summary.derived.critChance.toFixed(1)}%`, icon: '💥' },
          { label: 'Evasion', val: `${summary.derived.evasionChance.toFixed(1)}%`, icon: '🌀' },
        ].map(d => (
          <div key={d.label} className={css.attrCard}>
            <div className={css.attrIcon}>{d.icon}</div>
            <div>
              <div className={css.attrName}>{d.label}</div>
              <div className={css.attrVal}>{d.val}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
