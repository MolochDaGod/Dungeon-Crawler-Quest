import { useState } from 'react';
import css from './MainPanel.module.css';
import { OWHudState } from '@/game/open-world';
import { OpenWorldState } from '@/game/open-world';
import { allocateOWAttribute, claimOWMission } from '@/game/open-world';
import { AttributeId } from '@/game/attributes';
import { HeroData, AbilityDef, CLASS_COLORS, ABILITY_ICONS } from '@/game/types';

/* ── Emoji helpers for attributes ── */
const ATTR_EMOJI: Record<string, string> = {
  strength: '💪', intellect: '🧠', vitality: '❤️', dexterity: '🎯',
  endurance: '🛡️', wisdom: '📖', agility: '🏃', tactics: '⚔️',
};

/* ── Tab definitions ── */
type Tab = 'equip' | 'attrs' | 'class' | 'weapon' | 'upgrades' | 'crafting' | 'quests' | 'guild';
const TABS: { id: Tab; label: string }[] = [
  { id: 'equip', label: 'Equipment' },
  { id: 'attrs', label: 'Attributes' },
  { id: 'class', label: 'Class Skills' },
  { id: 'weapon', label: 'Weapon Skills' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'quests', label: 'Quests' },
  { id: 'guild', label: 'Guild' },
];

/* ── Equipment slot layout ── */
const LEFT_EQUIP = ['Helm', 'Chest', 'Legs', 'Boots'];
const RIGHT_EQUIP = ['Mainhand', 'Offhand', 'Ring', 'Cape'];

interface Props {
  hud: OWHudState;
  stateRef: React.MutableRefObject<OpenWorldState | null>;
  heroData: HeroData | undefined;
  abilities: AbilityDef[];
  abilityNames: string[];
  abilityDescs: string[];
  onClose: () => void;
}

