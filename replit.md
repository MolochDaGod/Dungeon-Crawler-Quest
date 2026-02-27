# GRUDGE Warlords

A browser-based game with two modes: MOBA (5v5, 3 lanes) and Dungeon Crawler (procedural floors, boss fights). Features 26 playable heroes across 6 races and 4 classes, built with React and HTML5 Canvas.

## Architecture

### Frontend (Game)
- **Game Engine**: Dual renderer - Custom HTML5 Canvas 2D + Three.js 3D
  - `client/src/game/types.ts` - All game types, 26 hero definitions from hero-codex, items, abilities, map data, stat calculations
  - `client/src/game/voxel.ts` - Procedural voxel art renderer (isometric cubes, hero/minion models per race+class)
  - `client/src/game/engine.ts` - MOBA game loop, combat, AI opponents, 2D rendering, minimap
  - `client/src/game/three-renderer.ts` - Three.js 3D renderer with lighting, terrain, entity management, health bars, camera
  - `client/src/game/model-loader.ts` - GLTFLoader/FBXLoader with caching for 3D model assets
  - `client/src/game/prefabs.ts` - TOWER_PREFABS, HERO_PREFABS, CREATURE_PREFABS, MINION_PREFABS, ENV_PREFABS, WEAPON_PREFABS mapping
  - `client/src/game/dungeon.ts` - Dungeon crawler engine: procedural floor generation, enemy AI, boss fights, loot, traps
  - `client/src/game/combat.ts` - Status effects system: 19 effect types (Stun/Freeze/Root/Silence/Poison/Bleed/Burn/etc), DoT ticking, CC diminishing returns, crit/armor pen/lifesteal combat math
  - `client/src/game/keybindings.ts` - Rebindable keybinding framework with LMB/RMB/MMB support, localStorage persistence
- **Pages**:
  - `client/src/pages/home.tsx` - Title screen with mode selection (MOBA / Dungeon) and Settings button
  - `client/src/pages/character-select.tsx` - Hero selection with race/class filters, stat bars, ability previews, voxel model preview
  - `client/src/pages/game.tsx` - MOBA game canvas with RPG UI overlay, status effects display, MMB camera pan, 2D/3D toggle
  - `client/src/pages/dungeon-game.tsx` - Dungeon crawler with RPG HUD, inventory, floor/loot display
  - `client/src/pages/open-world.tsx` - Open world exploration with 3 towns (Elvenhollow, Ironjaw Keep, Valorheim), WASD movement, minimap
  - `client/src/pages/settings.tsx` - Settings page with MOBA/Dungeon keybinding tabs, graphics settings (particle quality, screen shake, minimap size)
- **UI Framework**: React + Shadcn + Tailwind CSS (dark mode forced)
- **Routing**: Wouter

### Backend
- Express server (minimal, serves static files)
- No database needed - game state is client-side

## Game Features

### Heroes (26 total)
- 6 Races: Human, Barbarian, Dwarf, Elf, Orc, Undead
- 4 Classes: Warrior, Worg, Mage, Ranger
- 3 Factions: Crusade (Human+Barbarian), Fabled (Dwarf+Elf), Legion (Orc+Undead), + secret Pirates
- 2 Secret heroes: Racalvin the Pirate King, Cpt. John Wayne
- Stats: HP, ATK, DEF, SPD, RNG, MP with race modifiers

### MOBA Mode
- 4000x4000 map with 3 lanes (top, mid, bot) and diagonal river
- 5v5 (player + 4 AI allies vs 5 AI enemies)
- Towers along each lane (2 per lane per team + 1 base tower)
- Nexus base structure (destroy to win)
- Minion waves every 30 seconds (melee + siege after 2 min)
- Jungle camps: 10 camps (6 small, 2 medium, 2 buff) with aggro/leash/respawn mechanics
- Hero leveling 1-18 with stat scaling
- 4 abilities per class (Q/W/E/R) with cooldowns and mana costs
- LoL-style spell casting indicators: ground AoE circles, skillshot rectangles, line beams, cone arcs, targeted lines
- Ability castType system: 'targeted' | 'skillshot' | 'ground_aoe' | 'self_cast' | 'cone' | 'line'
- Slow auto-attacks: hero base ~2.2s, minion ~2.6s, tower 2.5s; melee instant-hit, ranged fires projectiles at 450 speed
- Combat actions: Dodge Roll (Space, iFrames), Dash Attack (F, 1.5x damage), Shield Block (V, 70% reduction)
- Auto-attack combo system (3-hit combo = golden finisher with 1.5x damage + VFX)
- Item shop (12 items across 3 tiers)
- Gold from last-hits, kills (+300g), assists (+100g), jungle mobs
- KDA scoring and kill feed with AI chat callouts

### Dungeon Crawler Mode
- Procedural floor generation (10 floors)
- Enemy types: Slime, Skeleton, Orc Grunt, Dark Mage
- Boss fights every 5th floor (Dragon, Lich)
- Traps (spike, fire, poison), chests with loot
- Inventory and gold system
- Uses same hero abilities/stats as MOBA mode

