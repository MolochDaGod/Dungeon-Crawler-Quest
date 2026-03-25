# Grudge Warlords Ecosystem — Character & Account Sync

## One Truth: api.grudge-studio.com

Every app in the Grudge ecosystem syncs character data through one backend:

```
api.grudge-studio.com/api/characters/:grudgeId/sync
```

All apps read/write the same `GrudgeSyncPayload` shape (defined in `shared-character-state.ts`).

---

## Apps That Need Sync

### Tier 1: Game Modes (same character plays here)

| App | Repo Path | Deploy URL | What It Syncs |
|-----|-----------|------------|---------------|
| **Open World MMO** | `D:\Dungeon-Crawler-Quest` | grudgewarlords.com/open-world-play | All: stats, equipment, professions, missions, progress |
| **MOBA Arena** | `D:\Dungeon-Crawler-Quest` | grudgewarlords.com/game | Stats, equipment, abilities (applied at match start) |
| **Island Harvesting** | `D:\Dungeon-Crawler-Quest` | grudgewarlords.com/island | Professions, resources, deployed characters |
| **Gruda Wars** (2D RPG) | `D:\grudge-studio-src/apps/battle-arena-client` | grudge-warlords-game.vercel.app | Stats, equipment, abilities, progression unlocks |
| **Crafting Suite** | `D:\GrudgeStudio\Warlord-Crafting-Suite` | warlord-crafting-suite.vercel.app | Professions, resources, recipes, equipment bag |

### Tier 2: Character Management (creates/edits characters)

| App | Repo Path | Deploy URL | What It Syncs |
|-----|-----------|------------|---------------|
| **Character Builder** | `D:\Grudge-Builder` | grudge-builder.vercel.app | Character creation, cNFT minting, Crossmint, model/race/class |
| **Character Page** | `D:\Dungeon-Crawler-Quest` | grudgewarlords.com/character | Equipment, attributes, skills (read + edit) |
| **Create Character** | `D:\Dungeon-Crawler-Quest` | grudgewarlords.com/create-character | New character → saved to backend → minted as cNFT |

### Tier 3: Platform Services (reads character data)

| App | Repo Path | Deploy URL | What It Syncs |
|-----|-----------|------------|---------------|
| **Grudge Backend** | `D:\GrudgeStudio\grudge-studio-backend` | api.grudge-studio.com | Authoritative store. All other apps sync TO here. |
| **Studio Dashboard** | `D:\Temp\favicon-fixes\grudge-studio-dash` | dash.grudge-studio.com | Reads all character data for admin views |
| **ObjectStore** | `D:\ObjectStore` | molochdagod.github.io/ObjectStore | Static game data (weapons, skills, professions). Read-only. |
| **AI Hub** | `D:\GrudgeStudio\ai` | ai.grudge-studio.com | Reads character data for AI agent decisions |
| **Factions Site** | `D:\Temp\favicon-fixes\grudge-factions-site` | Reads faction membership, character counts |

### Tier 4: Future / Planned

| App | Repo Path | What It Will Sync |
|-----|-----------|-------------------|
| **Space RTS** | `D:\GrudgeSpaceRTS` | Character deployment as commanders |
| **3D MMO** | `D:\Desktop\3dmmogrudge` | Full character state (3D version of DCQ) |
| **Legion SDK** | `D:\gruda-legion-sdk` | AI NPC behavior driven by player character data |

---

## Sync Contract

### Data Shape: `GrudgeSyncPayload`

```typescript
interface GrudgeSyncPayload {
  grudgeId: string;          // Unique character ID (CHAR-xxx)
  accountId: string;         // Player account (puter ID / wallet)
  lastModified: string;      // ISO timestamp
  character: PlayerCharacterState;  // Identity, race, class, faction, model
  attributes: PlayerAttributes;     // 8 attributes + unspent points
  professions: PlayerProfessions;   // Gathering + crafting levels/XP
  resources: ResourceInventory;     // Harvested materials
  equipment: PlayerEquipment;       // 8 equipped slots
  bag: EquipmentBag;               // Inventory items
  missions: MissionLog;            // Active + completed quests
  progress: PlayerProgress;        // Zone discovery, kills, rep, playtime
}
```

