# GRUDGE Warlords - MOBA

A browser-based MOBA game with procedural voxel art, 26 playable heroes across 6 races and 4 classes, built with React and HTML5 Canvas.

## Architecture

### Frontend (Game)
- **Game Engine**: Custom HTML5 Canvas 2D MOBA engine with top-down perspective
  - `client/src/game/types.ts` - All game types, 26 hero definitions from hero-codex, items, abilities, map data, stat calculations
  - `client/src/game/voxel.ts` - Procedural voxel art renderer (isometric cubes, hero/minion models per race+class)
  - `client/src/game/engine.ts` - MOBA game loop, combat math, AI opponents, rendering, minimap
- **Pages**:
  - `client/src/pages/home.tsx` - Title screen with animated particle background
  - `client/src/pages/character-select.tsx` - Hero selection with race/class filters, stat bars, ability previews, voxel model preview
  - `client/src/pages/game.tsx` - Main game canvas with RPG UI overlay (hotbar, health/mana bars, item slots, shop, scoreboard)
- **UI Framework**: React + Shadcn + Tailwind CSS (dark mode forced)
- **Routing**: Wouter
- **Fonts**: Oxanium for headings, Inter for body

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

### MOBA Mechanics
- 4000x4000 map with 3 lanes (top, mid, bot)
- 5v5 (player + 4 AI allies vs 5 AI enemies)
- Towers along each lane (2 per lane per team + 1 base tower)
- Nexus base structure (destroy to win)
- Minion waves every 30 seconds (melee + siege after 2 min)
- Hero leveling 1-18 with stat scaling
- 4 abilities per class (Q/W/E/R) with cooldowns and mana costs
- Auto-attack system with projectiles
- Item shop (12 items across 3 tiers)
- Gold from last-hits, kills (+300g), assists (+100g)
- KDA scoring and kill feed

### Voxel Art System
- Procedural isometric cube rendering inspired by IsoVoxel/PixVoxelAssets GitHub repos
- Unique hero models per race+class combination (skin color, armor, weapons, racial features)
- Minion voxel models (melee/siege variants)
- Animation states: idle, walk, attack, ability

### RPG UI Overlay
- Based on Forced-Top-Layer RPG UI template
- Stone/gold panel styling with corner rivets
- Bottom hotbar with ability slots (Q/W/E/R) and 6 item slots
- Left chat/kill feed panel
- Right stat panel with portrait, ATK/DEF/SPD, KDA
- Top team score bar with game timer
- Full-screen shop panel (B key)
- Scoreboard (Tab key)
- Victory/defeat screen with stats

### Combat Math
- Damage formula: ATK * (1 ± 10% variance) * (1 - DEF/(DEF+50))
- Shield absorption system
- Buff/debuff timers (ATK boost, speed slow, stun)
- AoE abilities with radius checks
- Dash abilities with distance capping

### AI System
- Heroes retreat to base when HP < 20%
- Auto-use abilities when off cooldown and targets in range
- Auto-buy most expensive affordable item
- Lane pathing when no enemies nearby
- Base healing when near own base

## Controls
- WASD: Move hero
- Q/W/E/R or 1-4: Use abilities
- Space/Left-click: Auto-attack nearest enemy
- Right-click: Move to position or target enemy
- B: Toggle item shop
- Tab: Show scoreboard
- Scroll: Zoom camera
- Escape: Pause

## Design
- Dark fantasy theme with crimson (#ef4444), gold (#ffd700), purple (#a855f7) accent colors
- Forced dark mode via `document.documentElement.classList.add("dark")`
- Game state in useRef, HUD synced to React every ~100ms for performance