### Combat System (combat.ts)
- 19 Status Effect Types: Stun, Freeze, Root, Silence, Poison, Bleed, Burn, Curse, Slow, Haste, Immobilize, Blind, Sleep, Fear, Shield, Regen, AtkBuff, DefBuff, SpdBuff
- DoT system: tick-based damage for Poison/Bleed/Burn/Curse
- CC diminishing returns: immunity window after CC expires
- Combat formulas: crit chance, crit damage (1.5x), armor penetration, lifesteal
- Abilities apply status effects via getAbilityStatusEffects() mapping
- Status effects display in HUD with color-coded icons, stacks, duration

### Keybinding System (keybindings.ts)
- All actions rebindable including mouse buttons (LMB=mouse0, RMB=mouse2, MMB=mouse1)
- Categories: Movement, Combat, Abilities, Level Up, Items, Camera, UI
- Default MOBA bindings: Arrow keys for movement (secondary), QWER abilities, S stop, RMB move/target, LMB attack, MMB camera pan
- Integrated into both game.tsx and dungeon-game.tsx via matchesKeyDown()
- Persists to localStorage
- Settings page with visual rebinding UI (click to rebind, press new key/mouse, ESC cancel)

### Attack System (Dota 2-paced)
- Wind-up → Damage Point → Backswing flow for all units
- Heroes: Melee wind-up 0.35s, Ranged wind-up 0.25s, Backswing 0.3s
- Minions: Melee wind-up 0.3s, Ranged wind-up 0.2s, Backswing 0.25s
- Units face target during wind-up phase, stop moving during attack animation
- MobaHero/MobaMinion types include: attackWindup, attackBackswing, pendingAttackTarget/pendingTarget
- Voxel attack animations: phased timing (wind-up → swing → follow-through) matching actual damage point

### AI System (engine.ts)
- Threat evaluation: weighted by enemy proximity, attack power, tower range
- Ally awareness: counts nearby allies to determine retreat thresholds
- Smart retreat: dynamic threshold (15-35% HP based on ally count), dash ability usage when critically low
- Ability targeting: evaluates heal/buff on wounded allies, AoE on enemy clusters, finisher priority on low-HP targets
- Class-aware strategy: Mage conserves mana, Warrior ignores heal when healthy, Ranger kites at range
- Smart shopping: tiered purchasing (tier 1 at 300g, tier 2 at 750g, tier 3 at 1400g), class-weighted item scoring
- Assigned lane system: heroes assigned to specific lanes via `assignedLane` field, follow their lane waypoints
- Last-hitting: AI prioritizes killing minions when their HP is within lethal range (atk * 1.2 + 5)
- Chat callouts: AI heroes post strategic messages ("push mid", "enemy missing", "going b", "need backup", "group up")
- Base healing: AI retreats and heals at base when low, then returns to assigned lane

### 3D Animation System
- External FBX animation clips loaded from `/assets/models/animations/`: Idle, Run, Attack, Death, Hit
- `loadAnimationSet()` and `applyAnimationsToEntity()` in model-loader.ts for loading and applying external animation clips
- Shared animation set applied to all hero entities via prefab `animations` field
- `mapAnimState()` in three-renderer.ts maps game animState (walk/attack/ability/dodge/death) to animation clip names (run/attack/hit/death/idle)
- Animation cross-fading with 0.15s transitions between states
- Attack and death animations play once (LoopOnce + clampWhenFinished)
- Fallback to mesh position/rotation manipulation when no AnimatedEntity is available

### Hero Portraits
- 25 compressed PNG portraits (256x256) at `public/assets/portraits/`
- Naming: `{race}_{class}.png` (e.g., `human_warrior.png`, `elf_mage.png`)
- Special: `pirate_king.png` for Racalvin the Pirate King (secret hero)
- `getPortraitPath(race, heroClass, heroName?)` helper in types.ts handles Pirate King mapping
- Used in: character-select.tsx (hero cards + detail panel), game.tsx (HUD stats + scoreboard)
- Compressed from ~1.5MB originals to ~100KB each (93% size reduction)

### 3D Environment Assets
- FreeSample pack: Boat, Bridge, Building, Chest, Lantern, PalmTree, Rock, Rowboat, Sand (FBX)
- FreeSample2 dungeon pack: Armor, Door, DoorFrame, FloorCorner, Pillar, Plinth, RedBanner, SmallChest, TorchWall, WallBrick (FBX)
- Dungeon textures: 4K diffuse maps for blocks, props, walls in `/assets/textures/dungeon/`
- DUNGEON_PREFABS exported from prefabs.ts for dungeon crawler 3D mode integration

### Voxel Art System
- Procedural isometric cube rendering, 14z×8y×8x hero grids (expanded from 12×6×6)
- Multi-part body pose system: head, torso, arms, legs, weapon — each independently animated
- Class-specific attack animations:
  - Warrior/Worg: melee sword/axe swing with wind-up → slash → follow-through
  - Ranger: bow draw-back → hold → release with arrow projectile
  - Mage: staff raise → charge glow → cast forward with particle trail
