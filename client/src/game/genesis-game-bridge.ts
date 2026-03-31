/**
 * Genesis Game Bridge
 *
 * Connects ALL existing game systems to the BabylonJS 3D scene:
 *   - CharacterData (stats, equipment, attributes, professions, missions)
 *   - Combat machine (xstate FSM)
 *   - Skill trees + weapon skills
 *   - Professions + harvesting
 *   - Crafting + recipes
 *   - Resource nodes
 *   - Equipment model swapping
 *
 * This is the single source of truth for game state in the 3D world.
 * The 3D scene reads from this bridge, UI overlays read from this bridge,
 * and player actions flow through this bridge into the existing systems.
 */

import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { Observable } from "@babylonjs/core/Misc/observable";

// ── Existing game systems ──────────────────────────────────────
import { loadCharacterData, CharacterData } from "./character-data";
import { loadEquipment, equipItem, unequipSlot, PlayerEquipment, EquipmentInstance, EquipSlot, computeEquipmentStats, computeSetBonuses, saveEquipment } from "./equipment";
import { loadAttributes, saveAttributes, allocatePoint, PlayerAttributes, AttributeId, computeDerivedStats, DerivedStats, getAttributeSummary } from "./attributes";
import { loadProfessions, saveProfessions, performHarvest, PlayerProfessions, gainProfessionXp, HarvestResult } from "./professions-system";
import { loadResourceInventory, saveResourceInventory, addResource, ResourceInventory } from "./professions-system";
import { SKILL_TREES, ClassSkillTree, MobaSkillLoadout, createDefaultMobaLoadout } from "./skill-trees";
import { buildWeaponLoadout, getAbilitiesWithWeapon, WeaponSkillLoadout, saveLoadout } from "./weapon-skills";
import { AbilityDef, CLASS_ABILITIES } from "./types";
import { ALL_RESOURCE_NODES, ResourceNodeDef, ResourceNodeInstance, createNodeInstance, hitResourceNode, updateNodeRespawns, NodeHarvestResult, getNodesForBiome } from "./resource-nodes";
import { CraftingRecipe, QUICK_CRAFT_ITEMS, QuickCraftItem } from "./crafting";
import { combatMachine, CombatEvent, CombatContext, CombatVFX } from "./combat-machine";
import { loadPlayerProgress, savePlayerProgress, PlayerProgress } from "./player-progress";
import { createActor } from "xstate";

// ── Events emitted by the bridge ───────────────────────────────

export interface BridgeEvents {
  /** Player stats changed (HP/MP/stamina/gold/level) */
  onStatsChanged: Observable<CharacterSnapshot>;
  /** Equipment changed — includes new weapon GLB path if weapon swapped */
  onEquipmentChanged: Observable<{ slot: EquipSlot; item: EquipmentInstance | null; weaponGlb: string | null }>;
  /** Ability was used — includes slot index, ability def, and VFX data */
  onAbilityUsed: Observable<{ slotIndex: number; ability: AbilityDef; vfx: CombatVFX[] }>;
  /** Harvest result — resource gained, XP, gear drop */
  onHarvest: Observable<{ nodeId: string; result: HarvestResult; nodeDepleted: boolean }>;
  /** Crafting complete */
  onCraftComplete: Observable<{ recipe: CraftingRecipe | QuickCraftItem; success: boolean }>;
  /** Combat state changed */
  onCombatStateChanged: Observable<{ state: string; animState: string; comboCount: number }>;
  /** Resource node state changed (depleted / respawned) */
  onNodeStateChanged: Observable<{ nodeId: string; depleted: boolean }>;
  /** Level up */
  onLevelUp: Observable<{ newLevel: number; unspentPoints: number }>;
  /** Interaction prompt (NPC, crafting station, etc) */
  onInteractionPrompt: Observable<{ type: string; name: string; worldPos: Vector3 } | null>;
}

// ── Snapshot for UI ────────────────────────────────────────────

export interface CharacterSnapshot {
  name: string;
  race: string;
  heroClass: string;
  level: number;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  stamina: number; maxStamina: number;
  atk: number; def: number; spd: number;
  gold: number;
  xp: number; xpToNext: number;
}