export default function MainPanel({ hud, stateRef, heroData, abilities, abilityNames, abilityDescs, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('equip');

  const hpPct = hud.maxHp > 0 ? (hud.hp / hud.maxHp) * 100 : 0;
  const mpPct = hud.maxMp > 0 ? (hud.mp / hud.maxMp) * 100 : 0;
  const stPct = hud.maxStamina > 0 ? (hud.stamina / hud.maxStamina) * 100 : 0;

  /* ── Equipment slot lookup ── */
  const eqMap = new Map(hud.equipSlots.map(s => [s.label, s]));

  return (
    <div className={css.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* ═══ TOP BAR ═══ */}
      <div className={css.topBar}>
        <div className={css.logo}>
          <h1 className={css.logoTitle}>Grudge Warlords</h1>
          <span className={css.logoSub}>— {hud.heroClass} —</span>
        </div>

        <div className={css.resourceBars}>
          <div className={css.resBar}>
            <div className={`${css.resFill} ${css.hpFill}`} style={{ width: `${hpPct}%` }} />
            <span className={css.resLabel}>{hud.hp}/{hud.maxHp}</span>
          </div>
          <div className={css.resBar}>
            <div className={`${css.resFill} ${css.mpFill}`} style={{ width: `${mpPct}%` }} />
            <span className={css.resLabel}>{hud.mp}/{hud.maxMp}</span>
          </div>
          <div className={css.resBar}>
            <div className={`${css.resFill} ${css.spFill}`} style={{ width: `${stPct}%` }} />
            <span className={css.resLabel}>{Math.round(hud.stamina)}/{hud.maxStamina}</span>
          </div>
        </div>

        <div className={css.playerInfo}>
          <span className={css.playerName}>{hud.heroName}</span>
          <span className={css.playerLevel}>Lv{hud.level} {hud.heroRace} {hud.heroClass}</span>
        </div>

        <button className={css.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* ═══ MAIN BODY ═══ */}
      <div className={css.mainBody}>

        {/* ── Left Column: Character Preview + Stats ── */}
        <div className={css.leftCol}>
          <div className={css.charPreview}>
            <div className={css.charSilhouette}>{hud.heroRace}<br />{hud.heroClass}</div>
          </div>

          {/* Core Stats */}
          <div className={css.statSection}>
            <h3>Core Stats</h3>
            <div className={css.statRow}><span className={css.statKey}>ATK</span><span className={css.statVal}>{hud.atk}</span></div>
            <div className={css.statRow}><span className={css.statKey}>DEF</span><span className={css.statVal}>{hud.def}</span></div>
            <div className={css.statRow}><span className={css.statKey}>SPD</span><span className={css.statVal}>{hud.spd}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Level</span><span className={css.statVal}>{hud.level}</span></div>
            <div className={css.statRow}><span className={css.statKey}>XP</span><span className={css.statVal}>{hud.xp}/{hud.xpToNext}</span></div>
          </div>

          {/* Derived Stats */}
          {hud.attributeSummary && (
            <div className={css.statSection}>
              <h3>Derived Stats</h3>
              <div className={css.statRow}><span className={css.statKey}>Bonus HP</span><span className={css.statValGreen}>+{hud.attributeSummary.derived.bonusHp}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Bonus MP</span><span className={css.statVal}>+{hud.attributeSummary.derived.bonusMp}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Phys ATK</span><span className={css.statVal}>+{hud.attributeSummary.derived.bonusAtk}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Mag ATK</span><span className={css.statVal}>+{hud.attributeSummary.derived.bonusMagicDmg}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Crit</span><span className={css.statVal}>{hud.attributeSummary.derived.critChance.toFixed(1)}%</span></div>
              <div className={css.statRow}><span className={css.statKey}>Evasion</span><span className={css.statVal}>{hud.attributeSummary.derived.evasionChance.toFixed(1)}%</span></div>
            </div>
          )}

          {/* Reputation / Progress */}
          <div className={css.statSection}>
            <h3>Progress</h3>
            <div className={css.statRow}><span className={css.statKey}>Reputation</span><span className={css.statVal} style={{ color: hud.reputationColor }}>{hud.reputationRank}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Zones</span><span className={css.statVal}>{hud.zonesDiscovered}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Kills</span><span className={css.statVal}>{hud.monstersSlain}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Bosses</span><span className={css.statVal}>{hud.bossesDefeated}</span></div>
          </div>
        </div>

        {/* ── Center Column: Tabs ── */}
        <div className={css.centerCol}>
          <div className={css.tabStrip}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={tab === t.id ? css.tabBtnActive : css.tabBtn}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
          </div>
          <div className={css.contentArea}>

            {/* ── Equipment ── */}
            {tab === 'equip' && <EquipmentTab hud={hud} eqMap={eqMap} />}

            {/* ── Attributes ── */}
            {tab === 'attrs' && <AttributesTab hud={hud} stateRef={stateRef} />}

            {/* ── Class Skills ── */}
            {tab === 'class' && <ClassSkillsTab hud={hud} abilities={abilities} />}

            {/* ── Weapon Skills ── */}
            {tab === 'weapon' && <WeaponSkillsTab hud={hud} abilityNames={abilityNames} abilityDescs={abilityDescs} />}

            {/* ── Upgrades (placeholder) ── */}
            {tab === 'upgrades' && <UpgradesTab />}

            {/* ── Crafting / Professions ── */}
            {tab === 'crafting' && <CraftingTab hud={hud} />}

            {/* ── Quests ── */}
            {tab === 'quests' && <QuestsTab hud={hud} stateRef={stateRef} />}

            {/* ── Guild (placeholder) ── */}
            {tab === 'guild' && <GuildTab />}
          </div>
        </div>

        {/* ── Right Column: Inventory ── */}
        <div className={css.rightCol}>
          <div className={css.invHeader}>
            <h3>Inventory</h3>
            <span className={css.goldDisplay}>🪙 {hud.gold}</span>
          </div>
          <div className={css.invGrid}>
            {Array.from({ length: 36 }).map((_, i) => {
              const item = hud.bagItems[i];
              return (
                <div key={i} className={`${css.invCell} ${item ? css.invCellFilled : ''}`} title={item ? `T${item.tier} ${item.name}` : 'Empty'}>
                  {item && <span style={{ fontSize: 9, color: '#f5e2c1', textAlign: 'center', display: 'block', lineHeight: '1.1', padding: 2, overflow: 'hidden' }}>{item.name}</span>}
                </div>
              );
            })}
          </div>
          <div className={css.trashZone}>
            <div className={css.trashSlot}>🗑</div>
            <span className={css.trashLabel}>Drag to destroy</span>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM BAR — Hotbar ═══ */}
      <div className={css.bottomBar}>
        <div className={css.hotbar}>
          {Array.from({ length: 10 }).map((_, i) => {
            const key = i < 9 ? `${i + 1}` : '0';
            // Slots 0-3 = abilities, 4 = empty, 5-9 = consumables (future)
            const isAbility = i < 4;
            const cd = isAbility ? hud.abilityCooldowns[i] : 0;
            const name = isAbility ? (abilityNames[i] || abilities[i]?.name || '') : '';
            return (
              <div key={i} className={css.hbSlot} title={name} style={cd > 0 ? { opacity: 0.5 } : undefined}>
                <span className={css.hbKey}>{key}</span>
                {isAbility && name && <span style={{ fontSize: 8, textAlign: 'center', color: '#f5e2c1', lineHeight: 1.1 }}>{name.slice(0, 6)}</span>}
                {cd > 0 && <span style={{ position: 'absolute', bottom: 2, fontSize: 8, color: '#d4a400' }}>{cd.toFixed(1)}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TAB COMPONENTS
   ════════════════════════════════════════════════════════════════ */

/* ── Equipment Tab ── */
function EquipmentTab({ hud, eqMap }: { hud: OWHudState; eqMap: Map<string, typeof hud.equipSlots[0]> }) {
  const renderSlot = (label: string) => {
    const slot = eqMap.get(label);
    return (
      <div className={css.eqSlot} key={label} title={slot?.item ? `${slot.item.name} (T${slot.item.tier})` : label}>
        <span className={css.eqSlotLabel}>{slot?.icon || '·'} {label}</span>
        {slot?.item ? (
          <span className={css.eqSlotItem}>{slot.item.name}</span>
        ) : (
          <span className={css.eqSlotItem} style={{ color: '#6b5535' }}>Empty</span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={css.sectionTitle}>Equipped Gear</div>
      <div className={css.equipLayout}>
        <div className={css.equipStack}>{LEFT_EQUIP.map(renderSlot)}</div>
        <div className={css.eqCenter}>{hud.heroRace}<br />{hud.heroClass}</div>
        <div className={css.equipStack}>{RIGHT_EQUIP.map(renderSlot)}</div>
      </div>

      {hud.setBonuses.length > 0 && (
        <>
          <div className={css.sectionTitle}>Set Bonuses</div>
          {hud.setBonuses.map((sb, i) => (
            <div key={i} style={{ fontSize: 12, color: '#a87ddb', marginBottom: 4 }}>{sb.setName} ({sb.pieces}pc active)</div>
          ))}
        </>
      )}
    </>
  );
}

/* ── Attributes Tab ── */
function AttributesTab({ hud, stateRef }: { hud: OWHudState; stateRef: React.MutableRefObject<OpenWorldState | null> }) {
  const summary = hud.attributeSummary;
  if (!summary) return null;

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
              <button className={css.attrBtn} onClick={() => stateRef.current && allocateOWAttribute(stateRef.current, attr.id as AttributeId)}>+</button>
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

/* ── Class Skills Tab ── */
function ClassSkillsTab({ hud, abilities }: { hud: OWHudState; abilities: AbilityDef[] }) {
  const tierMap: Record<string, AbilityDef[]> = {};
  abilities.forEach(ab => {
    const tier = ab.slot || 'core';
    (tierMap[tier] ||= []).push(ab);
  });

  return (
    <>
      <div className={css.sectionTitle}>{hud.heroClass} Class Abilities</div>
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
                    <span style={{ color: CLASS_COLORS[hud.heroClass] || '#d4a400' }}>{ab.name.substring(0, 2)}</span>
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

/* ── Weapon Skills Tab ── */
function WeaponSkillsTab({ hud, abilityNames, abilityDescs }: { hud: OWHudState; abilityNames: string[]; abilityDescs: string[] }) {
  return (
    <>
      <div className={css.sectionTitle}>
        Weapon Skills
        {hud.weaponType && <span style={{ color: '#9b7d52', fontSize: 10, marginLeft: 8 }}>({hud.weaponType})</span>}
      </div>
      {hud.weaponLoadoutReady ? (
        <div className={css.skillGrid}>
          {abilityNames.map((name, i) => (
            <div key={i} className={css.skillNode}>
              <div className={css.skIcon}>
                <span style={{ color: '#d4a400', fontWeight: 700 }}>{i + 1}</span>
              </div>
              <div>
                <div className={css.skName}>{name}</div>
                <div className={css.skDesc}>{abilityDescs[i]}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b5535' }}>
          No weapon loadout active. Equip a weapon to unlock skills.
        </div>
      )}
    </>
  );
}

/* ── Upgrades Tab (placeholder) ── */
function UpgradesTab() {
  return (
    <>
      <div className={css.sectionTitle}>Upgrades</div>
      <div className={css.upgradeGrid}>
        {['Armor Reinforcement', 'Weapon Sharpening', 'Mana Conduit', 'Swift Feet'].map(name => (
          <div key={name} className={css.upgradeCard}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f5e2c1', marginBottom: 4 }}>{name}</div>
            <div style={{ fontSize: 10, color: '#9b7d52' }}>Coming soon — upgrade your gear and abilities.</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Crafting / Professions Tab ── */
function CraftingTab({ hud }: { hud: OWHudState }) {
  return (
    <>
      <div className={css.sectionTitle}>Gathering Professions</div>
      {hud.gatheringProfs.map(g => (
        <div key={g.id} className={css.profRow}>
          <span className={css.profIcon}>{g.icon}</span>
          <div className={css.profInfo}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: g.color }}>{g.name}</span>
              <span style={{ color: '#9b7d52' }}>Lv{g.level}</span>
            </div>
            <div className={css.profBar}>
              <div className={css.profFill} style={{ width: `${(g.xp / g.xpToNext) * 100}%`, background: g.color }} />
            </div>
            <div style={{ fontSize: 9, color: '#6b5535', marginTop: 2 }}>Tier {g.tier} — <span style={{ color: g.tierColor }}>{g.tierName}</span></div>
          </div>
        </div>
      ))}

      <div className={css.sectionTitle}>Crafting Professions</div>
      {hud.craftingProfs.map(c => (
        <div key={c.id} className={css.profRow}>
          <span className={css.profIcon}>{c.icon}</span>
          <div className={css.profInfo}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: c.color }}>{c.name}</span>
              <span style={{ color: '#9b7d52' }}>Lv{c.level}</span>
            </div>
            <div className={css.profBar}>
              <div className={css.profFill} style={{ width: `${(c.xp / c.xpToNext) * 100}%`, background: c.color }} />
            </div>
            <div style={{ fontSize: 9, color: '#6b5535', marginTop: 2 }}>Tier {c.tier} — <span style={{ color: c.tierColor }}>{c.tierName}</span></div>
          </div>
        </div>
      ))}

      <div className={css.sectionTitle}>Crafting Station</div>
      <div className={css.craftLayout}>
        <div className={css.craftSlots}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={css.craftSlot}>Slot {i + 1}</div>
          ))}
        </div>
        <div className={css.craftArrow}>⟹</div>
        <div className={css.craftResult}>Result</div>
        <button className={css.craftBtn}>Craft</button>
      </div>
    </>
  );
}

/* ── Quests Tab ── */
function QuestsTab({ hud, stateRef }: { hud: OWHudState; stateRef: React.MutableRefObject<OpenWorldState | null> }) {
  return (
    <>
      <div className={css.sectionTitle}>Active Quests</div>
      {hud.activeMissions.length > 0 ? (
        hud.activeMissions.map(m => (
          <div key={m.id} className={css.questCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={css.qTitle}>{m.name}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: m.status === 'complete' ? 'rgba(110,201,110,.15)' : 'rgba(132,178,255,.15)',
                color: m.status === 'complete' ? '#6ec96e' : '#84b2ff',
              }}>{m.status === 'complete' ? 'COMPLETE' : 'ACTIVE'}</span>
            </div>
            {m.objectives.map((o, oi) => (
              <div key={oi} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className={css.qDesc} style={{ textTransform: 'capitalize' }}>{o.type}: {o.target}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: o.current >= o.required ? '#6ec96e' : '#d4a400' }}>{o.current}/{o.required}</span>
              </div>
            ))}
            {m.objectives.length > 0 && (
              <div className={css.qProgress}>
                <div className={css.qFill} style={{ width: `${(m.objectives.reduce((a, o) => a + Math.min(o.current, o.required), 0) / m.objectives.reduce((a, o) => a + o.required, 0)) * 100}%` }} />
              </div>
            )}
            {m.status === 'complete' && (
              <button className={css.craftBtn} style={{ marginTop: 8, width: '100%' }}
                onClick={() => stateRef.current && claimOWMission(stateRef.current, m.id)}
              >Claim Reward</button>
            )}
          </div>
        ))
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b5535' }}>
          No active quests. Visit NPCs or press J to browse available missions.
        </div>
      )}
    </>
  );
}

/* ── Guild Tab (placeholder) ── */
function GuildTab() {
  return (
    <>
      <div className={css.guildHeader}>
        <div className={css.guildCrest}>⚔</div>
        <div>
          <div className={css.guildName}>Your Guild</div>
          <div style={{ fontSize: 11, color: '#9b7d52' }}>Create or join a guild to unlock features</div>
        </div>
      </div>
      <div className={css.sectionTitle}>Members</div>
      <div style={{ textAlign: 'center', padding: 20, color: '#6b5535', fontSize: 11 }}>
        Guild system coming soon. Form crews, claim territory, and compete for faction dominance.
      </div>
    </>
  );
}
