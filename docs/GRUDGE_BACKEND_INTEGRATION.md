# Grudge Backend Integration Guide

Best practices for connecting Grudge Warlord games to the Grudge backend services.

## Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Game Client │────▶│  ObjectStore API  │     │  Grudge Backend     │
│  (Browser)   │     │  (GitHub Pages)   │     │  (grudge-studio.com)│
│              │────▶│  Static JSON data │     │  Auth, accounts,    │
│              │────▶│                   │     │  persistence, live  │
└─────────────┘     └──────────────────┘     └─────────────────────┘
```

**Two backends serve different purposes:**

- **ObjectStore API** — Static game data (weapons, skills, attributes, professions, armor, equipment). Read-only, cached, no auth required. Hosted on GitHub Pages.
- **Grudge Backend** (`grudge-studio.com`) — Player accounts, authentication (Discord/Web3Auth), persistent saves, live multiplayer, leaderboards. Requires auth.

## ObjectStore API (Game Data)

### Base URL
```
https://molochdagod.github.io/ObjectStore
```

### Available Endpoints

| Endpoint | Description | Cache Strategy |
|----------|-------------|----------------|
| `/api/v1/weaponSkills.json` | Weapon skill trees per weapon type, shared + weapon-specific slots | 5 min |
| `/api/v1/weapons.json` | All weapon categories, items, stats, tiers, lore | 5 min |
| `/api/v1/attributes.json` | 8 attribute definitions, formulas, colors | 5 min |
| `/api/v1/professions.json` | Gathering & crafting professions, skill trees, XP tables | 5 min |
| `/api/v1/armor.json` | Armor sets by material (cloth/leather/metal), stats | 5 min |
| `/api/v1/equipment.json` | Equipment slot config, tier multipliers, upgrade costs | 5 min |

### Best Practices

#### 1. Use the API Client Singleton

```typescript
import { grudgeApi } from '@/game/grudge-api';

// Always use the singleton — it handles caching automatically
const weapons = await grudgeApi.getWeapons();
const skills = await grudgeApi.getWeaponTypeSkills('swords');
const attrs = await grudgeApi.getAttributes();
```

#### 2. Cache with TTL

The `grudge-api.ts` client caches all responses for 5 minutes in memory. This prevents hammering the API during gameplay loops.

```typescript
// Cache is automatic — repeated calls within 5min hit memory
const data1 = await grudgeApi.getWeapons(); // fetches
const data2 = await grudgeApi.getWeapons(); // returns cached

// Force refresh when needed
grudgeApi.clearCache();
```

#### 3. Always Provide Fallback Defaults

ObjectStore is a static API on GitHub Pages — it can go down. Every system must work offline.

```typescript
import { FALLBACK_ATTRIBUTES } from '@/game/grudge-api';

async function loadAttributes() {
  try {
    const data = await grudgeApi.getAttributes();
    return data.attributes;
  } catch {
    return FALLBACK_ATTRIBUTES; // bundled defaults
  }
}
```

#### 4. Type Everything

All ObjectStore responses have TypeScript interfaces in `grudge-api.ts`:

- `OSWeaponSkillsData` — weapon skill trees
- `OSWeaponsData` — weapon categories and items
- `OSAttributesData` — attribute definitions
- `OSProfessionsData` — profession trees and XP tables
- `OSArmorData` — armor sets and stats
- `OSEquipmentData` — equipment configuration

Import and use these types to catch API shape changes at compile time.

#### 5. Fetch at Init, Not Per Frame

Load ObjectStore data during initialization, not in the game loop:

```typescript
// GOOD — fetch once during init
async function initGame() {
  const weaponData = await grudgeApi.getWeapons();
  const skillData = await grudgeApi.getWeaponSkills();
  state.weaponData = weaponData;
  state.skillData = skillData;
}

// BAD — fetching in update loop
function update() {
  const data = await grudgeApi.getWeapons(); // DON'T
}
```

## Grudge Backend (Player Services)

### Base URL
```
https://api.grudge-studio.com   (production)
https://dash.grudge-studio.com  (dashboard)
```

### Authentication

Grudge uses **Discord OAuth** and **Web3Auth (Solana)** for player identity.

```typescript
// Discord auth flow
const authUrl = 'https://api.grudge-studio.com/auth/discord';