export interface HotbarSlot {
  index: number;
  key: string;           // '1','2','3','4','F','R' or '6','7','8'
  ability: AbilityDef | null;
  iconUrl: string | null;
  cooldownRemaining: number;
  cooldownTotal: number;
  isConsumable: boolean;
}

// ── Weapon → GLB mapping ───────────────────────────────────────

const WEAPON_GLB_MAP: Record<string, string> = {
  swords: "/assets/grudge-legacy/weapon/sword.glb",
  axes1h: "/assets/grudge-legacy/weapon/axe.glb",
  daggers: "/assets/grudge-legacy/weapon/dagger.glb",
  hammers: "/assets/grudge-legacy/weapon/hammer.glb",
  spears: "/assets/grudge-legacy/weapon/spear.glb",
  bows: "/assets/grudge-legacy/weapon/bow.glb",
  crossbows: "/assets/grudge-legacy/weapon/bow2.glb",
  maces: "/assets/grudge-legacy/weapon/mace.glb",
  shields: "/assets/grudge-legacy/weapon/shield.glb",
  fireStaves: "/assets/grudge-legacy/weapon/staff.glb",
  frostStaves: "/assets/grudge-legacy/weapon/staff.glb",
  arcaneStaves: "/assets/grudge-legacy/weapon/staff.glb",
  natureStaves: "/assets/grudge-legacy/weapon/staff.glb",
  lightningStaves: "/assets/grudge-legacy/weapon/staff.glb",
  holyStaves: "/assets/grudge-legacy/weapon/staff.glb",
};

// ── Animation → GLB mapping ────────────────────────────────────

const ANIM_GLB_MAP: Record<string, string> = {
  idle: "",  // default pose from character GLB
  block: "/assets/grudge-legacy/animation/block.glb",
  bowshot: "/assets/grudge-legacy/animation/bowshot.glb",
  death: "/assets/grudge-legacy/animation/death.glb",
  gethit: "/assets/grudge-legacy/animation/gethit.glb",
  melee_1h: "/assets/grudge-legacy/animation/melee_1h.glb",
  spellcast: "/assets/grudge-legacy/animation/spellcast.glb",
};

// ── Bridge Class ───────────────────────────────────────────────

export class GenesisGameBridge {
  // State
  private charData: CharacterData;
  private equipment: PlayerEquipment;
  private attributes: PlayerAttributes;
  private derived: DerivedStats;
  private professions: PlayerProfessions;
  private inventory: ResourceInventory;
  private progress: PlayerProgress;
  private weaponLoadout: WeaponSkillLoadout | null = null;
  private mobaLoadout: MobaSkillLoadout;
  private activeAbilities: AbilityDef[] = [];
  private cooldowns: number[] = [0, 0, 0, 0, 0, 0]; // 6 ability slots

  // Combat
  private combatActor;

  // World
  private resourceNodes: Map<string, { def: ResourceNodeDef; instance: ResourceNodeInstance; meshNode?: TransformNode }> = new Map();

  // Runtime
  private currentHp: number;
  private currentMp: number;
  private currentStamina: number;

  // Events
  public events: BridgeEvents;

  constructor(private scene: Scene) {
    // Load all existing game state
    this.charData = loadCharacterData();
    this.equipment = loadEquipment();
    this.attributes = loadAttributes(this.charData.heroClass);
    this.derived = computeDerivedStats(this.attributes);
    this.professions = loadProfessions();
    this.inventory = loadResourceInventory();
    this.progress = loadPlayerProgress();
    this.mobaLoadout = createDefaultMobaLoadout(this.charData.heroRace, this.charData.heroClass);

    // Init runtime stats
    this.currentHp = this.charData.maxHp;
    this.currentMp = this.charData.maxMp;
    this.currentStamina = this.charData.maxStamina;

    // Build abilities from weapon loadout or class defaults
    this.activeAbilities = CLASS_ABILITIES[this.charData.heroClass] || [];

    // Combat FSM
    this.combatActor = createActor(combatMachine);
    this.combatActor.start();

    // Observables
    this.events = {
      onStatsChanged: new Observable(),
      onEquipmentChanged: new Observable(),
      onAbilityUsed: new Observable(),
      onHarvest: new Observable(),
      onCraftComplete: new Observable(),
      onCombatStateChanged: new Observable(),
      onNodeStateChanged: new Observable(),
      onLevelUp: new Observable(),
      onInteractionPrompt: new Observable(),
    };

    console.log(`[Bridge] Initialized: ${this.charData.heroName} (${this.charData.heroRace} ${this.charData.heroClass}) Lv${this.charData.level}`);
  }

