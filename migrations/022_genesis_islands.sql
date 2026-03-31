-- ═══════════════════════════════════════════════════════════════
-- Genesis Islands — Persistent Instanced Zones
-- Migration: 022_genesis_islands.sql
--
-- Follows Albion Online's island model:
--   - Each player gets one personal island (on character creation)
--   - Each guild gets one guild island (on guild creation)
--   - Islands are persistent — survive logout, never deleted
--   - Upgradeable (levels 1-6, costs silver)
--   - Access rights: owner, co-owner, builder, visitor, denied
--   - PvP mode configurable per island
--   - Custom structures stored as JSON
--
-- Route: /genesis/:instance_id
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS genesis_islands (
  -- Primary key: UUID instance ID (used in URL /genesis/:instance_id)
  instance_id       VARCHAR(36) NOT NULL PRIMARY KEY,

  -- Ownership
  owner_grudge_id   VARCHAR(36) NOT NULL,          -- grudge_id of the player who created it
  owner_char_id     INT DEFAULT NULL,              -- character ID (for personal islands)
  guild_id          INT DEFAULT NULL,              -- guild ID (NULL = personal island)
  island_name       VARCHAR(64) NOT NULL DEFAULT 'Genesis Island',

  -- Type
  island_type       ENUM('personal', 'guild') NOT NULL DEFAULT 'personal',

  -- Upgrade level (1-6, higher = more build plots + features)
  upgrade_level     TINYINT NOT NULL DEFAULT 1,

  -- PvP configuration
  pvp_mode          ENUM('pve', 'guild_pvp', 'open_pvp', 'arena_only') NOT NULL DEFAULT 'pve',
  is_public         BOOLEAN NOT NULL DEFAULT FALSE,    -- can strangers sail to it?

  -- PvP event lobby
  pvp_lobby_code    VARCHAR(8) DEFAULT NULL,           -- GRD-XXXX format when hosting event
  pvp_lobby_mode    VARCHAR(16) DEFAULT NULL,          -- duel, crew_battle, arena_ffa

  -- Max players (scales with upgrade level)
  max_players       INT NOT NULL DEFAULT 10,

  -- Custom structures placed by owner/guild (JSON array)
  -- Each entry: { id, assetId, x, y, rotation, placedBy, placedAt }
  custom_structures JSON DEFAULT '[]',

  -- Island state (harvestables, resource nodes, etc.)
  island_state      JSON DEFAULT '{}',

  -- Timestamps
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_visited_at   TIMESTAMP DEFAULT NULL,

  -- Indexes
  INDEX idx_owner (owner_grudge_id),
  INDEX idx_guild (guild_id),
  INDEX idx_public (is_public),
  INDEX idx_lobby (pvp_lobby_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ═══════════════════════════════════════════════════════════════
-- Island Access Rights (Albion-style role-based access)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS genesis_island_access (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  instance_id       VARCHAR(36) NOT NULL,
  -- Who has access (one of these is set)
  grudge_id         VARCHAR(36) DEFAULT NULL,      -- specific player
  guild_id          INT DEFAULT NULL,              -- entire guild
  -- Access role
  access_role       ENUM('owner', 'co_owner', 'builder', 'visitor', 'denied') NOT NULL DEFAULT 'visitor',
  -- Timestamps
  granted_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by        VARCHAR(36) NOT NULL,          -- who granted this access

  INDEX idx_instance (instance_id),
  INDEX idx_player (grudge_id),
  INDEX idx_guild_access (guild_id),
  FOREIGN KEY (instance_id) REFERENCES genesis_islands(instance_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ═══════════════════════════════════════════════════════════════
-- Island Upgrade Costs (silver, matches Albion's tier system)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS genesis_island_upgrades (
  upgrade_level     TINYINT NOT NULL PRIMARY KEY,
  island_type       ENUM('personal', 'guild') NOT NULL,
  silver_cost       BIGINT NOT NULL,
  build_plots       INT NOT NULL,
  small_plots       INT NOT NULL,
  max_players       INT NOT NULL,
  features          VARCHAR(255) DEFAULT NULL,      -- comma-separated feature unlocks

  UNIQUE KEY uk_level_type (upgrade_level, island_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed upgrade tiers (personal islands)
INSERT IGNORE INTO genesis_island_upgrades (upgrade_level, island_type, silver_cost, build_plots, small_plots, max_players, features) VALUES
  (1, 'personal',   1000,  1, 0, 10, 'storage_chest'),
  (2, 'personal',   5000,  3, 2, 15, 'crafting_bench'),
  (3, 'personal',  15000,  5, 2, 20, 'marketplace'),
  (4, 'personal',  40000,  7, 2, 25, 'harbor_upgrade'),
  (5, 'personal', 100000, 10, 2, 30, 'defense_towers'),
  (6, 'personal', 250000, 14, 2, 40, 'arena,guild_hall');

-- Seed upgrade tiers (guild islands)
INSERT IGNORE INTO genesis_island_upgrades (upgrade_level, island_type, silver_cost, build_plots, small_plots, max_players, features) VALUES
  (1, 'guild',    5000,  4, 0, 20, 'guild_bank'),
  (2, 'guild',   15000,  7, 2, 30, 'marketplace'),
  (3, 'guild',   40000, 10, 2, 40, 'defense_towers'),
  (4, 'guild',  100000, 13, 2, 50, 'harbor_upgrade'),
  (5, 'guild',  250000, 16, 2, 75, 'siege_weapons'),
  (6, 'guild',  500000, 20, 2, 100, 'arena,guild_stadium');

-- ═══════════════════════════════════════════════════════════════
-- Add genesis_island_id column to characters table
-- Each character is linked to their personal island
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS genesis_island_id VARCHAR(36) DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_genesis (genesis_island_id);

-- ═══════════════════════════════════════════════════════════════
-- Add genesis_island_id column to crews/guilds table
-- Each guild is linked to their guild island
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS genesis_island_id VARCHAR(36) DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_genesis_crew (genesis_island_id);
