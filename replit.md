# GRUDGE - Dungeon of Shadows

A browser-based hack and slash dungeon crawler game inspired by Diablo 4, built with React and HTML5 Canvas.

## Architecture

### Frontend (Game)
- **Game Engine**: Custom HTML5 Canvas 2D engine with top-down perspective
  - `client/src/game/types.ts` - All game types, stat calculations, character classes, loot generation
  - `client/src/game/dungeon.ts` - Procedural dungeon generation (room + corridor algorithm), visibility/fog of war
  - `client/src/game/engine.ts` - Game loop, rendering, combat, enemy AI, player mechanics
- **Pages**:
  - `client/src/pages/home.tsx` - Title screen with animated background
  - `client/src/pages/character-select.tsx` - Character class selection with stat allocation (160 points across 8 attributes from grudgeplatform.com)
  - `client/src/pages/game.tsx` - Main game canvas with React HUD overlay (health/mana orbs, ability bar, inventory, character sheet, minimap)
- **UI Framework**: React + Shadcn + Tailwind CSS (dark mode forced)
- **Routing**: Wouter

### Backend
- Express server (minimal, serves static files)
- No database needed - game state is client-side

## Game Features
- 6 character classes: Crusader Knight, Berserker, Elf Ranger, Human Deathgiver, Dwarf Enforcer, Barbarian Gladiator
- 8 attributes: Strength, Intellect, Vitality, Dexterity, Endurance, Wisdom, Agility, Tactics
- Procedurally generated dungeons with multiple floors
- Real-time combat with 4 abilities per class
- Loot system with 5 rarity tiers (common to legendary)
- Equipment slots: weapon, helmet, chest, legs, boots, gloves, ring, amulet
- Enemy types: skeleton, zombie, demon, spider, wraith, golem, dragon, necromancer
- Boss encounters on each floor
- Leveling system with stat point allocation

## Controls
- WASD: Move
- Space: Attack
- 1-4: Abilities
- E: Interact (chests, stairs)
- I: Inventory
- C: Character sheet
- ESC: Pause

## Theme
- Dark fantasy with crimson/red primary colors
- Font: Oxanium for headings, Inter for body
- Forced dark mode