  // ── Getters ──────────────────────────────────────────────────

  getSnapshot(): CharacterSnapshot {
    return {
      name: this.charData.heroName,
      race: this.charData.heroRace,
      heroClass: this.charData.heroClass,
      level: this.charData.level,
      hp: this.currentHp, maxHp: this.charData.maxHp,
      mp: this.currentMp, maxMp: this.charData.maxMp,
      stamina: this.currentStamina, maxStamina: this.charData.maxStamina,
      atk: this.charData.atk, def: this.charData.def, spd: this.charData.spd,
      gold: this.charData.gold,
      xp: this.charData.xp, xpToNext: this.charData.xpToNext,
    };
  }

  getCharacterData(): CharacterData { return this.charData; }
  getEquipment(): PlayerEquipment { return this.equipment; }
  getAttributes(): PlayerAttributes { return this.attributes; }
  getDerived(): DerivedStats { return this.derived; }
  getProfessions(): PlayerProfessions { return this.professions; }
  getInventory(): ResourceInventory { return this.inventory; }
  getActiveAbilities(): AbilityDef[] { return this.activeAbilities; }
  getCooldowns(): number[] { return this.cooldowns; }
  getSkillTree(): ClassSkillTree | null { return SKILL_TREES[this.charData.heroClass] || null; }
  getWeaponLoadout(): WeaponSkillLoadout | null { return this.weaponLoadout; }
  getCombatState(): string { return this.combatActor.getSnapshot().value as string; }
  getCombatContext(): CombatContext { return this.combatActor.getSnapshot().context; }

  getWeaponGlb(): string | null {
    const wt = this.equipment.slots.mainhand?.weaponType;
    return wt ? (WEAPON_GLB_MAP[wt] || null) : null;
  }

  getAnimGlb(animName: string): string | null {
    return ANIM_GLB_MAP[animName] || null;
  }

  // ── Hotbar ───────────────────────────────────────────────────

  getHotbar(): HotbarSlot[] {
    const abilities = this.activeAbilities;
    const keys = ['1', '2', '3', '4', 'F', 'R'];
    const slots: HotbarSlot[] = [];

    // Slots 0-5: abilities
    for (let i = 0; i < 6; i++) {
      const ab = abilities[i] || null;
      slots.push({
        index: i,
        key: keys[i],
        ability: ab,
        iconUrl: ab ? `/assets/abilities/${ab.name.toLowerCase().replace(/\s+/g, '_')}.png` : null,
        cooldownRemaining: this.cooldowns[i],
        cooldownTotal: ab?.cooldown || 0,
        isConsumable: false,
      });
    }

    // Slots 6-8: consumables (from inventory)
    for (let i = 6; i <= 8; i++) {
      slots.push({
        index: i,
        key: String(i),
        ability: null,
        iconUrl: null,
        cooldownRemaining: 0,
        cooldownTotal: 0,
        isConsumable: true,
      });
    }

    return slots;
  }

  // ── Actions ──────────────────────────────────────────────────

  /** Use ability at hotbar slot index (0-5) */
  useAbility(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= this.activeAbilities.length) return;
    const ab = this.activeAbilities[slotIndex];
    if (!ab || this.cooldowns[slotIndex] > 0) return;
    if (this.currentMp < ab.manaCost) return;

    this.currentMp -= ab.manaCost;
    this.cooldowns[slotIndex] = ab.cooldown;

    // Send to combat FSM
    const keyMap: Record<number, CombatEvent['type']> = {
      0: 'KEY_1', 1: 'KEY_2', 2: 'KEY_3',
    };
    const event = keyMap[slotIndex];
    if (event) this.combatActor.send({ type: event });

    // Determine animation
    const ctx = this.combatActor.getSnapshot().context;

    this.events.onAbilityUsed.notifyObservers({
      slotIndex,
      ability: ab,
      vfx: ctx.vfxQueue,
    });