// After auth, store the Grudge ID
interface GrudgeSession {
  grudgeId: string;        // Unique player ID (computer ID + wallet)
  discordId: string;
  walletAddress: string;   // Solana wallet via Web3Auth
  token: string;           // JWT session token
}
```

**Best practices:**
- Store the JWT token securely — never expose in client-side code or logs
- Refresh tokens before expiry
- Use the `grudgeId` as the canonical player identifier across all systems

### Player Data Persistence

For saving player progress to the Grudge backend instead of localStorage:

```typescript
// Pattern: local-first with backend sync
async function savePlayerData(grudgeId: string, data: PlayerSaveData) {
  // 1. Always save locally first (instant, works offline)
  localStorage.setItem(`grudge_save_${grudgeId}`, JSON.stringify(data));

  // 2. Sync to backend when online
  try {
    await fetch('https://api.grudge-studio.com/api/player/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        grudgeId,
        gameId: 'grudge-warlords',
        data,
      }),
    });
  } catch {
    // Queue for retry — backend is optional
    pendingSyncs.push({ grudgeId, data, timestamp: Date.now() });
  }
}
```

### What to Persist

| System | localStorage Key | Backend Sync | Priority |
|--------|-----------------|--------------|----------|
| Attributes | `grudge_player_attributes` | Yes | High |
| Weapon Loadout | `grudge_weapon_loadout` | Yes | High |
| Professions | `grudge_player_professions` | Yes | High |
| Resource Inventory | `grudge_resource_inventory` | Yes | Medium |
| Equipment | `grudge_player_equipment` | Yes | High |
| Equipment Bag | `grudge_equipment_bag` | Yes | Medium |
| Settings/Hotkeys | `grudge_settings` | Optional | Low |

### API Pattern for New Games

When connecting a **new game** to the Grudge backend:

```typescript
// 1. Create an API client module
// file: src/game/grudge-api.ts

const OBJECTSTORE_URL = 'https://molochdagod.github.io/ObjectStore';
const BACKEND_URL = 'https://api.grudge-studio.com';

