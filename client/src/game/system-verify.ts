/**
 * System Verification & Schema Validation
 *
 * Best practices enforcement for the entire Grudge Studio ecosystem.
 * Validates:
 *   1. Character data schema integrity
 *   2. Sync payload completeness
 *   3. Backend connectivity
 *   4. ObjectStore API availability
 *   5. cNFT mint status
 *   6. localStorage consistency
 *   7. Cross-mode data coherence
 *
 * Call `runFullSystemCheck()` from the admin panel or on game boot
 * (dev mode only) to surface issues before they hit production.
 */

import type { PlayerCharacterState } from './player-characters';
import type { PlayerAttributes } from './attributes';
import type { PlayerProfessions, ResourceInventory } from './professions-system';
import type { PlayerEquipment, EquipmentBag } from './equipment';
import type { MissionLog } from './missions';
import type { PlayerProgress } from './player-progress';
import {
  getActiveSnapshot, getCharacterList, buildSyncPayload,
  type CharacterSnapshot, type GrudgeSyncPayload, type CharacterListEntry,
} from './shared-character-state';
import { getCurrentCharacter } from './player-account';
import { HEROES } from './types';

// ── Check Result Types ─────────────────────────────────────────

export type CheckSeverity = 'pass' | 'warn' | 'fail' | 'skip';

export interface CheckResult {
  name: string;
  severity: CheckSeverity;
  message: string;
  details?: string;
}

export interface SystemReport {
  timestamp: string;
  checks: CheckResult[];
  passCount: number;
  warnCount: number;
  failCount: number;
  skipCount: number;
}

// ── Schema Validators ──────────────────────────────────────────

function validateCharacterSchema(char: PlayerCharacterState | null): CheckResult[] {
  const results: CheckResult[] = [];
  const name = 'schema.character';

  if (!char) {
    results.push({ name, severity: 'skip', message: 'No character loaded' });
    return results;
  }

  // Required string fields
  const requiredStrings: (keyof PlayerCharacterState)[] = [
    'grudgeId', 'accountId', 'customName', 'race', 'heroClass', 'faction',
  ];
  for (const field of requiredStrings) {
    const val = char[field];
    if (!val || typeof val !== 'string' || (val as string).trim() === '') {
      results.push({ name: `${name}.${field}`, severity: 'fail', message: `Missing or empty: ${field}`, details: `Value: ${JSON.stringify(val)}` });
    }
  }

  // grudgeId format
  if (char.grudgeId && !char.grudgeId.startsWith('CHAR-')) {
    results.push({ name: `${name}.grudgeId`, severity: 'warn', message: `Non-standard grudgeId format: ${char.grudgeId}`, details: 'Expected: CHAR-xxx' });
  }

  // Valid race
  const validRaces = ['Human', 'Barbarian', 'Dwarf', 'Elf', 'Orc', 'Undead'];
  if (!validRaces.includes(char.race)) {
    results.push({ name: `${name}.race`, severity: 'fail', message: `Invalid race: ${char.race}` });
  }

  // Valid class
  const validClasses = ['Warrior', 'Mage', 'Ranger', 'Worg'];
  if (!validClasses.includes(char.heroClass)) {
    results.push({ name: `${name}.heroClass`, severity: 'fail', message: `Invalid class: ${char.heroClass}` });
  }

  // Valid faction
  const validFactions = ['Crusade', 'Fabled', 'Legion', 'Pirates'];
  if (!validFactions.includes(char.faction)) {
    results.push({ name: `${name}.faction`, severity: 'warn', message: `Non-standard faction: ${char.faction}` });
  }

  // Level
  if (typeof char.level !== 'number' || char.level < 1 || char.level > 100) {
    results.push({ name: `${name}.level`, severity: 'warn', message: `Unusual level: ${char.level}` });
  }

  if (results.length === 0) {
    results.push({ name, severity: 'pass', message: 'Character schema valid' });
  }
  return results;
}

