# GRUDGE Warlords

## Overview

GRUDGE Warlords is a browser-based dark fantasy game offering two distinct modes: a 5v5 MOBA and a Dungeon Crawler. The project aims to deliver a rich, engaging experience with 26 unique heroes across diverse races and classes, sophisticated AI, and detailed combat mechanics. The game features a dual 2D/3D renderer, comprehensive spell and status effect systems, and procedural content generation, pushing the boundaries of browser-based gaming.

## User Preferences

I prefer iterative development, with clear communication before major changes. I value detailed explanations for complex implementations but keep responses concise where possible. I like functional programming paradigms where they fit naturally.

## System Architecture

The game utilizes a React frontend with a custom HTML5 Canvas 2D and Three.js 3D dual renderer for its core game engine. Tailwind CSS with Shadcn UI components is used for the user interface, maintaining a forced dark mode and a dark fantasy theme with crimson, gold, and purple accents. Wouter handles frontend routing. The backend is a minimal Express server serving static files, as game state is client-side.

**Core Game Engine:**
- **Rendering:** Custom HTML5 Canvas 2D and Three.js 3D renderers support voxel art for characters and environments.
- **Game Modes:** Dedicated engines for MOBA (`engine.ts`) with 5v5 combat, AI, and lane mechanics, and Dungeon Crawler (`dungeon.ts`) with procedural generation, enemy AI, and boss fights.
- **Combat System:** Features 19 status effects (DoT, CC, buffs), critical hits, armor penetration, and lifesteal. Includes a Dota 2-paced attack system with wind-up, damage point, and backswing.
- **Keybinding System:** Fully rebindable actions for both game modes, persisted in localStorage.
- **AI System:** Advanced AI for MOBA opponents and allies, featuring threat evaluation, smart retreat logic, class-aware ability targeting, last-hitting, and contextual chat callouts.
- **Animation System:** Loads external FBX animation clips (Idle, Run, Attack, Death, Hit) with cross-fading and state mapping for 3D models.
- **Voxel Art System:** Procedural isometric voxel rendering for heroes, minions, terrain, and structures, with multi-part body posing, class-specific attack animations, and unique racial features. Uses a tile cache for performance.
- **RPG UI Overlay:** In-game HUD with ability hotbar, item slots, buff/debuff display, KDA, scoreboard, and custom cursor.
- **Spell VFX System:** Comprehensive system with 16 visual effect types, multi-layered impact VFX, spell projectiles with trails, screen shake on powerful abilities, and charge systems for certain spells.

**Features:**
- **Heroes:** 26 unique heroes across 6 races (Human, Barbarian, Dwarf, Elf, Orc, Undead) and 4 classes (Warrior, Worg, Mage, Ranger), with unique stats and 4 abilities each.
- **MOBA Mode:** 4000x4000 map, 3 lanes, towers, Nexus objective, minion waves, jungle camps, hero leveling (1-18), item shop (12 items across 3 tiers), gold economy, and KDA scoring.
- **Dungeon Crawler Mode:** 10 procedural floors, various enemy types, boss fights every 5th floor, traps, chests, and an inventory system.

## Melee Attack System
- Melee heroes (Warrior/Worg) use `rng * 50` for pixel range (~75px), ranged get ~275-325px
- `performAutoAttack()` uses dynamic `meleeRange = hero.rng + 40` for melee hit check (not hardcoded)
- Melee attacks always deal instant damage even if slightly out of range (lunge fallback, no projectile)
- Melee VFX: slash_arc + impact_ring + 5 radial particles + screen shake on abilities
- Melee abilities (damage type) auto-lunge up to 80px toward target with dash_trail VFX
- Wind-up connection range: melee `rng + 60`, ranged `rng + 80`

## Custom Cursor System
- Canvas cursor: none (OS cursor hidden on 2D canvas)
- Custom-drawn cursors per mode: attack (red crosshair), ability (purple spinning arcs), attackmove (orange), move (green arrow), default (gold brackets)
- Grab hand cursor (`/assets/cursor-grab.png`) shown when hovering over selectable entities

## 3D Model Assets
- Neutral minion FBX models: `/assets/models/neutrals/neutral_minion_01-03.fbx` (from FreeContent pack)
- Registered in prefabs.ts as CREATURE_PREFABS (neutral_minion_01/02/03)

## External Dependencies

- **Frontend Framework:** React
- **UI Components:** Shadcn UI
- **Styling:** Tailwind CSS
- **Routing:** Wouter
- **3D Rendering:** Three.js
- **Model Loading:** GLTFLoader/FBXLoader (from Three.js)
- **Animation:** GSAP 3.12.5 (tweening/easing library)
- **Physics:** cannon-es (3D physics for knockback/launch effects)
- **State Machines:** XState (combat combo system)
- **Backend (minimal):** Express.js (for serving static files)

## Mouse Targeting & AOE System
- `MouseTargetingManager` class (mouse-targeting.ts): handles AOE ground targeting with circle indicator, max range ring, valid/invalid color pulsing
- AOE abilities: press ability key → shows targeting circle → left-click confirms → spawns AreaDamageZone
- Right-click or Escape cancels AOE targeting
- `PhysicsWorld` (physics.ts): cannon-es wrapper with hero/projectile bodies, knockback impulse, scale factor 0.01

## Quality Notes
- All TypeScript compiles cleanly (no errors)
- AI heroes emit contextual chat messages based on situation (retreat, engage, laning, etc.)
- Weapon trails use class-specific tint colors (red/purple/green/orange)
- Combo finisher animation has dramatic body twist and full weapon glow
- River tiles have animated water overlay with ripple effects
- Area damage zones support fire/frost/poison/lightning/holy/shadow types with status effects