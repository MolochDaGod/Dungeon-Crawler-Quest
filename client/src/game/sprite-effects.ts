// ── ObjectStore CDN base ────────────────────────────────────────
const OS = 'https://molochdagod.github.io/ObjectStore';

// ── Sprite Effect Types ────────────────────────────────────────
export type SpriteEffectType =
  // Legacy pixel-pack effects (local assets)
  | 'mage_ability' | 'mage_attack' | 'frost' | 'channel' | 'magic_impact'
  | 'fire_ability' | 'warrior_spin' | 'shield' | 'buff' | 'melee_impact'
  | 'fire_attack' | 'ultimate' | 'dash' | 'undead' | 'charging'
  | 'holy' | 'dark_magic' | 'shadow' | 'ice' | 'healing'
  // Magic-sprites pack (local horizontal strips)
  | 'lightning' | 'lightning_bolt' | 'midas_touch' | 'sun_strike'
  | 'explosion' | 'spikes' | 'fire_wall' | 'shield_spell'
  | 'black_hole' | 'fire_ball'
  // ObjectStore — Melee slashes
  | 'os_slash_red_md' | 'os_slash_blue_md' | 'os_slash_green_md'
  | 'os_slash_purple_md' | 'os_slash_orange_md'
  | 'os_slash_red_lg' | 'os_slash_blue_lg' | 'os_slash_green_lg'
  | 'os_demon_slash1' | 'os_demon_slash2' | 'os_demon_slash3'
  | 'os_arcane_slash'
  // ObjectStore — Impacts
  | 'os_hit1' | 'os_hit2' | 'os_hit3' | 'os_hit_burst'
  | 'os_crit_slash' | 'os_thunder_hit' | 'os_holy_impact' | 'os_ice_hit'
  // ObjectStore — Projectiles
  | 'os_thunder_proj' | 'os_thunder_proj2' | 'os_wind_proj' | 'os_energy_proj'
  // ObjectStore — Explosions / AOE
  | 'os_fire_explosion' | 'os_fire_explosion2' | 'os_earth_bump'
  | 'os_flamestrike' | 'os_ice_vfx1' | 'os_ice_vfx2'
  // ObjectStore — Beams / Bolts
  | 'os_beam_holy' | 'os_arcane_bolt' | 'os_arcane_lightning' | 'os_frostbolt'
  // ObjectStore — Buffs / Heals
  | 'os_heal' | 'os_healing_regen' | 'os_healing_wave'
  | 'os_holy_heal' | 'os_holy_light' | 'os_holy_vfx'
  | 'os_resurrect' | 'os_wind_breath'
  // ObjectStore — Debuffs / Dark
  | 'os_arcane_mist' | 'os_frozen_ice' | 'os_earth_wall'
  // ObjectStore — Special
  | 'os_worge_tornado';

// ── Spritesheet info ───────────────────────────────────────────
interface SpritesheetInfo {
  image: HTMLImageElement;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  totalFrames: number;
  loaded: boolean;
}

interface ActiveEffect {
  type: SpriteEffectType;
  x: number;
  y: number;
  scale: number;
  duration: number;
  elapsed: number;
  currentFrame: number;
}

// ── Effect file map ────────────────────────────────────────────
// Optional cols/rows/frameW/frameH/frames for explicit metadata (skips auto-detect)
interface EffectDef {
  path: string;
  cols?: number;
  rows?: number;
  frameW?: number;
  frameH?: number;
  frames?: number;
}

