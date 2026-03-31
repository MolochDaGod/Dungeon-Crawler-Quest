# GRUDGE 2D MMO

Browser-based dark fantasy MMO featuring Open World, 5v5 MOBA, Dungeon Crawler, and Genesis Island 3D modes. Built with React, BabylonJS 9, and the Grudge ObjectStore API. Created by Racalvin The Pirate King.

**Live:** [grudgewarlords.com](https://grudgewarlords.com)

**Backend:** [grudge-studio.com](https://grudge-studio.com) · **Dashboard:** [dash.grudge-studio.com](https://dash.grudge-studio.com) · **ObjectStore:** [molochdagod.github.io/ObjectStore](https://molochdagod.github.io/ObjectStore)

## Game Modes

### MOBA (5v5)
- 4000×4000 map with 3 lanes, towers, Nexus objective
- 26 heroes across 6 races and 4 classes
- Minion waves, jungle camps, gold economy, item shop
- Fog of war, ability leveling, KDA scoring

### Dungeon Crawler
- 10 procedural floors, boss fights, traps, chests
- Recursive shadowcasting line-of-sight
- Enemy AI heroes with patrol/chase/attack/retreat behavior
- Inventory and loot system

### Open World MMO
- 16000×16000 island-based world with 16+ zones, day/night cycle, dynamic weather
- Heightmap terrain system with 6 terrain layers (grass, sand, stone, snow, volcanic, water)
- Road carving, spawn zones, and walkability grid baked from heightmap
- Boat system with 3 tiers (Raft, Sloop, Galleon), dock generation, mount/dismount mechanics
- A* pathfinding on 40px grid with octile heuristic, path smoothing, LOS checks, patrol routes
- Spawner system with 5 types (roaming, static, event, boss, patrol) and per-zone configs
- Zone event system with 6 event types (invasion, harvest, escort, defense, boss, treasure)
- AI behavior trees: Sequence/Selector/Cooldown/Inverter nodes, 13 leaf behaviors, 7 archetype trees
- Full RPG progression (see RPG Systems below)
- MMO controls: WASD movement, Shift sprint, Space dodge roll, Tab target-cycling, E interact
- Stamina system with sprint drain/regen and dodge roll cost
- AI faction system, NPC interactions, quest givers
- NPC dialog system with Shop/Quests/Train/Craft tabs, tier-scaled vendor inventories
- 5 new voxel monsters: Tentacle Horror, Timber Wolf, Cave Bear, Pit Demon, Sky Hawk
- **46 voxel asset library** via ObjectStore: 11 trees, 7 rocks, 4 mountains, 6 terrain props, 8 structures, 5 animals, 5 enemies
- **AI terrain placement** (`terrain-placer.ts`): deterministic seeded tile layout engine — biome-matched land tiles, 3-wide road generation, grid-based building placement with NPC collision avoidance, per-biome decor scatter with baked shadow offsets, water-edge auto-tiling

#### Combat & Visual Polish
- **Animation FSM** (`ow-anim-fsm.ts`): priority-based state machine for player animation with interruptibility windows, blend-out, and auto-return. Replaces scattered `animState` writes with `tryTransition()` calls.
- **Hit-stop (impact freeze)**: brief animation pause on melee/heavy hits — 40ms normal, 70ms crit, 60ms heavy attacks, 50ms boss hits. Freezes both attacker and target FSM/animTimer.
- **Enemy animation parity**: attacking enemies now render AI slash VFX via `drawAISlashVFX()` with attackStyle→weaponType mapping (melee→sword, ranged→bow, aoe→staff). Boss enemies get enhanced impact flash and trail intensity.
- **Effect pool** (`effect-pool.ts`): pre-allocated 128-slot VFX pool with zero per-frame allocation. Per-type visual curves (fadeOut, expandFade, popFade, pulseFade) compute opacity/scale each tick.
- **Melee knockback + hitstun**: melee hits push enemies to the edge of the slash arc and apply a brief stun (0.12–0.2s), scaling with combo step so players don't take damage mid-swing
- Weapon-leading melee slash: weapon sweeps a ±40° arc in front of facing, body lunges forward
- Weapon afterimage ghost trail during attacks
- Widened VFX slash arc with increased reach
- Spell combo system: chain abilities within 3s for stacking +8% damage (up to 5 stacks)
- Channeling particle burst VFX scaled by combo count
- Screen shake on melee hits, heavy attacks, ability damage, and kills
- Hit flash overlay on damaged enemies with aggro indicator
- Combo counter system with timer bar and color-coded display
- **PixelGothic font** (Craftpix): `StraightPixelGothic.otf` registered for both canvas and CSS; used for all damage numbers, combo counter, NPC nameplates
- **Enhanced popups**: CRIT numbers 1.45× scale + gold `shadowBlur 18` + 6-star burst; heals get green glow + shimmer sparkles; pop-spring animation 35%→120%→100% over 160ms
- **Event banners** (Craftpix pack): 9 animated GIFs (GameOver, Victory, StageCleared, StageFailed, GetReady, LetsGo, YouLose, Finish, CountDown) play as fullscreen overlays on match events
- Styled floating damage numbers with pop-in animation, crit glow, and outline
- Death burst VFX: radial particles, gold coin pops, XP orbs, impact ring
- Ambient atmosphere: firefly and dust mote particle systems
- Heavy attack cooldown arc indicator
- GLB/GLTF 3D model sprite loader for voxel-style assets

#### AI Behavior
- Enemy separation steering to prevent stacking
- Ranged enemies kite when player closes distance
- Idle patrol circuits around home positions
- Ranged enemies fire AoE telegraph attacks at higher levels
- Walkability-aware movement
- 30+ enemy types including 5 new voxel monsters with unique animations (tentacle writhe, wolf gallop, bear claw swipe, demon fire aura, hawk dive)

## RPG Systems

All game data is sourced from the **Grudge ObjectStore API** (`https://molochdagod.github.io/ObjectStore`).

### Weapon-Based Skills (`weapon-skills.ts`)
- Skills change dynamically based on equipped weapon
- Shared skills (slots 1-3) from weapon **type** (swords, bows, staves...)
- Weapon-specific skills (slot 4) from named weapon
- Class ultimate preserved on slot 5
- Skill selection persistence via localStorage

### Attributes (`attributes.ts`)
- 8 primary attributes: STR, INT, VIT, DEX, END, WIS, AGI, TAC
- 20 starting points + 7 per level-up (160 max at level 20), freely allocatable
- Diminishing returns at 25/50 points; stat caps (75% crit/block, 3.0× crit factor, 90% block, 95% accuracy/resistance, 50% drain/reflect/absorb)
- 37 derived stats across Offense, Defense, Utility, and Resources including crit, evasion, armor pen, lifesteal, movement speed, attack speed, heal power, spell power, and more
- Class-based starting distributions (Warrior, Mage, Ranger, Worg)

### Combat Pipeline (`combat.ts`)
- Shared `buildDamageOpts()` helper constructs damage options from attacker/target `DerivedStats`
- 8-step damage pipeline: base → phys/magic multiplier → crit → armor pen → defense (√DEF mitigation) → block → damage reduction → lifesteal
- Both MOBA engine and Open World engine route all attacks through this pipeline
- Auto-attacks scale with full `derived.damage` and class multipliers; attack speed scales auto-attack timer
- Abilities use class-appropriate phys/magic damage multipliers; dash range scales with AGI-based movement speed
- Health regen ticks alongside mana regen in the open world update loop

### Professions & Harvesting (`professions-system.ts`)
- **6 Gathering:** Mining, Logging, Skinning, Fishing, Herbalism, Scavenging
- **5 Crafting:** Weaponsmith, Leatherworker, Chef, Engineer, Mystic
- 8-tier progression with milestone unlocks
- XP curve, bonus quantity, gear drop chances at milestones

### Crafting (`crafting.ts`)
- Auto-generated recipes for 17 weapon types × 8 tiers
- Armor recipes: 3 materials × 7 slots × 8 tiers
- Consumables: health/mana potions, food buffs × 8 tiers
- Material consumption from resource inventory, profession XP rewards

### Equipment (`equipment.ts`)
- **10 equip slots**: Helm, Shoulder, Chest, Hands, Feet, Ring, Necklace, Cape, Main Hand, Off-Hand
- Tier-scaled stats (1.0× to 3.3× multiplier), tier colour-coded item borders (grey→green→blue→purple→gold)
- Weapon equip triggers automatic skill loadout swap
- Set bonuses at 2/4/6 piece thresholds
- Equipment bag for unequipped items, full persistence
- Backend sync: `PUT /api/characters/:grudgeId` on every equip/unequip

### Character Panel (`/character`)
Full-screen 3-column dark-fantasy UI with Cinzel/Crimson Text/JetBrains Mono fonts and **reactive derived stats** (ATK/DEF/HP/MP recompute live as gear changes):
- **Top Bar** — HP/MP bars, player name and level, navigation buttons
- **Left Column** (260px) — Animated voxel preview, core stats, 37 derived stats, progress tracker
- **Center Column** — 8 tabbed panels: Equipment, Attributes (+/− allocation), Class Skills, Weapon Skills, Upgrades, Crafting, Quests, Guild
  - **Equipment tab** — All 10 slots around animated hero preview; tier colour borders, icon display
- **Right Column** (280px) — WoW-style 36-slot inventory:
  - **Drag-and-drop**: bag ↔ equip slots (slot-type validated), reorder within bag, trash-zone destroy
  - **Double-click**: equip from bag / unequip from slot
  - **Right-click**: context menu with Equip, Unequip, Inspect, Destroy actions
  - **Item tooltips**: tier-coloured stat block, passive, lore, hints on hover
  - Tier badge overlay, ObjectStore `iconUrl` or emoji fallback per slot type
  - `+ Loot` dev button generates random test items

### Controls (Open World)
- **WASD** — Movement (W always moves away from camera)
- **Shift** — Sprint (1.6× speed, drains stamina)
- **Space** — Dodge roll (i-frames, 20 stamina cost, 1.5s cooldown)
- **Tab** — Cycle nearby enemy targets
- **E** — Interact (dungeon entrances, NPCs, harvest nodes)
- **C** — Character panel
- **1-5** — Abilities

## ObjectStore API Integration

The game connects to Grudge ObjectStore for authoritative game data:

```
Base URL: https://molochdagod.github.io/ObjectStore
```

### Endpoints Used
| Endpoint | Data |
|----------|------|
| `/api/v1/weaponSkills.json` | Weapon skill trees and options per weapon type |
| `/api/v1/weapons.json` | Weapon stats, categories, tiers, lore |
| `/api/v1/attributes.json` | Attribute definitions, formulas, icons |
| `/api/v1/professions.json` | Profession trees, milestones, XP tables |
| `/api/v1/armor.json` | Armor sets, materials, stats |
|| `/api/v1/equipment.json` | Equipment slot config, tier multipliers |
|| `/api/v1/voxelAssets.json` | Voxel asset catalog: trees, rocks, mountains, terrain props, structures, animals, enemies |

See [docs/GRUDGE_BACKEND_INTEGRATION.md](docs/GRUDGE_BACKEND_INTEGRATION.md) for full integration guide and best practices.

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Shadcn UI
- **3D Engine:** BabylonJS 9 (WebGL2, IBL, DefaultRenderingPipeline, PBR, thin instances, animation retargeting)
- **3D Assets:** 45 GLB models from Unity FRESH GRUDGE (characters, monsters, buildings, weapons, animations)
- **2D Rendering:** Custom HTML5 Canvas with fog of war, voxel model builders
- **Game Bridge:** genesis-game-bridge.ts connects all RPG systems to 3D scene
- **Combat:** XState finite state machine (combo, block, dash, jump, whirlwind, etc.)
- **Routing:** Wouter
- **Animation:** GSAP, custom voxel-motion library
- **Physics:** cannon-es, Havok (BabylonJS)
- **AI Backend:** Grudge Studio ai-agent service (Anthropic → OpenAI → DeepSeek → Gemini → Ollama fallback chain)
- **Multiplayer:** Colyseus.js + Socket.IO
- **Auth:** Grudge ID (id.grudge-studio.com)
- **Object Storage:** Grudge ObjectStore API
- **Fonts:** Craftpix `StraightPixelGothic.otf`, Cinzel, Crimson Text, Oxanium, JetBrains Mono
- **Deployment:** Vercel (frontend), Grudge Studio VPS (backend)

## Project Structure

```
client/src/
├── game/
│   ├── grudge-api.ts          # ObjectStore API client with caching
│   ├── weapon-skills.ts       # Weapon-based skill loadout system
│   ├── attributes.ts          # 8-attribute system with derived stats
│   ├── professions-system.ts  # Gathering & crafting professions
│   ├── crafting.ts            # Recipe generation & crafting logic
│   ├── equipment.ts           # Equipment slots, tiers, set bonuses
│   ├── open-world.ts          # Open World game state, MMO controls, AI, combat
│   ├── open-world-types.ts    # Monster templates, zone configs, dungeon entrances
│   ├── terrain-heightmap.ts   # WorldHeightmap with 6 terrain layers, walkability grid
│   ├── boats.ts               # 3-tier boat system, docks, mount/dismount
│   ├── pathfinding.ts         # A* on 40px grid, octile heuristic, path smoothing, LOS
│   ├── spawner-system.ts      # 5 spawner types, per-zone configs, event linking
│   ├── zone-events.ts         # 6 event types, cooldown lifecycle, kill tracking
│   ├── ai-behaviors.ts        # Behavior trees: 13 leaf nodes, 7 archetype trees
│   ├── zones.ts               # 16+ island zones with spawn points, NPC positions
│   ├── missions.ts            # Quest/mission system with objectives and rewards
│   ├── npc-shops.ts           # NPC shop system: buy/sell, respec, tier-scaled inventory
│   ├── minimap.ts             # Real-time minimap renderer with zoom controls
│   ├── puter-cloud.ts         # Puter.js cloud services (AI, KV, storage)
│   ├── combat.ts              # Shared damage pipeline, buildDamageOpts, DamageOpts
│   ├── skill-trees.ts         # Skill tree definitions and progression
│   ├── spell-system.ts        # Spell casting system and spell data
│   ├── trail-effects.ts       # Weapon trail and VFX trail effects
│   ├── engine.ts              # MOBA game engine
│   ├── dungeon.ts             # Dungeon crawler engine
│   ├── types.ts               # Shared types, 26 heroes, abilities
│   ├── voxel.ts               # Voxel rendering, weapon animations, VFX
│   ├── voxel-parts.ts         # Part-based voxel rig (15 weapon types, T-pose, full animations)
│   ├── voxel-motion.ts        # Animation primitives
│   ├── ow-anim-fsm.ts         # Open World animation FSM (priority/interruptibility)
│   ├── effect-pool.ts         # Pre-allocated VFX pool with per-type visual curves
│   ├── glb-sprites.ts         # GLB/GLTF 3D model sprite loader
│   ├── terrain-placer.ts      # AI terrain placement (land tiles, roads, buildings, decor, water edges)
│   ├── tilesets.ts            # Tileset catalog: tropical (256px), castle/house (32px), biome mappings
│   ├── tile-renderer.ts       # TileMapRenderer: camera-culled ground/road/building/decor rendering
│   ├── combat-popups.ts       # PixelGothic font loader + EVENT_BANNERS GIF paths
│   └── character-data.ts      # Unified character data layer (reactive stats from equipment)
├── pages/
│   ├── open-world.tsx         # Open World UI, HUD, game loop, event banner overlay
│   ├── game.tsx               # MOBA UI, event banner overlay
│   ├── dungeon-game.tsx       # Dungeon UI
│   ├── character.tsx          # /character — WoW-style inventory, reactive equipment, backend sync
│   ├── character-select.tsx   # Hero selection screen
│   ├── toon-admin.tsx         # Sprite editor with always-on gizmo + rig mode
│   ├── world-editor.tsx       # World editor for zone design
│   ├── map-admin.tsx          # MOBA map admin editor
│   ├── admin.tsx              # Admin editor suite
│   ├── entity-editor.tsx      # Entity editor: Heroes, Minions, Monsters, Structures, Effects, Environment, Animals
│   └── settings.tsx           # Keybindings and settings
├── components/
│   ├── MainPanel.tsx          # Full-screen 3-column character panel (C key)
│   ├── MainPanel.module.css   # Dark-fantasy CSS module: context menu, tooltips, inventory drag states
│   ├── character-tabs/        # EquipmentTab (interactive drag/drop), AttributesTab, SkillsTabs, etc.
│   ├── NpcDialog.tsx          # NPC interaction modal (Shop/Quests/Train/Craft tabs)
│   └── NpcDialog.module.css   # Dark-fantasy CSS module for NPC dialog
├── index.css                  # @font-face: PixelGothic (StraightPixelGothic.otf)
public/
│   ├── fonts/StraightPixelGothic.otf  # Craftpix pixel gothic font
│   └── assets/animated-text/          # Craftpix event banner GIFs (9 animations)
```

## Development

```bash
npm install
npm run dev
```

## Deployment

Deployed automatically via Vercel on push to `main`.

```bash
git push origin main
```

### Grudge Studio Infrastructure

| Service | Domain | Purpose |
|---------|--------|---------|
| Vercel | `dungeon-crawler-quest.vercel.app` | Primary game hosting, auto-deploy from GitHub |
| ObjectStore | `molochdagod.github.io/ObjectStore` | Static game data API (weapons, skills, attributes) |
| Grudge Backend | `api.grudge-studio.com` | Auth (Discord/Web3Auth), player saves, multiplayer |
| Dashboard | `dash.grudge-studio.com` | Admin tools and backend dashboard |
| Cloudflare | `grudge-studio.com` | DNS, CDN, backend routing |
| Puter Cloud | puter.js | AI (NPC dialogue, lore), KV storage, cloud saves |

See [docs/GRUDGE_BACKEND_INTEGRATION.md](docs/GRUDGE_BACKEND_INTEGRATION.md) for full backend integration guide.

## License

Grudge Studio — All rights reserved.