export const grudgeApi = {
  // Static game data (ObjectStore)
  async getGameData(endpoint: string) {
    return fetchCached(`${OBJECTSTORE_URL}${endpoint}`);
  },

  // Player data (Grudge Backend)
  async getPlayerData(token: string, grudgeId: string) {
    return fetch(`${BACKEND_URL}/api/player/${grudgeId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(r => r.json());
  },

  async savePlayerData(token: string, grudgeId: string, data: any) {
    return fetch(`${BACKEND_URL}/api/player/${grudgeId}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },
};
```

```typescript
// 2. Initialize at game start
async function initGame() {
  // Load static game data from ObjectStore
  const [weapons, skills, attrs, profs] = await Promise.all([
    grudgeApi.getGameData('/api/v1/weapons.json'),
    grudgeApi.getGameData('/api/v1/weaponSkills.json'),
    grudgeApi.getGameData('/api/v1/attributes.json'),
    grudgeApi.getGameData('/api/v1/professions.json'),
  ]);

  // Load player save from backend (or localStorage fallback)
  let playerSave;
  if (session?.token) {
    playerSave = await grudgeApi.getPlayerData(session.token, session.grudgeId);
  }
  if (!playerSave) {
    playerSave = JSON.parse(localStorage.getItem('grudge_save') || 'null');
  }

  // Initialize game systems with data
  initAttributes(attrs, playerSave?.attributes);
  initEquipment(weapons, playerSave?.equipment);
  initProfessions(profs, playerSave?.professions);
}
```

```typescript
// 3. Save on meaningful events, not every frame
function onLevelUp() {
  grantLevelUpPoints(state.attributes);
  savePlayerData(session.grudgeId, buildSavePayload());
}

function onEquipItem() {
  equipItem(state.equipment, item);
  savePlayerData(session.grudgeId, buildSavePayload());
}

function onHarvest() {
  performHarvest(profId, nodeTier, state.professions);
  // Batch harvests — don't save every single one
  state.dirtySave = true;
}

// Periodic save for batched changes
setInterval(() => {
  if (state.dirtySave) {
    savePlayerData(session.grudgeId, buildSavePayload());
    state.dirtySave = false;
  }
}, 30_000); // every 30s
```

## ObjectStore: Adding New Game Data

To add new data types to ObjectStore for your game:

1. Add JSON files to the ObjectStore repo under `/api/v1/`
2. Follow the existing naming convention: `camelCase.json`
3. Always include a `version` field for cache busting
4. Add TypeScript interfaces in your game's `grudge-api.ts`

```json
// Example: /api/v1/myNewData.json
{
  "version": "1.0.0",
  "items": [...]
}
```

```typescript
// In grudge-api.ts
export interface OSMyNewData {
  version: string;
  items: OSMyNewItem[];
}

// Add to the api singleton
async getMyNewData(): Promise<OSMyNewData> {
  return fetchCached('/api/v1/myNewData.json');
}
```

## Checklist for New Game Integration

- [ ] Copy `grudge-api.ts` as your ObjectStore client (or import from shared package)
- [ ] Set up typed interfaces for every ObjectStore endpoint you use
- [ ] Implement in-memory caching (5 min TTL recommended)
- [ ] Provide bundled fallback defaults for offline play
- [ ] Fetch all game data at init, not per frame
- [ ] Integrate Discord/Web3Auth via Grudge Backend for player identity
- [ ] Use localStorage as primary save with backend sync
- [ ] Batch saves — don't hit the backend on every minor change
- [ ] Save on meaningful events (level up, equip, craft completion)
- [ ] Add periodic background sync (30s interval recommended)
- [ ] Handle auth token refresh and expiry gracefully
- [ ] Test offline mode — game must be playable without backend

## Domain Map

| Domain | Purpose |
|--------|---------|
| `molochdagod.github.io/ObjectStore` | Static game data API |
| `grudge-studio.com` | Backend services (Cloudflare DNS) |
| `api.grudge-studio.com` | REST API, auth, player data |
| `dash.grudge-studio.com` | Dashboard, admin tools |
| `grudgewarlords.com` | Game frontend |
| `dungeon-crawler-quest.vercel.app` | This game (Vercel) |

## Puter Cloud Services

Puter.js adds a **serverless cloud layer** that supplements the Grudge backend. No API keys required — costs are handled by the user's Puter account ("User-Pays" model).

### Setup

Add the CDN script to your HTML (or `npm install @heyputer/puter.js`):

```html
<script src="https://js.puter.com/v2/"></script>
```

Import the wrapper module:

```typescript
import {
  generateNPCDialogue,
  syncPlayerToCloud,
  loadPlayerFromCloud,
  puterSignIn,
  puterFetch,
} from '@/game/puter-cloud';
```

### AI — NPC Dialogue & Lore Generation

Puter provides free access to 200+ AI models (GPT-5, Claude, Gemini, DeepSeek, etc.) with zero API key setup.

```typescript
// Dynamic NPC dialogue
const line = await generateNPCDialogue(
  'Grimjaw',
  'blacksmith in a besieged fortress',
  'Player just defeated the Piglin warlord',
);

// Lore generation for items, zones, quests
import { generateLore } from '@/game/puter-cloud';
const lore = await generateLore('The Cursed Blade of Fabled Island', 60);

// Voxel prompt generation for text-to-3D
import { generateVoxelPrompt } from '@/game/puter-cloud';
const prompt = await generateVoxelPrompt('undead pirate captain with glowing eyes');
```

### KV Store — NoSQL Cloud Persistence

Use alongside localStorage for cloud-backed saves. No database setup needed.

```typescript
// Save all RPG systems to cloud (call every 30s or on events)
await syncPlayerToCloud({
  attributes: state.attributes,
  equipment: state.equipment,
  professions: state.professions,
  resources: state.resources,
});

// Load from cloud at game init
const cloudSave = await loadPlayerFromCloud();
if (cloudSave) {
  applyCloudSave(cloudSave);
}

// Simple key-value ops
import { kvSave, kvLoad, kvIncrement } from '@/game/puter-cloud';
await kvSave('player_settings', { musicVolume: 0.5 });
const settings = await kvLoad<{ musicVolume: number }>('player_settings');
await kvIncrement('total_kills', 1);
```

### Cloud Storage — Save Files & Replays

```typescript
import { cloudSaveFile, cloudLoadFile } from '@/game/puter-cloud';

await cloudSaveFile('save_slot_1.json', JSON.stringify(gameState));
const saved = await cloudLoadFile('save_slot_1.json');
```

### Auth — Puter Identity

```typescript
// Sign in with Puter (can layer on top of Discord/Web3Auth)
const user = await puterSignIn();
console.log(user.username, user.uuid);
```

### CORS-Free Networking

Fetch ObjectStore or external APIs without CORS issues:

```typescript
const resp = await puterFetch('https://molochdagod.github.io/ObjectStore/api/v1/weapons.json');
const data = await resp.json();
```

### Static Hosting — Deploy to *.puter.site

```typescript
import { deployToSite } from '@/game/puter-cloud';
const url = await deployToSite('grudge-warlords', 'grudge-warlords/dist');
// → https://grudge-warlords.puter.site
```

### Recommended Architecture Stack

```
┌─────────────────────────────────────────────────────────────┐
│  Game Client (Three.js / Vite / TypeScript)                 │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│ ObjectStore │ Grudge       │ Puter Cloud  │ Vercel          │
│ (Game Data) │ Backend      │ (AI + KV +   │ (Primary        │
│ Static JSON │ (Auth +      │  Storage)    │  Hosting)       │
│ GitHub Pages│  Persistence)│ No API keys  │ Auto-deploy     │
│ Read-only   │ grudge-studio│ User-pays    │ CDN + Edge      │
└─────────────┴──────────────┴──────────────┴─────────────────┘
```

**When to use each:**

- **ObjectStore** — Static game definitions (weapons, skills, attributes, professions)
- **Grudge Backend** — Player identity (Discord/Web3Auth), authoritative saves, multiplayer
- **Puter Cloud** — AI features (NPC dialogue, lore), cloud KV backup saves, CORS-free fetch, quick static hosting
- **Vercel** — Primary game hosting, auto-deploy from GitHub, edge CDN

### Best Practices

1. **Local-first, cloud-sync**: Always save to localStorage first, then sync to both Grudge backend and Puter KV
2. **AI is supplementary**: All AI features must have static fallbacks — game works without Puter
3. **Batch cloud operations**: Don't call `syncPlayerToCloud()` every frame — use 30s intervals or meaningful events
4. **Check availability**: Use `isPuterAvailable()` before any Puter call
5. **Use the right AI model**: `gpt-4.1-nano` for quick NPC barks, `claude-sonnet-4-6` for lore, `o4-mini` for complex logic