function validateAttributes(attrs: PlayerAttributes | undefined): CheckResult[] {
  const name = 'schema.attributes';
  if (!attrs) return [{ name, severity: 'skip', message: 'No attributes loaded' }];

  const results: CheckResult[] = [];
  const expectedAttrs = ['strength', 'dexterity', 'intelligence', 'wisdom', 'vitality', 'endurance', 'agility', 'luck'];

  for (const a of expectedAttrs) {
    const val = (attrs.base as any)?.[a];
    if (val === undefined || typeof val !== 'number') {
      results.push({ name: `${name}.${a}`, severity: 'fail', message: `Missing attribute: ${a}` });
    } else if (val < 0 || val > 200) {
      results.push({ name: `${name}.${a}`, severity: 'warn', message: `Unusual value for ${a}: ${val}` });
    }
  }

  if (typeof attrs.unspentPoints !== 'number') {
    results.push({ name: `${name}.unspentPoints`, severity: 'fail', message: 'Missing unspentPoints' });
  }

  if (results.length === 0) {
    results.push({ name, severity: 'pass', message: 'Attributes schema valid' });
  }
  return results;
}

function validateEquipment(equip: PlayerEquipment | undefined): CheckResult[] {
  const name = 'schema.equipment';
  if (!equip) return [{ name, severity: 'skip', message: 'No equipment loaded' }];

  const results: CheckResult[] = [];
  const expectedSlots = ['head', 'chest', 'legs', 'feet', 'hands', 'weapon', 'offhand', 'cape'];

  for (const slot of expectedSlots) {
    if (!(slot in equip)) {
      results.push({ name: `${name}.${slot}`, severity: 'warn', message: `Missing slot: ${slot}` });
    }
  }

  if (results.length === 0) {
    results.push({ name, severity: 'pass', message: 'Equipment schema valid' });
  }
  return results;
}

function validateProfessions(profs: PlayerProfessions | undefined): CheckResult[] {
  const name = 'schema.professions';
  if (!profs) return [{ name, severity: 'skip', message: 'No professions loaded' }];

  const results: CheckResult[] = [];
  if (!profs.gathering || typeof profs.gathering !== 'object') {
    results.push({ name: `${name}.gathering`, severity: 'fail', message: 'Missing gathering professions' });
  }

  if (results.length === 0) {
    results.push({ name, severity: 'pass', message: 'Professions schema valid' });
  }
  return results;
}

// ── Sync Payload Validation ────────────────────────────────────

function validateSyncPayload(): CheckResult[] {
  const name = 'sync.payload';
  const payload = buildSyncPayload();

  if (!payload) {
    return [{ name, severity: 'skip', message: 'No active snapshot to build payload from' }];
  }

  const results: CheckResult[] = [];

  if (!payload.grudgeId) results.push({ name: `${name}.grudgeId`, severity: 'fail', message: 'Payload missing grudgeId' });
  if (!payload.accountId) results.push({ name: `${name}.accountId`, severity: 'fail', message: 'Payload missing accountId' });
  if (!payload.lastModified) results.push({ name: `${name}.lastModified`, severity: 'fail', message: 'Payload missing timestamp' });
  if (!payload.character) results.push({ name: `${name}.character`, severity: 'fail', message: 'Payload missing character' });
  if (!payload.attributes) results.push({ name: `${name}.attributes`, severity: 'fail', message: 'Payload missing attributes' });
  if (!payload.professions) results.push({ name: `${name}.professions`, severity: 'fail', message: 'Payload missing professions' });
  if (!payload.equipment) results.push({ name: `${name}.equipment`, severity: 'fail', message: 'Payload missing equipment' });

  // Validate timestamp is valid ISO
  if (payload.lastModified) {
    const d = new Date(payload.lastModified);
    if (isNaN(d.getTime())) {
      results.push({ name: `${name}.lastModified`, severity: 'fail', message: 'Invalid ISO timestamp' });
    }
  }

  if (results.length === 0) {
    results.push({ name, severity: 'pass', message: 'Sync payload complete and valid' });
  }
  return results;
}