    this.events.onStatsChanged.notifyObservers(this.getSnapshot());
  }

  /** Send raw combat event (for mouse/keyboard from 3D controller) */
  sendCombatEvent(event: CombatEvent): void {
    this.combatActor.send(event);
    const ctx = this.combatActor.getSnapshot().context;
    const state = this.combatActor.getSnapshot().value as string;
    this.events.onCombatStateChanged.notifyObservers({
      state,
      animState: ctx.animState,
      comboCount: ctx.comboCount,
    });
  }

  /** Equip an item */
  equip(item: EquipmentInstance): void {
    const result = equipItem(this.equipment, item);
    saveEquipment(this.equipment);

    // Rebuild stats
    this.charData = loadCharacterData();
    this.currentHp = Math.min(this.currentHp, this.charData.maxHp);
    this.currentMp = Math.min(this.currentMp, this.charData.maxMp);

    // Get weapon GLB if weapon changed
    let weaponGlb: string | null = null;
    if (result.weaponChanged && result.newWeaponType) {
      weaponGlb = WEAPON_GLB_MAP[result.newWeaponType] || null;
      // Rebuild weapon skills
      this.rebuildWeaponSkills(result.newWeaponType, result.newWeaponId);
    }

    this.events.onEquipmentChanged.notifyObservers({ slot: item.slot, item, weaponGlb });
    this.events.onStatsChanged.notifyObservers(this.getSnapshot());
  }

  /** Allocate an attribute point */
  allocateAttr(attrId: AttributeId): boolean {
    const ok = allocatePoint(this.attributes, attrId);
    if (!ok) return false;
    saveAttributes(this.attributes);
    this.derived = computeDerivedStats(this.attributes);
    this.charData = loadCharacterData();
    this.currentHp = Math.min(this.currentHp, this.charData.maxHp);
    this.currentMp = Math.min(this.currentMp, this.charData.maxMp);
    this.events.onStatsChanged.notifyObservers(this.getSnapshot());
    return true;
  }

  /** Harvest a resource node */
  harvestNode(nodeKey: string, damage: number): NodeHarvestResult | null {
    const entry = this.resourceNodes.get(nodeKey);
    if (!entry) return null;

    const profId = entry.def.profession;
    const profState = this.professions.gathering[profId];
    if (!profState) return null;

    const result = hitResourceNode(entry.instance, entry.def, damage, profState.level);

    if (result.stageAdvanced) {
      // Add drops to inventory
      for (const drop of result.drops) {
        addResource(this.inventory, drop.materialId, entry.def.tier, drop.qty);
      }
      saveResourceInventory(this.inventory);

      // Grant profession XP
      const xpAmount = entry.def.tier * 15;
      const levelResult = gainProfessionXp(this.professions, "gathering", profId, xpAmount);
      saveProfessions(this.professions);

      // Build harvest result for event
      const harvestResult: HarvestResult = {
        resources: result.drops.map(d => ({ name: d.materialId, quantity: d.qty, tier: entry.def.tier })),
        xpGained: xpAmount,
        gearDrop: false,
      };

      this.events.onHarvest.notifyObservers({
        nodeId: nodeKey,
        result: harvestResult,
        nodeDepleted: result.depleted,
      });

      if (result.depleted) {
        this.events.onNodeStateChanged.notifyObservers({ nodeId: nodeKey, depleted: true });
      }
    }

    return result;
  }

  /** Take damage */
  takeDamage(amount: number): void {
    const mitigated = Math.max(1, amount - this.charData.def * 0.5);
    this.currentHp = Math.max(0, this.currentHp - mitigated);
    this.events.onStatsChanged.notifyObservers(this.getSnapshot());
    if (this.currentHp <= 0) {
      this.sendCombatEvent({ type: 'LAND' }); // force state reset
    }
  }

  /** Heal */
  heal(amount: number): void {
    this.currentHp = Math.min(this.charData.maxHp, this.currentHp + amount);
    this.events.onStatsChanged.notifyObservers(this.getSnapshot());
  }

  /** Restore mana */
  restoreMana(amount: number): void {
    this.currentMp = Math.min(this.charData.maxMp, this.currentMp + amount);
    this.events.onStatsChanged.notifyObservers(this.getSnapshot());
  }

  /** Grant XP and check level up */
  grantXp(amount: number): void {
    this.charData.xp += amount;
    while (this.charData.xp >= this.charData.xpToNext) {
      this.charData.xp -= this.charData.xpToNext;
      this.charData.level = (this.charData.level || 1) + 1;
      this.charData.xpToNext = Math.floor(80 * Math.pow(1.15, this.charData.level));
      this.attributes.unspentPoints += 7; // POINTS_PER_LEVEL
      saveAttributes(this.attributes);
      this.events.onLevelUp.notifyObservers({
        newLevel: this.charData.level,
        unspentPoints: this.attributes.unspentPoints,
      });
    }
    this.events.onStatsChanged.notifyObservers(this.getSnapshot());
  }

  // ── World Node Management ────────────────────────────────────

  /** Register a resource node in the 3D world */
  registerResourceNode(key: string, def: ResourceNodeDef, worldPos: Vector3, meshNode?: TransformNode): void {
    const instance = createNodeInstance(def, worldPos.x, worldPos.z);
    this.resourceNodes.set(key, { def, instance, meshNode });
  }

  /** Spawn resource nodes for a biome region */
  spawnNodesForBiome(biome: string, positions: Vector3[]): void {
    const defs = getNodesForBiome(biome);
    if (defs.length === 0) return;

    for (let i = 0; i < positions.length; i++) {
      const def = defs[Math.floor(Math.random() * defs.length)];
      const key = `${biome}_${def.id}_${i}`;
      this.registerResourceNode(key, def, positions[i]);
    }
    console.log(`[Bridge] Spawned ${positions.length} resource nodes for biome: ${biome}`);
  }

  /** Get all registered resource nodes */
  getResourceNodes(): Map<string, { def: ResourceNodeDef; instance: ResourceNodeInstance; meshNode?: TransformNode }> {
    return this.resourceNodes;
  }

  // ── Frame Update ─────────────────────────────────────────────

  /** Call every frame with delta time in seconds */
  update(dt: number): void {
    // Update cooldowns
    for (let i = 0; i < this.cooldowns.length; i++) {
      if (this.cooldowns[i] > 0) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    }

    // Update combat FSM tick
    this.combatActor.send({ type: 'TICK', dt });

    // Update resource node respawns
    const nodeInstances = Array.from(this.resourceNodes.values()).map(e => e.instance);
    updateNodeRespawns(nodeInstances, dt * 1000);

    // Check for respawned nodes
    for (const [key, entry] of this.resourceNodes) {
      if (entry.instance.depleted && entry.instance.respawnTimer <= 0) {
        entry.instance.depleted = false;
        entry.instance.currentStage = 0;
        entry.instance.hp = entry.def.hpPerStage;
        this.events.onNodeStateChanged.notifyObservers({ nodeId: key, depleted: false });
      }
    }

    // Passive regen (1 HP/s, 0.5 MP/s when out of combat)
    const combatState = this.getCombatState();
    if (combatState === "idle") {
      this.currentHp = Math.min(this.charData.maxHp, this.currentHp + (1 + this.derived.healthRegen) * dt);
      this.currentMp = Math.min(this.charData.maxMp, this.currentMp + (0.5 + this.derived.manaRegen) * dt);
    }

    // Stamina regen
    this.currentStamina = Math.min(this.charData.maxStamina, this.currentStamina + 5 * dt);
  }

  // ── Internal ─────────────────────────────────────────────────

  private async rebuildWeaponSkills(weaponType: string, weaponId: string | null): Promise<void> {
    this.weaponLoadout = await buildWeaponLoadout(
      weaponType,
      weaponId,
      this.charData.heroRace,
      this.charData.heroClass,
    );
    if (this.weaponLoadout) {
      saveLoadout(this.weaponLoadout);
      this.activeAbilities = getAbilitiesWithWeapon(
        this.weaponLoadout,
        this.charData.heroRace,
        this.charData.heroClass,
      );
    }
  }

  /** Cleanup */
  dispose(): void {
    this.combatActor.stop();
    this.events.onStatsChanged.clear();
    this.events.onEquipmentChanged.clear();
    this.events.onAbilityUsed.clear();
    this.events.onHarvest.clear();
    this.events.onCraftComplete.clear();
    this.events.onCombatStateChanged.clear();
    this.events.onNodeStateChanged.clear();
    this.events.onLevelUp.clear();
    this.events.onInteractionPrompt.clear();
  }
}
