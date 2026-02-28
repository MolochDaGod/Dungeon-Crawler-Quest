# GRUDGE Warlords

## Overview

GRUDGE Warlords is a browser-based dark fantasy game featuring both a 5v5 MOBA and a Dungeon Crawler mode. It aims to provide a deep, engaging experience with 26 unique heroes across multiple races and classes, sophisticated AI, and detailed combat mechanics. The game utilizes a dual 2D/3D renderer, comprehensive spell and status effect systems, and procedural content generation, pushing the boundaries of browser-based gaming. The vision is to deliver a competitive and exploratory fantasy experience in a browser environment.

## User Preferences

I prefer iterative development, with clear communication before major changes. I value detailed explanations for complex implementations but keep responses concise where possible. I like functional programming paradigms where they fit naturally.

## System Architecture

The game's architecture centers on a React frontend with a custom HTML5 Canvas 2D and Three.js 3D dual renderer for its core engine. The UI uses Tailwind CSS with Shadcn UI components, enforcing a dark mode with a dark fantasy theme (crimson, gold, purple accents). Wouter manages frontend routing, and the backend is an Express server with REST API endpoints for game data and results.

**Core Game Engine:**
- **Rendering:** Custom HTML5 Canvas 2D and Three.js 3D renderers support voxel art for characters and environments.
- **Game Modes:** Dedicated engines for MOBA (5v5 combat, AI, lane mechanics) and Dungeon Crawler (procedural generation, enemy AI, boss fights).
- **Combat System:** Features 19 status effects (DoT, CC, buffs), critical hits, armor penetration, lifesteal, and a Dota 2-paced attack system.
- **AI System:** Advanced DOTA2-style AI with game phase awareness (laning/midgame/lategame), last-hitting, lane equilibrium, gank rotations, focus-fire coordination, orb-walking for ranged heroes, and class-specific ability leveling priorities.
- **Animation System:** Loads external FBX animation clips with cross-fading and state mapping for 3D models.
- **Voxel Art System:** Procedural isometric voxel rendering for heroes, minions, terrain, and structures with multi-part body posing and class-specific animations.
- **RPG UI Overlay:** In-game HUD with ability hotbar (with level indicators and level-up buttons), item slots, buff/debuff display, KDA, scoreboard, and custom cursor.
- **Spell VFX System:** Comprehensive system with 16 visual effect types, multi-layered impact VFX, projectiles with trails, screen shake, and charge systems.
- **Keybinding System:** Fully rebindable actions persisted in localStorage. Ctrl+Q/W/E/R to level abilities.
- **Fog of War:** Full fog of war on both main 2D canvas and minimap. Vision sources: heroes (600px), towers (500px), minions (300px). Explored-but-not-visible areas shown dimly. Enemy entities hidden outside vision.
- **Ability Leveling System:** Heroes gain ability points on level up. Each ability (Q/W/E/R) can be leveled up to 4 times (R up to 3 times at levels 6/11/16). Ability damage scales +25% per level.

**Features:**
- **Heroes:** 26 unique heroes across 6 races and 4 classes, each with 4 abilities.
- **MOBA Mode:** 4000x4000 map, 3 lanes, towers, Nexus objective, minion waves, jungle camps, hero leveling (1-18), item shop, gold economy, and KDA scoring.
- **Dungeon Crawler Mode:** 10 procedural floors, various enemy types, boss fights, traps, chests, and an inventory system.
- **Targeting System:** `MouseTargetingManager` handles AOE ground targeting with visual indicators.
- **Audio Settings:** Configurable master, SFX, and music volumes persisted locally.
- **Sprite Effect System:** Loads and manages 20 pixel art effect spritesheets for various combat triggers.
- **Dungeon Visibility:** Fog of War with `VISION_RADIUS` and distance-based dimming for tiles and enemies.
- **Animation Editor:** Developer tool for previewing voxel hero animations, accessed via `/animation-editor`.
- **Admin Editor Suite:** Comprehensive `/admin` page with 6 tabs — Characters (race/class/stats), Animations (10 states, playback controls, pose inspector), Effects (ability editor, sprite effect mapping/preview), Weapons (type/color/glow/items), AI Config (all tunable parameters), AI Generator (8 presets, randomizer, save/compare/apply profiles). Live voxel preview canvas with SpriteEffectSystem overlay.
- **REST API:** Endpoints for heroes (`GET /api/heroes`, `/api/heroes/:id`), abilities (`GET /api/abilities/:class`), items (`GET /api/items`), and game results (`POST/GET /api/game/results`).
- **Gameplay Systems:** Passive gold (1/s), last-hit bonus (+15g), kill streak bounties, first blood (+200g), tower bounties (200g split), mana regen, minion scaling, tower aggro protection, and dynamic respawn timers.

**Design Choices:**
- **UI/UX:** Forced dark mode with a dark fantasy theme using crimson, gold, and purple accents.
- **Rendering:** Both 2D and 3D renderers utilize voxel art. 3D renderer includes a 5-light rig, gradient skybox, height-varied terrain, animated water, GPU instanced particles, capsule heroes with PBR materials, and comprehensive spell VFX.
- **Combat Visuals:** Detailed voxel combat animations with triple-layered effects, shockwaves, and class-specific trails.
- **Map Tiles:** Enhanced 2D tiles with procedural grass tufts/flowers, worn stone lane paths with cracks, jungle moss/spore particles, river lilypads/sparkles/foam, and faction-colored base rune circles with ambient glow.

## External Dependencies

- **Frontend Framework:** React
- **UI Components:** Shadcn UI
- **Styling:** Tailwind CSS
- **Routing:** Wouter
- **3D Rendering:** Three.js
- **Model Loading:** GLTFLoader/FBXLoader (from Three.js)
- **Animation:** GSAP
- **Physics:** cannon-es
- **State Machines:** XState
- **Backend:** Express.js with REST API