- Walk cycle: alternating leg strides with knee-lift, opposing arm swing, head bob, torso sway
- Weapon trail VFX: melee swing arcs (golden glow), ranged charge orbs (cyan/purple glow) during attack/ability states
- Idle: subtle breathing torso movement
- Ability: both arms raise, energy pulse, weapon glow
- Death: body collapse with staggered limb fall
- Weapon glow effects: context-sensitive color blend on impact/release
- Unique hero models per race+class combination (skin, armor, weapons, racial features)
- Race features: Dwarf beards, Elf pointed ears, Orc tusks, Undead decay, Barbarian top-knot
- Minion voxel models (melee/siege variants)
- Voxel terrain tiles: grass, dirt, stone, water, lane, jungle, base_blue/red, river (cached to offscreen canvases)
- Voxel structures: towers (tier-scaled stone+team color), nexus (hexagonal base + crystal top)
- Voxel decorations: trees (trunk + leaf canopy, 6 seed variants), rocks (3 variants)
- Dungeon voxel tiles: floor, wall (with 3D wall-top overhang), door, trap, stairs, chest
- Seeded random for deterministic tile variation (no flicker on re-render)
- Tile cache system (max 500 entries) for performance

### RPG UI Overlay
- Stone/gold panel styling (#c5a059 gold border) with corner rivets
- Bottom hotbar with ability slots (Q/W/E/R) and 6 item slots
- Active buff/debuff display above hotbar with color-coded indicators
- Left chat/kill feed panel
- Right stat panel with portrait, ATK/DEF/SPD, KDA
- Top team score bar with game timer
- Custom in-game cursor: attack crosshair (A+click), ability targeting (purple), move arrow (RMB), default brackets
- MMB camera pan (drag), F1 center camera, scroll zoom
- Hero status effect glows visible on entities (burn/poison/freeze rings)
- Terrain map: procedural terrain grid with biomes (grass, jungle, lanes, bases, river)

## MOBA Controls
- **RMB on ground**: Move to position
- **RMB on enemy**: Target and attack that unit
- **A key**: Enter attack-move mode (orange crosshair cursor)
- **A + LMB on ground**: Attack-move to position (auto-attacks closest enemy en route)
- **A + LMB on unit**: Attack that specific unit
- **S key**: Stop (cancel all movement and attacking)
- **Q/W/E/R or 1-4**: Use abilities
- **LMB**: Place spell when ability selected, otherwise no action
- **Space**: Auto-attack nearest enemy
- **MMB**: Camera pan (drag)
- **B**: Toggle item shop
- **Tab**: Show scoreboard (hold)
- **F1**: Center camera on hero
- **Scroll**: Zoom camera
- **Escape**: Cancel ability selection / Pause / close menus
- **Arrow keys**: Manual movement (secondary, MOBA-style RMB is primary)
- I: Inventory (dungeon mode)

### Generated Art Assets (attached_assets/)
- `hud-frame.png` - Ornate golden dragon HUD frame border for bottom bar
- `terrain-tiles.png` - Isometric voxel terrain tileset
- `minimap-bg.png` - MOBA minimap parchment background
- `ability-icons.png` - RPG ability spell icons (sword/shield/fire/heal)
- `shop-panel.png` - Medieval shop stall background
- `tower-model.png` - Voxel defense tower sprite
- `nexus-crystal.png` - Glowing nexus crystal sprite
- `scoreboard-bg.png` - Ornate scoreboard panel background

### Spell System
- Spell projectiles with trail particles, piercing (20% dmg reduction per pierce), AoE explosions
- 14 SpellEffect visual types: slash_arc, impact_ring, dash_trail, shield_flash, combo_burst, ground_slam, fire_ring, frost_ring, meteor_shadow, meteor_impact, arrow_rain, whirlwind_slash, ground_scorch, ground_frost
- Meteor: 1s shadow buildup → impact explosion with screen shake + scorch decal
- Arrow Rain: tick damage every 0.5s with animated arrow impacts
- Charges system: Mage Fireball (2 charges), Ranger Power Shot (3 charges) with recharge timers
- Charge pips visible below ability buttons in HUD
- Divine Rapier (item id=12): unique voxel rapier weapon model (silver blade, gold cross-guard, brown handle, ruby pommel gem)

## Performance & Best Practices
- **Server**: Express with minimal middleware
- **Static assets**: 7-day cache with immutable for /assets, 1-hour cache for other static files
- **Entity lookup**: O(1) Map-based entity index (`buildEntityIndex`) rebuilt per frame, replaces O(n) linear scans in `findEntityById`
- **Model loading**: GLB/FBX cache with deduplication via `loadingPromises` Map to prevent redundant network requests
- **React**: Game state in useRef (avoids re-renders), HUD synced to React every ~100ms via setHud, useCallback for event handlers
- **Voxel rendering**: Tile cache system (max 500 entries) for pre-rendered terrain tiles

## Design
- Dark fantasy theme with crimson (#ef4444), gold (#ffd700), purple (#a855f7) accent colors
- Forced dark mode via `document.documentElement.classList.add("dark")`
- Game state in useRef, HUD synced to React every ~100ms for performance
- Font: Oxanium for headings
