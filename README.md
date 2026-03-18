# GRUDGE Warlords

Browser-based dark fantasy RPG featuring 5v5 MOBA, Dungeon Crawler, and Open World MMO modes. Built with React, Three.js, and the Grudge ObjectStore API.

**Live:** [dungeon-crawler-quest.vercel.app](https://dungeon-crawler-quest.vercel.app)

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
- Multi-zone seamless world with day/night cycle
- 6 terrain biomes with dynamic weather
- AI faction system, NPC interactions
- Full RPG progression (see RPG Systems below)

#### Combat & Visual Polish
- Screen shake on melee hits, heavy attacks, and kills
- Hit flash overlay on damaged enemies with aggro indicator
- Combo counter system with timer bar and color-coded display
- Styled floating damage numbers with pop-in animation, crit glow, and outline
- Death burst VFX: radial particles, gold coin pops, XP orbs, impact ring
- Ambient atmosphere: firefly and dust mote particle systems
- Heavy attack cooldown arc indicator
- GLB/GLTF 3D model sprite loader for voxel-style assets

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
- Attribute allocation with +/− buttons
- Derived stats display
- Weapon skill loadout viewer
- Accessible in Open World mode

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
│   ├── open-world.ts          # Open World game state & logic
│   ├── engine.ts              # MOBA game engine
│   ├── dungeon-engine.ts      # Dungeon crawler engine
│   ├── types.ts               # Shared types, heroes, abilities
│   ├── voxel.ts               # Voxel rendering system
│   ├── voxel-motion.ts        # Animation primitives
│   └── glb-sprites.ts         # GLB/GLTF 3D model sprite loader
├── pages/
│   ├── open-world.tsx         # Open World UI & game loop
│   ├── game.tsx               # MOBA UI
│   ├── dungeon.tsx            # Dungeon UI
│   ├── editor.tsx             # Entity/Animation editor
│   └── admin.tsx              # Admin editor suite
└── components/                # Shared UI components
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

## License

Grudge Studio — All rights reserved.