const EFFECT_FILE_MAP: Record<SpriteEffectType, EffectDef> = {
  // ── Legacy pixel packs (local, auto-detect grid) ──
  mage_ability: { path: '/assets/effects/pixel/1_magicspell_spritesheet.png' },
  mage_attack: { path: '/assets/effects/pixel/2_magic8_spritesheet.png' },
  frost: { path: '/assets/effects/pixel/3_bluefire_spritesheet.png' },
  channel: { path: '/assets/effects/pixel/4_casting_spritesheet.png' },
  magic_impact: { path: '/assets/effects/pixel/5_magickahit_spritesheet.png' },
  fire_ability: { path: '/assets/effects/pixel/6_flamelash_spritesheet.png' },
  warrior_spin: { path: '/assets/effects/pixel/7_firespin_spritesheet.png' },
  shield: { path: '/assets/effects/pixel/8_protectioncircle_spritesheet.png' },
  buff: { path: '/assets/effects/pixel/9_brightfire_spritesheet.png' },
  melee_impact: { path: '/assets/effects/pixel/10_weaponhit_spritesheet.png' },
  fire_attack: { path: '/assets/effects/pixel/11_fire_spritesheet.png' },
  ultimate: { path: '/assets/effects/pixel/12_nebula_spritesheet.png' },
  dash: { path: '/assets/effects/pixel/13_vortex_spritesheet.png' },
  undead: { path: '/assets/effects/pixel/14_phantom_spritesheet.png' },
  charging: { path: '/assets/effects/pixel/15_loading_spritesheet.png' },
  holy: { path: '/assets/effects/pixel/16_sunburn_spritesheet.png' },
  dark_magic: { path: '/assets/effects/pixel/17_felspell_spritesheet.png' },
  shadow: { path: '/assets/effects/pixel/18_midnight_spritesheet.png' },
  ice: { path: '/assets/effects/pixel/19_freezing_spritesheet.png' },
  healing: { path: '/assets/effects/pixel/20_magicbubbles_spritesheet.png' },
  // ── Magic-sprites pack (local horizontal strips) ──
  lightning: { path: '/assets/packs/vfx/magic-sprites/1 Lightning/Lightning.png' },
  lightning_bolt: { path: '/assets/packs/vfx/magic-sprites/2 Lightning bolt/Lightning bolt.png' },
  midas_touch: { path: '/assets/packs/vfx/magic-sprites/3 Midas touch/Midas touch.png' },
  sun_strike: { path: '/assets/packs/vfx/magic-sprites/4 Sun strike/Sun strike.png' },
  explosion: { path: '/assets/packs/vfx/magic-sprites/5 Explosion/Explosion.png' },
  spikes: { path: '/assets/packs/vfx/magic-sprites/6 Spikes/Spikes.png' },
  fire_wall: { path: '/assets/packs/vfx/magic-sprites/7 Fire wall/Fire wall.png' },
  shield_spell: { path: '/assets/packs/vfx/magic-sprites/8 Shield/Shield.png' },
  black_hole: { path: '/assets/packs/vfx/magic-sprites/9 Black hole/Black hole.png' },
  fire_ball: { path: '/assets/packs/vfx/magic-sprites/10 Fire ball/Fire ball.png' },

  // ── ObjectStore CDN — Slashes (explicit metadata) ──
  os_slash_red_md:    { path: `${OS}/sprites/effects/slash/slash_red_md.png`, cols: 8, rows: 1, frameW: 64, frameH: 64, frames: 8 },
  os_slash_blue_md:   { path: `${OS}/sprites/effects/slash/slash_blue_md.png`, cols: 8, rows: 1, frameW: 64, frameH: 64, frames: 8 },
  os_slash_green_md:  { path: `${OS}/sprites/effects/slash/slash_green_md.png`, cols: 8, rows: 1, frameW: 64, frameH: 64, frames: 8 },
  os_slash_purple_md: { path: `${OS}/sprites/effects/slash/slash_purple_md.png`, cols: 8, rows: 1, frameW: 64, frameH: 64, frames: 8 },
  os_slash_orange_md: { path: `${OS}/sprites/effects/slash/slash_orange_md.png`, cols: 8, rows: 1, frameW: 64, frameH: 64, frames: 8 },
  os_slash_red_lg:    { path: `${OS}/sprites/effects/slash/slash_red_lg.png`, cols: 8, rows: 1, frameW: 96, frameH: 96, frames: 8 },
  os_slash_blue_lg:   { path: `${OS}/sprites/effects/slash/slash_blue_lg.png`, cols: 8, rows: 1, frameW: 96, frameH: 96, frames: 8 },
  os_slash_green_lg:  { path: `${OS}/sprites/effects/slash/slash_green_lg.png`, cols: 8, rows: 1, frameW: 96, frameH: 96, frames: 8 },
  os_demon_slash1: { path: `${OS}/sprites/effects/demon_slash_1.png`, cols: 7, rows: 1, frameW: 48, frameH: 48, frames: 7 },
  os_demon_slash2: { path: `${OS}/sprites/effects/demon_slash_2.png`, cols: 7, rows: 1, frameW: 48, frameH: 48, frames: 7 },
  os_demon_slash3: { path: `${OS}/sprites/effects/demon_slash_3.png`, cols: 7, rows: 1, frameW: 48, frameH: 48, frames: 7 },
  os_arcane_slash: { path: `${OS}/sprites/effects/custom/arcaneslash.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },

  // ── ObjectStore CDN — Impacts ──
  os_hit1:         { path: `${OS}/sprites/effects/hit_effect_1.png`, cols: 7, rows: 1, frameW: 48, frameH: 48, frames: 7 },
  os_hit2:         { path: `${OS}/sprites/effects/hit_effect_2.png`, cols: 7, rows: 1, frameW: 48, frameH: 48, frames: 7 },
  os_hit3:         { path: `${OS}/sprites/effects/hit_effect_3.png`, cols: 7, rows: 1, frameW: 48, frameH: 48, frames: 7 },
  os_hit_burst:    { path: `${OS}/sprites/effects/custom/hit.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_crit_slash:   { path: `${OS}/sprites/effects/custom/crit.png`, cols: 4, rows: 1, frameW: 384, frameH: 394, frames: 4 },
  os_thunder_hit:  { path: `${OS}/sprites/effects/thunder_hit.png`, cols: 6, rows: 1, frameW: 32, frameH: 32, frames: 6 },
  os_holy_impact:  { path: `${OS}/sprites/effects/holy_impact.png`, cols: 7, rows: 1, frameW: 32, frameH: 32, frames: 7 },
  os_ice_hit:      { path: `${OS}/sprites/effects/pixel/ice_hit.png`, cols: 8, rows: 1, frameW: 48, frameH: 32, frames: 8 },

  // ── ObjectStore CDN — Projectiles ──
  os_thunder_proj:  { path: `${OS}/sprites/effects/thunder_projectile.png`, cols: 5, rows: 1, frameW: 32, frameH: 32, frames: 5 },
  os_thunder_proj2: { path: `${OS}/sprites/effects/thunder_projectile_2.png`, cols: 16, rows: 1, frameW: 48, frameH: 48, frames: 16 },
  os_wind_proj:     { path: `${OS}/sprites/effects/wind_projectile.png`, cols: 3, rows: 2, frameW: 32, frameH: 32, frames: 6 },
  os_energy_proj:   { path: `${OS}/sprites/effects/general/energy_projectile.png`, cols: 4, rows: 1, frameW: 32, frameH: 32, frames: 4 },

  // ── ObjectStore CDN — Explosions / AOE ──
  os_fire_explosion:  { path: `${OS}/sprites/effects/fire_explosion.png`, cols: 4, rows: 4, frameW: 64, frameH: 64, frames: 16 },
  os_fire_explosion2: { path: `${OS}/sprites/effects/fire_explosion_2.png`, cols: 18, rows: 1, frameW: 48, frameH: 48, frames: 18 },
  os_earth_bump:      { path: `${OS}/sprites/effects/pixel/earth_bump.png`, cols: 4, rows: 4, frameW: 48, frameH: 48, frames: 16 },
  os_flamestrike:     { path: `${OS}/sprites/effects/custom/flamestrike.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_ice_vfx1:        { path: `${OS}/sprites/effects/pixel/ice_vfx1.png`, cols: 5, rows: 4, frameW: 192, frameH: 192, frames: 20 },
  os_ice_vfx2:        { path: `${OS}/sprites/effects/pixel/ice_vfx2.png`, cols: 5, rows: 7, frameW: 192, frameH: 192, frames: 35 },

  // ── ObjectStore CDN — Beams / Bolts ──
  os_beam_holy:        { path: `${OS}/sprites/effects/custom/beam.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_arcane_bolt:      { path: `${OS}/sprites/effects/custom/arcanebolt.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_arcane_lightning: { path: `${OS}/sprites/effects/custom/arcanelighting.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_frostbolt:        { path: `${OS}/sprites/effects/custom/frostbolt.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },

  // ── ObjectStore CDN — Buffs / Heals ──
  os_heal:          { path: `${OS}/sprites/effects/heal_spritesheet.png`, cols: 4, rows: 4, frameW: 128, frameH: 128, frames: 16 },
  os_healing_regen: { path: `${OS}/sprites/effects/custom/healingregen.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 4 },
  os_healing_wave:  { path: `${OS}/sprites/effects/custom/healingwave.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_holy_heal:     { path: `${OS}/sprites/effects/custom/holyheal.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 4 },
  os_holy_light:    { path: `${OS}/sprites/effects/custom/holylight.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_holy_vfx:      { path: `${OS}/sprites/effects/holy_vfx_02.png`, cols: 16, rows: 1, frameW: 48, frameH: 48, frames: 16 },
  os_resurrect:     { path: `${OS}/sprites/effects/resurrect_sprite.png`, cols: 6, rows: 4, frameW: 256, frameH: 256, frames: 24 },
  os_wind_breath:   { path: `${OS}/sprites/effects/wind_breath.png`, cols: 18, rows: 1, frameW: 32, frameH: 32, frames: 18 },

  // ── ObjectStore CDN — Debuffs / Dark ──
  os_arcane_mist: { path: `${OS}/sprites/effects/custom/arcanemist.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_frozen_ice:  { path: `${OS}/sprites/effects/custom/frozen.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
  os_earth_wall:  { path: `${OS}/sprites/effects/pixel/earth_wall.png`, cols: 4, rows: 4, frameW: 48, frameH: 48, frames: 16 },

  // ── ObjectStore CDN — Special ──
  os_worge_tornado: { path: `${OS}/sprites/effects/worge_tornado.png`, cols: 4, rows: 2, frameW: 384, frameH: 512, frames: 8 },
};

// ── Legacy class VFX (kept for backward compat) ────────────────
export const CLASS_SPELL_VFX: Record<string, SpriteEffectType[]> = {
  Mage:    ['os_arcane_bolt', 'os_arcane_lightning', 'os_frostbolt', 'os_flamestrike'],
  Warrior: ['os_slash_red_lg', 'os_fire_explosion', 'os_earth_bump', 'os_crit_slash'],
  Ranger:  ['os_wind_proj', 'os_fire_explosion2', 'os_thunder_proj2', 'os_holy_impact'],
  Worg:    ['os_slash_orange_md', 'os_demon_slash1', 'os_worge_tornado', 'os_arcane_mist'],
};

// ── Ability VFX map — per ability name → cast/impact/aoe sprites ──
interface AbilityVfxDef {
  cast?: SpriteEffectType;
  impact?: SpriteEffectType;
  aoe?: SpriteEffectType;
  projectile?: SpriteEffectType;
}

export const ABILITY_VFX: Record<string, AbilityVfxDef> = {
  // ── Warrior attacks ──
  'Slash':            { cast: 'os_slash_red_md', impact: 'os_hit1' },
  'Heavy Chop':       { cast: 'os_slash_red_lg', impact: 'os_hit_burst' },
  'Spear Thrust':     { cast: 'os_slash_blue_md', impact: 'os_hit2' },
  'Smash':            { cast: 'os_slash_orange_md', impact: 'os_earth_bump' },
  'Chop':             { cast: 'os_slash_red_md', impact: 'os_hit1' },
  'Heavy Slash':      { cast: 'os_slash_purple_md', impact: 'os_hit3' },
  'Power Strike':     { cast: 'os_slash_red_lg', impact: 'os_crit_slash' },
  'Skull Splitter':   { cast: 'os_slash_red_lg', impact: 'os_crit_slash' },
  'Piercing Strike':  { cast: 'os_slash_blue_lg', impact: 'os_hit_burst' },
  'Cleave':           { cast: 'os_demon_slash1', aoe: 'os_slash_red_lg' },
  'Brutal Cleave':    { cast: 'os_demon_slash2', aoe: 'os_slash_red_lg' },
  'Whirlwind':        { aoe: 'os_demon_slash3', impact: 'os_hit_burst' },
  'Blade Storm':      { aoe: 'os_demon_slash3', impact: 'os_hit_burst' },
  'Earthquake':       { aoe: 'os_earth_bump', impact: 'os_fire_explosion' },
  'Double Chop':      { cast: 'os_slash_red_md', impact: 'os_hit1' },
  'Impale':           { cast: 'os_slash_blue_lg', impact: 'os_hit_burst' },
  'Glaive Sweep':     { aoe: 'os_slash_green_lg', impact: 'os_hit2' },
  'Dance of Blades':  { aoe: 'os_arcane_slash', impact: 'os_hit_burst' },
  // ── Warrior buffs / defensives ──
  'War Cry':          { aoe: 'os_holy_vfx' },
  'Parry':            { cast: 'os_holy_impact' },
  'Axe Block':        { cast: 'os_earth_wall' },
  'Iron Guard':       { cast: 'os_earth_wall' },
  'Bull Rush':        { cast: 'os_wind_breath', impact: 'os_hit_burst' },
  'Charge':           { cast: 'os_wind_breath', impact: 'os_fire_explosion2' },
  'Vault':            { cast: 'os_wind_breath' },
  // ── Warrior ultimates ──
  'Avatar':           { aoe: 'os_holy_light', cast: 'os_resurrect' },
  'Blood Fury':       { cast: 'os_flamestrike', aoe: 'os_fire_explosion' },
  "Titan's Wrath":    { cast: 'os_earth_bump', aoe: 'os_crit_slash' },
  'Ironclad':         { cast: 'os_earth_wall', aoe: 'os_holy_vfx' },
  "Death's Embrace":  { cast: 'os_arcane_mist', aoe: 'os_frozen_ice' },

  // ── Worg attacks ──
  'Quick Stab':       { cast: 'os_slash_orange_md', impact: 'os_hit1' },
  'Slice':            { cast: 'os_slash_green_md', impact: 'os_hit2' },
  'Reap':             { cast: 'os_slash_purple_md', impact: 'os_hit3' },
  'Crescent Slash':   { cast: 'os_slash_orange_md', impact: 'os_hit2' },
  'Hack':             { cast: 'os_slash_red_md', impact: 'os_hit1' },
  'Piercing Thrust':  { cast: 'os_slash_purple_md', impact: 'os_hit3' },
  'Blade Flurry':     { aoe: 'os_demon_slash1', impact: 'os_hit1' },
  'Eviscerate':       { cast: 'os_demon_slash2', impact: 'os_crit_slash' },
  'Soul Harvest':     { aoe: 'os_arcane_mist', impact: 'os_hit_burst' },
  'Reaper Spin':      { aoe: 'os_demon_slash3', impact: 'os_hit2' },
  // ── Worg defensives ──
  'Shadow Step':      { cast: 'os_arcane_mist' },
  'Vanish':           { cast: 'os_arcane_mist' },
  'Death Step':       { cast: 'os_arcane_mist' },
  'Reaper Fear':      { aoe: 'os_frozen_ice' },
  'Throw Axe':        { projectile: 'os_thunder_proj', impact: 'os_hit1' },
  'Life Drain':       { cast: 'os_healing_wave', impact: 'os_hit3' },
  // ── Worg ultimates ──
  'Death Mark':       { cast: 'os_arcane_mist', impact: 'os_fire_explosion2' },
  'Primal Fury':      { cast: 'os_worge_tornado', aoe: 'os_fire_explosion' },
  "Reaper's Call":    { cast: 'os_arcane_mist', aoe: 'os_flamestrike' },
  'Blood Pact':       { cast: 'os_flamestrike', aoe: 'os_fire_explosion' },
  'Berserker Rage':   { cast: 'os_fire_explosion', aoe: 'os_crit_slash' },
  'Ghoul Frenzy':     { cast: 'os_arcane_mist', aoe: 'os_frozen_ice' },

  // ── Mage attacks ──
  'Arcane Bolt':      { projectile: 'os_arcane_bolt', impact: 'os_thunder_hit' },
  'Thorn Bolt':       { projectile: 'os_wind_proj', impact: 'os_hit2' },
  'Fire Bolt':        { projectile: 'os_flamestrike', impact: 'os_fire_explosion2' },
  'Lightning Bolt':   { projectile: 'os_arcane_lightning', impact: 'os_thunder_hit' },
  'Frost Bolt':       { projectile: 'os_frostbolt', impact: 'os_ice_hit' },
  // ── Mage core ──
  'Arcane Barrage':   { aoe: 'os_arcane_bolt', impact: 'os_thunder_hit' },
  'Fireball':         { projectile: 'os_flamestrike', impact: 'os_fire_explosion' },
  'Flame Burst':      { aoe: 'os_fire_explosion', cast: 'os_flamestrike' },
  'Chain Lightning':  { cast: 'os_arcane_lightning', impact: 'os_thunder_hit' },
  'Searing Beam':     { cast: 'os_beam_holy', impact: 'os_fire_explosion2' },
  'Frost Nova':       { cast: 'os_frostbolt', aoe: 'os_frozen_ice' },
  'Rejuvenation':     { cast: 'os_healing_regen' },
  'Power Shot':       { projectile: 'os_wind_proj', impact: 'os_hit_burst' },
  // ── Mage defensives ──
  'Mana Shield':      { cast: 'os_holy_vfx' },
  'Barkskin':         { cast: 'os_earth_wall' },
  'Fire Shield':      { cast: 'os_fire_explosion2' },
  'Lightning Dash':   { cast: 'os_arcane_lightning' },
  'Ice Armor':        { cast: 'os_frozen_ice' },
  'Flame Dash':       { cast: 'os_fire_explosion2' },
  // ── Mage ultimates ──
  'Arcane Cataclysm': { aoe: 'os_arcane_bolt', impact: 'os_arcane_lightning' },
  'Wrath of Nature':  { aoe: 'os_healing_wave', impact: 'os_earth_bump' },
  'Meteor':           { impact: 'os_fire_explosion', aoe: 'os_flamestrike' },
  'Thunder Storm':    { aoe: 'os_arcane_lightning', impact: 'os_thunder_hit' },
  'Inferno':          { aoe: 'os_flamestrike', impact: 'os_fire_explosion' },
  'Blizzard':         { aoe: 'os_ice_vfx2', impact: 'os_frozen_ice' },

  // ── Ranger attacks ──
  'Quick Shot':       { projectile: 'os_wind_proj', impact: 'os_hit1' },
  'Bolt Shot':        { projectile: 'os_thunder_proj', impact: 'os_hit2' },
  'Heavy Bolt':       { projectile: 'os_thunder_proj2', impact: 'os_hit3' },
  'Steady Shot':      { projectile: 'os_wind_proj', impact: 'os_hit1' },
  'Aimed Shot':       { projectile: 'os_thunder_proj2', impact: 'os_crit_slash' },
  // ── Ranger core ──
  'Multi Shot':       { projectile: 'os_wind_proj', impact: 'os_hit1' },
  'Snipe':            { projectile: 'os_thunder_proj2', impact: 'os_crit_slash' },
  'Bolt Volley':      { projectile: 'os_thunder_proj', impact: 'os_hit2' },
  'Explosive Round':  { projectile: 'os_thunder_proj', impact: 'os_fire_explosion' },
  'Burst Fire':       { projectile: 'os_thunder_proj', impact: 'os_hit3' },
  // ── Ranger defensives ──
  'Evasive Roll':     { cast: 'os_wind_breath' },
  'Wind Walk':        { cast: 'os_wind_breath' },
  'Backflip':         { cast: 'os_wind_breath' },
  'Tactical Roll':    { cast: 'os_wind_breath' },
  'Bolt Trap':        { cast: 'os_earth_bump', impact: 'os_thunder_hit' },
  'Combat Roll':      { cast: 'os_wind_breath' },
  'Smoke Bomb':       { cast: 'os_arcane_mist' },
  // ── Ranger ultimates ──
  'Storm of Arrows':    { aoe: 'os_wind_proj', impact: 'os_hit_burst' },
  'Moonfire Volley':    { aoe: 'os_holy_impact', impact: 'os_arcane_bolt' },
  'Siege Barrage':      { aoe: 'os_fire_explosion', impact: 'os_thunder_hit' },
  'Death Rain':         { aoe: 'os_arcane_mist', impact: 'os_hit_burst' },
  'Lead Storm':         { aoe: 'os_fire_explosion2', impact: 'os_thunder_hit' },
  'Phantom Barrage':    { aoe: 'os_arcane_mist', impact: 'os_thunder_proj2' },
};

// ── Auto-attack VFX per class ──────────────────────────────────
export const AUTO_ATTACK_VFX: Record<string, { onHit: SpriteEffectType; rangedImpact?: SpriteEffectType }> = {
  Warrior: { onHit: 'os_slash_red_md' },
  Worg:    { onHit: 'os_slash_orange_md' },
  Mage:    { onHit: 'os_thunder_hit', rangedImpact: 'os_arcane_bolt' },
  Ranger:  { onHit: 'os_hit1', rangedImpact: 'os_wind_proj' },
};

// ── Hero Signature VFX (exclusive ultimate effect per hero) ────
interface SignatureVfx {
  effect: SpriteEffectType;
  scale: number;
  duration: number;
}

export const HERO_SIGNATURE_VFX: Record<string, SignatureVfx> = {
  'Sir Aldric Valorheart':    { effect: 'os_holy_light',       scale: 1.8, duration: 1000 },
  'Gareth Moonshadow':        { effect: 'os_arcane_mist',      scale: 1.6, duration: 900 },
  'Archmage Elara Brightspire': { effect: 'os_arcane_lightning', scale: 2.0, duration: 1100 },
  'Kael Shadowblade':         { effect: 'os_demon_slash1',     scale: 1.8, duration: 800 },
  'Ulfgar Bonecrusher':       { effect: 'os_earth_bump',       scale: 2.0, duration: 900 },
  'Hrothgar Fangborn':        { effect: 'os_worge_tornado',    scale: 1.8, duration: 1200 },
  'Volka Stormborn':          { effect: 'os_ice_vfx2',         scale: 2.0, duration: 1100 },
  'Svala Windrider':          { effect: 'os_wind_breath',      scale: 1.8, duration: 900 },
  'Thane Ironshield':         { effect: 'os_earth_wall',       scale: 1.6, duration: 900 },
  'Bromm Earthshaker':        { effect: 'os_fire_explosion',   scale: 2.0, duration: 1000 },
  'Runa Forgekeeper':         { effect: 'os_flamestrike',      scale: 2.0, duration: 1000 },
  'Durin Tunnelwatcher':      { effect: 'os_thunder_proj2',    scale: 1.8, duration: 800 },
  'Thalion Bladedancer':      { effect: 'os_arcane_slash',     scale: 2.0, duration: 1000 },
  'Sylara Wildheart':         { effect: 'os_healing_regen',    scale: 1.8, duration: 1100 },
  'Lyra Stormweaver':         { effect: 'os_arcane_bolt',      scale: 2.2, duration: 1000 },
  'Aelindra Swiftbow':        { effect: 'os_holy_impact',      scale: 1.8, duration: 800 },
  'Grommash Ironjaw':         { effect: 'os_crit_slash',       scale: 2.2, duration: 900 },
  'Fenris Bloodfang':         { effect: 'os_fire_explosion2',  scale: 2.0, duration: 1000 },
  "Zul'jin the Hexmaster":    { effect: 'os_flamestrike',      scale: 2.2, duration: 1100 },
  'Razak Deadeye':            { effect: 'os_thunder_hit',      scale: 1.8, duration: 800 },
  'Lord Malachar':            { effect: 'os_frozen_ice',       scale: 2.0, duration: 1000 },
  'The Ghoulfather':          { effect: 'os_arcane_mist',      scale: 2.2, duration: 1100 },
  'Necromancer Vexis':        { effect: 'os_frostbolt',        scale: 2.0, duration: 1000 },
  'Shade Whisper':            { effect: 'os_thunder_proj2',    scale: 1.8, duration: 900 },
  'Racalvin the Pirate King': { effect: 'os_fire_explosion2',  scale: 2.2, duration: 1100 },
  'Cpt. John Wayne':          { effect: 'os_beam_holy',        scale: 2.0, duration: 1200 },
};

// ── Constants ──────────────────────────────────────────────────
const LEGACY_FRAME_SIZE = 100;

// ── SpriteEffectSystem ─────────────────────────────────────────
export class SpriteEffectSystem {
  private spritesheets: Map<SpriteEffectType, SpritesheetInfo> = new Map();
  private activeEffects: ActiveEffect[] = [];
  private loaded = false;

  constructor() {
    this.preload();
  }

  private preload(): void {
    const entries = Object.entries(EFFECT_FILE_MAP) as [SpriteEffectType, EffectDef][];
    let remaining = entries.length;

    for (const [type, def] of entries) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = def.path;

      const hasExplicitMeta = def.cols != null && def.frameW != null;

      const info: SpritesheetInfo = {
        image: img,
        frameW: def.frameW ?? LEGACY_FRAME_SIZE,
        frameH: def.frameH ?? LEGACY_FRAME_SIZE,
        cols: def.cols ?? 1,
        rows: def.rows ?? 1,
        totalFrames: def.frames ?? 1,
        loaded: false,
      };

      img.onload = () => {
        if (!hasExplicitMeta) {
          // Auto-detect: horizontal strip vs legacy square grid
          const isHorizontalStrip = img.height < img.width * 0.5;
          if (isHorizontalStrip) {
            info.frameW = img.height;
            info.frameH = img.height;
            info.cols = Math.max(1, Math.round(img.width / img.height));
            info.rows = 1;
          } else {
            info.frameW = LEGACY_FRAME_SIZE;
            info.frameH = LEGACY_FRAME_SIZE;
            info.cols = Math.max(1, Math.floor(img.width / LEGACY_FRAME_SIZE));
            info.rows = Math.max(1, Math.floor(img.height / LEGACY_FRAME_SIZE));
          }
          info.totalFrames = Math.max(1, info.cols * info.rows);
        }
        info.loaded = true;
        remaining--;
        if (remaining <= 0) this.loaded = true;
      };

      img.onerror = () => {
        remaining--;
        if (remaining <= 0) this.loaded = true;
      };

      this.spritesheets.set(type, info);
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  playEffect(type: SpriteEffectType, x: number, y: number, scale = 1, durationMs = 600): void {
    this.activeEffects.push({
      type, x, y, scale,
      duration: durationMs / 1000,
      elapsed: 0,
      currentFrame: 0,
    });
  }

  update(dt: number): void {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.elapsed += dt;

      if (effect.elapsed >= effect.duration) {
        this.activeEffects.splice(i, 1);
        continue;
      }

      const sheet = this.spritesheets.get(effect.type);
      if (!sheet || !sheet.loaded) continue;

      const progress = effect.elapsed / effect.duration;
      effect.currentFrame = Math.min(
        Math.floor(progress * sheet.totalFrames),
        sheet.totalFrames - 1
      );
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const effect of this.activeEffects) {
      const sheet = this.spritesheets.get(effect.type);
      if (!sheet || !sheet.loaded) continue;

      const col = effect.currentFrame % sheet.cols;
      const row = Math.floor(effect.currentFrame / sheet.cols);

      const sx = col * sheet.frameW;
      const sy = row * sheet.frameH;

      const drawW = sheet.frameW * effect.scale;
      const drawH = sheet.frameH * effect.scale;

      ctx.drawImage(
        sheet.image,
        sx, sy, sheet.frameW, sheet.frameH,
        effect.x - drawW / 2, effect.y - drawH / 2,
        drawW, drawH
      );
    }
  }

  getActiveCount(): number {
    return this.activeEffects.length;
  }

  clearAll(): void {
    this.activeEffects.length = 0;
  }
}
