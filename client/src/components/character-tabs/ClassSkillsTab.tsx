import css from '../MainPanel.module.css';
import { CharacterData } from '@/game/character-data';
import { CLASS_COLORS, ABILITY_ICONS, AbilityDef } from '@/game/types';

export function ClassSkillsTab({ data }: { data: CharacterData }) {
  const tierMap: Record<string, AbilityDef[]> = {};
  data.classAbilities.forEach(ab => {
    const tier = ab.slot || 'core';
    (tierMap[tier] ||= []).push(ab);
  });

  return (
    <>
      <div className={css.sectionTitle}>{data.heroClass} Class Abilities</div>
      {Object.entries(tierMap).map(([tier, abs]) => (
        <div key={tier} className={css.skillTier}>
          <div className={css.tierLabel}>{tier}</div>
          <div className={css.skillGrid}>
            {abs.map((ab, i) => (
              <div key={i} className={css.skillNode}>
                <div className={css.skIcon}>
                  {ABILITY_ICONS[ab.name] ? (
                    <img src={ABILITY_ICONS[ab.name]} alt={ab.name} style={{ width: 28, height: 28, borderRadius: 6 }} draggable={false} />
                  ) : (
                    <span style={{ color: CLASS_COLORS[data.heroClass] || '#d4a400' }}>{ab.name.substring(0, 2)}</span>
                  )}
                </div>
                <div>
                  <div className={css.skName}>{ab.name} <span style={{ color: '#6b5535' }}>[{ab.key}]</span></div>
                  <div className={css.skDesc}>{ab.description}</div>
                  <div className={css.skMeta}>
                    {ab.damage > 0 && <span className={`${css.chip} ${css.chipDmg}`}>{ab.damage} DMG</span>}
                    <span className={`${css.chip} ${css.chipCd}`}>{ab.cooldown}s CD</span>
                    {ab.manaCost > 0 && <span className={`${css.chip} ${css.chipBuff}`}>{ab.manaCost} MP</span>}
                    {ab.type === 'heal' && <span className={`${css.chip} ${css.chipHeal}`}>HEAL</span>}
                    {ab.type === 'buff' && <span className={`${css.chip} ${css.chipBuff}`}>BUFF</span>}
                    {ab.effect && <span className={`${css.chip} ${css.chipCc}`}>{ab.effect}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