// ── localStorage Consistency ───────────────────────────────────

function validateLocalStorage(): CheckResult[] {
  const results: CheckResult[] = [];
  const name = 'localStorage';

  const keysToCheck = [
    'grudge_player_character',
    'grudge_hero_id',
    'grudge_custom_hero',
  ];

  for (const key of keysToCheck) {
    const val = localStorage.getItem(key);
    if (!val) {
      results.push({ name: `${name}.${key}`, severity: 'warn', message: `Key not set: ${key}` });
    } else {
      // Try to parse JSON keys
      if (key !== 'grudge_hero_id') {
        try { JSON.parse(val); }
        catch { results.push({ name: `${name}.${key}`, severity: 'fail', message: `Corrupt JSON in ${key}` }); }
      }
    }
  }

  // Cross-check: hero_id should match custom_hero.id
  const heroId = localStorage.getItem('grudge_hero_id');
  const customHero = localStorage.getItem('grudge_custom_hero');
  if (heroId && customHero) {
    try {
      const parsed = JSON.parse(customHero);
      if (String(parsed.id) !== heroId) {
        results.push({
          name: `${name}.id_mismatch`,
          severity: 'fail',
          message: `hero_id (${heroId}) doesn't match custom_hero.id (${parsed.id})`,
        });
      }
    } catch {}
  }

  // Check HEROES[] contains the player character
  if (heroId) {
    const numId = parseInt(heroId, 10);
    const found = HEROES.find(h => h.id === numId);
    if (!found) {
      results.push({ name: `${name}.heroes_missing`, severity: 'warn', message: `Hero ID ${numId} not in HEROES[]` });
    } else if (found.isAINpc !== false) {
      results.push({ name: `${name}.heroes_npc`, severity: 'warn', message: `Hero ${numId} marked as AI NPC, should be player character` });
    }
  }

  if (results.filter(r => r.severity === 'fail').length === 0) {
    results.push({ name, severity: 'pass', message: 'localStorage consistent' });
  }
  return results;
}

// ── Character List Integrity ───────────────────────────────────

function validateCharacterList(): CheckResult[] {
  const results: CheckResult[] = [];
  const name = 'charList';
  const list = getCharacterList();

  if (list.length === 0) {
    return [{ name, severity: 'warn', message: 'No characters in list' }];
  }

  // Check for duplicates
  const ids = new Set<string>();
  for (const entry of list) {
    if (ids.has(entry.grudgeId)) {
      results.push({ name: `${name}.duplicate`, severity: 'fail', message: `Duplicate grudgeId: ${entry.grudgeId}` });
    }
    ids.add(entry.grudgeId);

    if (!entry.customName || !entry.race || !entry.heroClass) {
      results.push({ name: `${name}.incomplete`, severity: 'warn', message: `Incomplete entry: ${entry.grudgeId}` });
    }
  }

  results.push({ name, severity: 'pass', message: `${list.length} character(s) in list` });
  return results;
}

// ── API Connectivity Checks ────────────────────────────────────

async function checkBackendConnectivity(): Promise<CheckResult> {
  try {
    const resp = await fetch('/api/heroes', { signal: AbortSignal.timeout(5000) });
    if (resp.ok) return { name: 'api.backend', severity: 'pass', message: 'Backend API reachable' };
    return { name: 'api.backend', severity: 'warn', message: `Backend responded ${resp.status}` };
  } catch {
    return { name: 'api.backend', severity: 'warn', message: 'Backend API unreachable (offline mode active)' };
  }
}

async function checkObjectStoreConnectivity(): Promise<CheckResult> {
  try {
    const resp = await fetch('https://molochdagod.github.io/ObjectStore/api/v1/attributes.json', { signal: AbortSignal.timeout(5000) });
    if (resp.ok) return { name: 'api.objectStore', severity: 'pass', message: 'ObjectStore API reachable' };
    return { name: 'api.objectStore', severity: 'warn', message: `ObjectStore responded ${resp.status}` };
  } catch {
    return { name: 'api.objectStore', severity: 'warn', message: 'ObjectStore unreachable (using bundled fallbacks)' };
  }
}

