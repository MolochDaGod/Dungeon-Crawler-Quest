# GRUDGE Warlords

Browser-based dark fantasy RPG featuring 5v5 MOBA, Dungeon Crawler, and Open World MMO modes. Built with React, Three.js, and the Grudge ObjectStore API.

**Live:** [dungeon-crawler-quest.vercel.app](https://dungeon-crawler-quest.vercel.app)

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

#### Combat & Visual Polish
- Weapon-leading melee slash: weapon rotation drives the swing, body lunges forward
- Weapon afterimage ghost trail during attacks
- Widened VFX slash arc with increased reach
- Spell combo system: chain abilities within 3s for stacking +8% damage (up to 5 stacks)
- Channeling particle burst VFX scaled by combo count
- Screen shake on melee hits, heavy attacks, ability damage, and kills
- Hit flash overlay on damaged enemies with aggro indicator
- Combo counter system with timer bar and color-coded display
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
- 3 points per level-up, freely allocatable
- Derived stats: bonus HP/MP, phys/magic ATK, DEF, SPD, crit, evasion, heal power, ability bonus
- Class-based starting distributions (Warrior, Mage, Ranger, Worg)

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
- 9 equip slots: 7 armor + main hand + off-hand
- Tier-scaled stats (1.0× to 3.3× multiplier)
- Weapon equip triggers automatic skill loadout swap
- Set bonuses at 2/4/6 piece thresholds
- Equipment bag for unequipped items, full persistence

### Character Panel (C key)
Full-screen 3-column dark-fantasy UI with Cinzel/Crimson Text/JetBrains Mono fonts:
- **Top Bar** — HP/MP/SP resource bars, player name and level, close button
- **Left Column** (260px) — Character preview, core stats (ATK/DEF/SPD), derived stats, progress tracker (reputation, zones, kills, bosses)
- **Center Column** — 8 tabbed panels:
  - **Equipment** — 8 equip slots in grid layout, character silhouette, set bonus tracker
  - **Attributes** — 8 primary stats with +/− allocation, emoji icons, derived bonuses grid
  - **Class Skills** — Abilities grouped by slot tier, damage/CD/MP/effect chip badges
  - **Weapon Skills** — Dynamic loadout based on equipped weapon type
  - **Upgrades** — Placeholder for gear/ability upgrade system
  - **Crafting** — Gathering & crafting profession bars with XP progress, crafting station grid
  - **Quests** — Active quest cards with progress bars, claim reward buttons
  - **Guild** — Guild crest, member list placeholder
- **Right Column** (280px) — 6-column inventory grid (36 slots), gold display, trash zone
- **Bottom Bar** — 10-slot hotbar with ability cooldown overlays and keybind labels

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
| `/api/v1/equipment.json` | Equipment slot config, tier multipliers |

See [docs/GRUDGE_BACKEND_INTEGRATION.md](docs/GRUDGE_BACKEND_INTEGRATION.md) for full integration guide and best practices.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Shadcn UI
- **3D Rendering:** Three.js with voxel art pipeline
- **2D Rendering:** Custom HTML5 Canvas with fog of war
- **Routing:** Wouter
- **Animation:** GSAP, custom voxel-motion library
- **Physics:** cannon-es
- **State Machines:** XState
- **Deployment:** Vercel

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
│   ├── minimap.ts             # Real-time minimap renderer with zoom controls
│   ├── puter-cloud.ts         # Puter.js cloud services (AI, KV, storage)
│   ├── engine.ts              # MOBA game engine
│   ├── dungeon.ts             # Dungeon crawler engine
│   ├── types.ts               # Shared types, 26 heroes, abilities
│   ├── voxel.ts               # Voxel rendering, weapon animations, VFX
│   ├── voxel-motion.ts        # Animation primitives
│   └── glb-sprites.ts         # GLB/GLTF 3D model sprite loader
├── pages/
│   ├── open-world.tsx         # Open World UI, HUD, game loop
│   ├── game.tsx               # MOBA UI
│   ├── dungeon-game.tsx       # Dungeon UI
│   ├── character-select.tsx   # Hero selection screen
│   ├── world-editor.tsx       # World editor for zone design
│   ├── map-admin.tsx          # MOBA map admin editor
│   ├── admin.tsx              # Admin editor suite
│   └── settings.tsx           # Keybindings and settings
├── components/
│   ├── MainPanel.tsx          # Full-screen 3-column character panel (C key)
│   └── MainPanel.module.css   # Dark-fantasy CSS module for MainPanel
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