### Sync Endpoints

```
POST   /api/characters/:grudgeId/sync   — Push full state from any app
GET    /api/characters/:grudgeId/sync    — Pull latest state to any app
GET    /api/characters?account=:id       — List all characters for account
POST   /api/characters                   — Create new character
DELETE /api/characters/:grudgeId         — Delete character
```

### Conflict Resolution

- Each sub-system has its own `lastModified` timestamp
- Backend uses "latest write wins" per sub-system
- If `professions.lastModified` from app A is newer than stored, app A's professions win
- Equipment, attributes, and missions are atomic — full replace per sync

### localStorage Keys (per character)

| Key | Content |
|-----|---------|
| `grudge_player_character` | `PlayerCharacterState` |
| `grudge_player_attributes` | `PlayerAttributes` |
| `grudge_player_professions` | `PlayerProfessions` |
| `grudge_resource_inventory` | `ResourceInventory` |
| `grudge_player_equipment` | `PlayerEquipment` |
| `grudge_equipment_bag` | `EquipmentBag` |
| `grudge_mission_log` | `MissionLog` |
| `grudge_zone_progress` | `PlayerProgress` |
| `grudge_character_list` | `CharacterListEntry[]` |
| `grudge_hero_id` | Legacy hero ID (number) |
| `grudge_custom_hero` | Legacy HeroData JSON |

---

## How Each App Should Import

### For apps inside Dungeon-Crawler-Quest (same repo):

```typescript
import {
  initSharedCharacterState,
  getActiveSnapshot,
  saveCharacterSnapshot,
  buildSyncPayload,
} from '@/game/shared-character-state';

// At app boot:
const snap = await initSharedCharacterState();

// During gameplay — read:
const { attributes, equipment, professions } = getActiveSnapshot()!;

// On save / exit:
await saveCharacterSnapshot(getActiveSnapshot()!);
```

### For external apps (Gruda Wars, Crafting Suite, Builder):

```typescript
// 1. Read the sync contract shape from the backend
const resp = await fetch('https://api.grudge-studio.com/api/characters/CHAR-xxx/sync', {
  headers: { Authorization: `Bearer ${token}` },
});
const payload: GrudgeSyncPayload = await resp.json();

// 2. Use payload.attributes, payload.equipment, etc.

// 3. After changes, push back:
await fetch('https://api.grudge-studio.com/api/characters/CHAR-xxx/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(updatedPayload),
});
```

---

## Character Creation Gating (Gruda Wars)

| Unlock | Requirement |
|--------|-------------|
| 1st character | Free — created at first play |
| 2nd character | Win 1 fight in Gruda Wars |
| 3rd character | Win 2 fights in Gruda Wars |
| 4th+ character | Kill a boss OR 100% a node |

All characters are minted as cNFTs via Crossmint through the Grudge Builder.
Each character gets a UUID used across all apps.

---

## Camp System (unlocks at level 5 in Gruda Wars)

When a character hits level 5 in Gruda Wars, a popup triggers:

> "Come quick to camp! It's time to set up camp."
> [Go Now] [Later]

Camp nodes (available from the Gruda Wars scene graph):

| Node | What It Opens |
|------|---------------|
| **Rest** | Heal, save progress, day/night cycle |
| **Auction** | gBux-denominated item + character auction house |
| **Crafting** | Opens crafting UI with character/profession selector |
| **Island** | Deploy character to island (play or auto-harvest) |
| **Arena** | Register team for async AI PvP + Discord webhooks |
| **Treaty Mail** | In-game mail for item transfers |
| **Challenge** | Quest info, campaign status, daily objectives |

Each camp node reads from and writes to the same `GrudgeSyncPayload`.