async function checkCrossmintConnectivity(): Promise<CheckResult> {
  try {
    const resp = await fetch('/api/mint-status/test', { signal: AbortSignal.timeout(5000) });
    // Even a 400 means our API route is working
    if (resp.status < 500) return { name: 'api.crossmint', severity: 'pass', message: 'Mint API route reachable' };
    return { name: 'api.crossmint', severity: 'warn', message: `Mint API responded ${resp.status}` };
  } catch {
    return { name: 'api.crossmint', severity: 'warn', message: 'Mint API unreachable (cNFT minting disabled)' };
  }
}

// ── cNFT Verification ──────────────────────────────────────────

function checkCNFTStatus(): CheckResult[] {
  const results: CheckResult[] = [];
  const name = 'cnft';
  const list = getCharacterList();

  const minted = list.filter(c => c.mintAddress);
  const unminted = list.filter(c => !c.mintAddress);

  if (list.length === 0) {
    return [{ name, severity: 'skip', message: 'No characters to check' }];
  }

  results.push({ name: `${name}.minted`, severity: 'pass', message: `${minted.length}/${list.length} characters have cNFTs` });

  if (unminted.length > 0) {
    results.push({
      name: `${name}.unminted`,
      severity: 'warn',
      message: `${unminted.length} character(s) without cNFT: ${unminted.map(c => c.customName).join(', ')}`,
      details: 'These characters are playable but not minted on-chain',
    });
  }

  return results;
}

// ── Full System Check ──────────────────────────────────────────

/**
 * Run all verification checks and return a structured report.
 * Call from admin panel, dev console, or game boot (dev mode).
 */
export async function runFullSystemCheck(): Promise<SystemReport> {
  const checks: CheckResult[] = [];

  // Schema checks
  const snap = getActiveSnapshot();
  const char = getCurrentCharacter();
  checks.push(...validateCharacterSchema(char));
  checks.push(...validateAttributes(snap?.attributes));
  checks.push(...validateEquipment(snap?.equipment));
  checks.push(...validateProfessions(snap?.professions));

  // Sync payload check
  checks.push(...validateSyncPayload());

  // localStorage consistency
  checks.push(...validateLocalStorage());

  // Character list integrity
  checks.push(...validateCharacterList());

  // cNFT status
  checks.push(...checkCNFTStatus());

  // API connectivity (async)
  checks.push(await checkBackendConnectivity());
  checks.push(await checkObjectStoreConnectivity());
  checks.push(await checkCrossmintConnectivity());

  const report: SystemReport = {
    timestamp: new Date().toISOString(),
    checks,
    passCount: checks.filter(c => c.severity === 'pass').length,
    warnCount: checks.filter(c => c.severity === 'warn').length,
    failCount: checks.filter(c => c.severity === 'fail').length,
    skipCount: checks.filter(c => c.severity === 'skip').length,
  };

  // Log summary
  const icon = report.failCount > 0 ? '❌' : report.warnCount > 0 ? '⚠️' : '✅';
  console.log(`${icon} [SystemCheck] ${report.passCount} pass, ${report.warnCount} warn, ${report.failCount} fail, ${report.skipCount} skip`);
  for (const c of checks.filter(r => r.severity === 'fail' || r.severity === 'warn')) {
    console.log(`  ${c.severity === 'fail' ? '❌' : '⚠️'} [${c.name}] ${c.message}`);
  }

  return report;
}

/**
 * Quick health check — returns true if no critical failures.
 * Use as a gate before allowing gameplay.
 */
export async function isSystemHealthy(): Promise<boolean> {
  const report = await runFullSystemCheck();
  return report.failCount === 0;
}
