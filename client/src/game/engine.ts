import {
  GameState, Player, Position, Particle, FloatingText, Enemy,
  TILE_SIZE, PLAYER_RADIUS, PICKUP_RANGE, CHEST_RANGE,
  calculateDerivedStats, CHARACTER_CLASSES, CharacterClass,
  Attributes, Equipment, generateLoot, RARITY_COLORS, DroppedItem,
} from './types';
import { generateDungeon, getPlayerStartPosition, isWalkable, updateVisibility } from './dungeon';

export function createPlayer(classId: string, name: string): Player {
  const charClass = CHARACTER_CLASSES.find(c => c.id === classId)!;
  const stats = calculateDerivedStats(charClass.baseAttributes);

  return {
    id: 'player_1',
    name,
    classId,
    level: 1,
    experience: 0,
    experienceToLevel: 100,
    attributes: { ...charClass.baseAttributes },
    unallocatedPoints: 0,
    stats,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    radius: PLAYER_RADIUS,
    color: charClass.color,
    abilities: [...charClass.abilities],
    abilityCooldowns: {},
    equipment: { weapon: null, helmet: null, chest: null, legs: null, boots: null, gloves: null, ring: null, amulet: null },
    inventory: [],
    isAttacking: false,
    attackTarget: null,
    lastAttackTime: 0,
    facingAngle: 0,
    currentHealth: stats.maxHealth,
    currentMana: stats.maxMana,
    currentStamina: stats.maxStamina,
    isDead: false,
    respawnTimer: 0,
    dashCooldown: 2000,
    lastDashTime: 0,
  };
}

export function createGameState(classId: string, playerName: string): GameState {
  const dungeon = generateDungeon(1);
  const player = createPlayer(classId, playerName);
  const startPos = getPlayerStartPosition(dungeon);
  player.position = startPos;

  updateVisibility(dungeon, player.position);

  return {
    player,
    dungeon,
    particles: [],
    camera: { x: startPos.x, y: startPos.y },
    gameTime: 0,
    isPaused: false,
    showInventory: false,
    showCharacterSheet: false,
    showMap: false,
    currentFloor: 1,
    killCount: 0,
    itemsCollected: 0,
    floatingTexts: [],
    gold: 0,
    mouseWorldPos: { x: 0, y: 0 },
    screenShake: 0,
    gameOver: false,
  };
}

function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function addParticle(state: GameState, pos: Position, type: Particle['type'], color: string, text?: string) {
  state.particles.push({
    position: { ...pos },
    velocity: { x: (Math.random() - 0.5) * 3, y: -2 - Math.random() * 2 },
    life: 1,
    maxLife: 1,
    color,
    size: type === 'hit' ? 3 : 2,
    type,
    text,
  });
}

function addFloatingText(state: GameState, pos: Position, text: string, color: string, fontSize: number = 16) {
  state.floatingTexts.push({
    text,
    position: { ...pos },
    color,
    life: 1.5,
    maxLife: 1.5,
    fontSize,
  });
}

function spawnHitParticles(state: GameState, pos: Position, color: string, count: number = 5) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      position: { ...pos },
      velocity: {
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
      },
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      color,
      size: 2 + Math.random() * 3,
      type: 'hit',
    });
  }
}

export function recalculatePlayerStats(player: Player) {
  const baseStats = calculateDerivedStats(player.attributes);

  let bonusDamage = 0, bonusDefense = 0, bonusMaxHealth = 0;
  let bonusCritChance = 0, bonusAttackSpeed = 0, bonusEvasion = 0, bonusResistance = 0;

  const slots = ['weapon', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet'] as const;
  for (const slot of slots) {
    const item = player.equipment[slot];
    if (item && item.stats) {
      bonusDamage += item.stats.damage || 0;
      bonusDefense += item.stats.defense || 0;
      bonusMaxHealth += item.stats.maxHealth || 0;
      bonusCritChance += item.stats.criticalChance || 0;
      bonusAttackSpeed += item.stats.attackSpeed || 0;
      bonusEvasion += item.stats.evasion || 0;
      bonusResistance += item.stats.resistance || 0;
    }
  }

  player.stats = {
    ...baseStats,
    damage: baseStats.damage + bonusDamage,
    defense: baseStats.defense + bonusDefense,
    maxHealth: baseStats.maxHealth + bonusMaxHealth,
    criticalChance: Math.min(0.75, baseStats.criticalChance + bonusCritChance),
    attackSpeed: baseStats.attackSpeed + bonusAttackSpeed,
    evasion: Math.min(0.6, baseStats.evasion + bonusEvasion),
    resistance: Math.min(0.75, baseStats.resistance + bonusResistance),
  };

  player.currentHealth = Math.min(player.currentHealth, player.stats.maxHealth);
  player.currentMana = Math.min(player.currentMana, player.stats.maxMana);
  player.currentStamina = Math.min(player.currentStamina, player.stats.maxStamina);
}

function dealDamageToEnemy(state: GameState, enemy: Enemy, rawDamage: number) {
  const effectiveDefense = Math.max(0, enemy.defense * (1 - state.player.stats.armorPenetration));
  const damage = Math.max(1, Math.floor(rawDamage - effectiveDefense));

  const isCrit = Math.random() < state.player.stats.criticalChance;
  const finalDamage = isCrit ? Math.floor(damage * state.player.stats.criticalDamage) : damage;

  enemy.health -= finalDamage;
  enemy.hitFlash = 0.15;
  enemy.state = 'chase';

  const color = isCrit ? '#fbbf24' : '#ef4444';
  const text = isCrit ? `${finalDamage}!` : `${finalDamage}`;
  addFloatingText(state, { x: enemy.position.x, y: enemy.position.y - 20 }, text, color, isCrit ? 22 : 16);
  spawnHitParticles(state, enemy.position, enemy.color, isCrit ? 10 : 5);
  state.screenShake = isCrit ? 4 : 2;

  if (state.player.stats.drainHealth > 0) {
    const healAmount = Math.floor(finalDamage * state.player.stats.drainHealth);
    if (healAmount > 0) {
      state.player.currentHealth = Math.min(state.player.stats.maxHealth, state.player.currentHealth + healAmount);
      addFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 25 }, `+${healAmount}`, '#22c55e', 14);
    }
  }

  if (enemy.health <= 0) {
    enemy.state = 'dead';
    enemy.deathTimer = 1.0;
    state.killCount++;

    state.player.experience += enemy.experienceReward;
    state.gold += enemy.goldReward;

    addFloatingText(state, { x: enemy.position.x, y: enemy.position.y - 30 }, `+${enemy.experienceReward} XP`, '#a78bfa', 14);
    addFloatingText(state, { x: enemy.position.x + 20, y: enemy.position.y - 15 }, `+${enemy.goldReward}g`, '#fbbf24', 13);

    for (let i = 0; i < 15; i++) {
      state.particles.push({
        position: { ...enemy.position },
        velocity: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 },
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        color: enemy.color,
        size: 3 + Math.random() * 4,
        type: 'death',
      });
    }

    const loot = generateLoot(state.currentFloor, enemy.level, enemy.isBoss);
    if (loot) {
      state.dungeon.items.push({
        id: `drop_${Date.now()}_${Math.random()}`,
        item: loot,
        position: { x: enemy.position.x + (Math.random() - 0.5) * 30, y: enemy.position.y + (Math.random() - 0.5) * 30 },
        sparkleTimer: 0,
      });
    }

    while (state.player.experience >= state.player.experienceToLevel) {
      state.player.experience -= state.player.experienceToLevel;
      state.player.level++;
      state.player.unallocatedPoints += 5;
      state.player.experienceToLevel = Math.floor(100 * Math.pow(1.3, state.player.level - 1));

      state.player.currentHealth = state.player.stats.maxHealth;
      state.player.currentMana = state.player.stats.maxMana;
      state.player.currentStamina = state.player.stats.maxStamina;

      addFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 40 }, `LEVEL UP! (${state.player.level})`, '#fbbf24', 24);

      for (let i = 0; i < 20; i++) {
        state.particles.push({
          position: { ...state.player.position },
          velocity: { x: (Math.random() - 0.5) * 10, y: -3 - Math.random() * 5 },
          life: 1 + Math.random(),
          maxLife: 2,
          color: '#fbbf24',
          size: 4 + Math.random() * 4,
          type: 'levelup',
        });
      }
    }
  }
}

function dealDamageToPlayer(state: GameState, damage: number) {
  if (state.player.isDead) return;

  if (Math.random() < state.player.stats.evasion) {
    addFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 20 }, 'DODGE', '#67e8f9', 14);
    return;
  }

  if (Math.random() < state.player.stats.blockChance) {
    const blockedAmount = Math.floor(damage * 0.6);
    const remaining = damage - blockedAmount;
    addFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 20 }, `BLOCK (-${blockedAmount})`, '#60a5fa', 14);
    damage = remaining;
  }

  const effectiveDefense = state.player.stats.defense;
  const mitigated = Math.max(1, Math.floor(damage - effectiveDefense * 0.3));
  const afterResist = Math.floor(mitigated * (1 - state.player.stats.resistance));
  const finalDamage = Math.max(1, afterResist);

  state.player.currentHealth -= finalDamage;
  state.screenShake = 5;
  addFloatingText(state, { x: state.player.position.x + 10, y: state.player.position.y - 15 }, `-${finalDamage}`, '#ef4444', 18);
  spawnHitParticles(state, state.player.position, '#ef4444', 6);

  if (state.player.currentHealth <= 0) {
    state.player.currentHealth = 0;
    state.player.isDead = true;
    state.player.respawnTimer = 5;
    addFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 40 }, 'YOU DIED', '#ef4444', 28);
  }
}

function updateEnemyAI(state: GameState, enemy: Enemy, dt: number) {
  if (enemy.state === 'dead') {
    enemy.deathTimer -= dt;
    return;
  }

  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

  const distToPlayer = distance(enemy.position, state.player.position);

  if (state.player.isDead) {
    enemy.state = 'idle';
    enemy.velocity = { x: 0, y: 0 };
    return;
  }

  switch (enemy.state) {
    case 'idle':
      enemy.velocity = { x: 0, y: 0 };
      if (distToPlayer < enemy.detectionRange) {
        enemy.state = 'chase';
      } else if (Math.random() < 0.005) {
        enemy.state = 'patrol';
        enemy.patrolTarget = {
          x: enemy.position.x + (Math.random() - 0.5) * 200,
          y: enemy.position.y + (Math.random() - 0.5) * 200,
        };
      }
      break;

    case 'patrol':
      if (distToPlayer < enemy.detectionRange) {
        enemy.state = 'chase';
        break;
      }
      if (enemy.patrolTarget) {
        const distToTarget = distance(enemy.position, enemy.patrolTarget);
        if (distToTarget < 10) {
          enemy.state = 'idle';
          break;
        }
        const angle = Math.atan2(enemy.patrolTarget.y - enemy.position.y, enemy.patrolTarget.x - enemy.position.x);
        enemy.velocity = { x: Math.cos(angle) * enemy.speed * 0.5, y: Math.sin(angle) * enemy.speed * 0.5 };
        enemy.facingAngle = angle;
      }
      break;

    case 'chase':
      if (distToPlayer > enemy.detectionRange * 1.5) {
        enemy.state = 'idle';
        break;
      }
      if (distToPlayer <= enemy.attackRange) {
        enemy.state = 'attack';
        break;
      }
      const chaseAngle = Math.atan2(state.player.position.y - enemy.position.y, state.player.position.x - enemy.position.x);
      enemy.velocity = { x: Math.cos(chaseAngle) * enemy.speed, y: Math.sin(chaseAngle) * enemy.speed };
      enemy.facingAngle = chaseAngle;
      break;

    case 'attack':
      enemy.velocity = { x: 0, y: 0 };
      if (distToPlayer > enemy.attackRange * 1.3) {
        enemy.state = 'chase';
        break;
      }
      const now = state.gameTime * 1000;
      if (now - enemy.lastAttackTime >= enemy.attackCooldown) {
        enemy.lastAttackTime = now;
        dealDamageToPlayer(state, enemy.damage);
        enemy.facingAngle = Math.atan2(state.player.position.y - enemy.position.y, state.player.position.x - enemy.position.x);

        for (let i = 0; i < 3; i++) {
          state.particles.push({
            position: { ...state.player.position },
            velocity: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
            life: 0.3,
            maxLife: 0.3,
            color: '#ef4444',
            size: 2,
            type: 'hit',
          });
        }
      }
      break;
  }

  const newX = enemy.position.x + enemy.velocity.x;
  const newY = enemy.position.y + enemy.velocity.y;
  if (isWalkable(state.dungeon, newX, newY)) {
    enemy.position.x = newX;
    enemy.position.y = newY;
  } else {
    enemy.velocity = { x: 0, y: 0 };
    if (enemy.state === 'patrol') enemy.state = 'idle';
  }
}

export function useAbility(state: GameState, abilityIndex: number) {
  if (state.player.isDead || state.isPaused) return;

  const ability = state.player.abilities[abilityIndex];
  if (!ability) return;

  const now = state.gameTime;
  const cooldownEnd = state.player.abilityCooldowns[ability.id] || 0;
  if (now < cooldownEnd) return;

  if (state.player.currentMana < ability.manaCost) {
    addFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 25 }, 'No Mana!', '#3b82f6', 14);
    return;
  }

  state.player.currentMana -= ability.manaCost;
  const cdDuration = ability.cooldown * (1 - state.player.stats.cooldownReduction);
  state.player.abilityCooldowns[ability.id] = now + cdDuration;

  if (ability.type === 'buff') {
    for (let i = 0; i < 10; i++) {
      state.particles.push({
        position: { ...state.player.position },
        velocity: { x: (Math.random() - 0.5) * 6, y: -2 - Math.random() * 3 },
        life: 0.8,
        maxLife: 0.8,
        color: ability.color,
        size: 3 + Math.random() * 3,
        type: 'ability',
      });
    }
    addFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 30 }, ability.name, ability.color, 16);
    return;
  }

  const baseDamage = ability.type === 'magic' ? state.player.stats.magicDamage : state.player.stats.damage;
  const abilityDamage = baseDamage * ability.damageMultiplier;

  if (ability.aoeRadius > 0) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      state.particles.push({
        position: { ...state.player.position },
        velocity: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 },
        life: 0.5,
        maxLife: 0.5,
        color: ability.color,
        size: 4,
        type: 'ability',
      });
    }

    for (const enemy of state.dungeon.enemies) {
      if (enemy.state === 'dead') continue;
      const dist = distance(state.player.position, enemy.position);
      if (dist <= ability.aoeRadius) {
        dealDamageToEnemy(state, enemy, abilityDamage);
      }
    }
  } else {
    let closestEnemy: Enemy | null = null;
    let closestDist = ability.range;
    for (const enemy of state.dungeon.enemies) {
      if (enemy.state === 'dead') continue;
      const dist = distance(state.player.position, enemy.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy) {
      dealDamageToEnemy(state, closestEnemy, abilityDamage);

      if (ability.type === 'ranged') {
        const angle = Math.atan2(closestEnemy.position.y - state.player.position.y, closestEnemy.position.x - state.player.position.x);
        for (let i = 0; i < 5; i++) {
          state.particles.push({
            position: { x: state.player.position.x + Math.cos(angle) * (20 + i * 15), y: state.player.position.y + Math.sin(angle) * (20 + i * 15) },
            velocity: { x: Math.cos(angle) * 8, y: Math.sin(angle) * 8 },
            life: 0.3,
            maxLife: 0.3,
            color: ability.color,
            size: 3,
            type: 'ability',
          });
        }
      }
    }
  }
}

export function playerAttack(state: GameState) {
  if (state.player.isDead || state.isPaused) return;

  const now = state.gameTime;
  const attackInterval = 1.0 / state.player.stats.attackSpeed;
  if (now - state.player.lastAttackTime < attackInterval) return;

  state.player.lastAttackTime = now;

  let closestEnemy: Enemy | null = null;
  let closestDist = 60;
  for (const enemy of state.dungeon.enemies) {
    if (enemy.state === 'dead') continue;
    const dist = distance(state.player.position, enemy.position);
    if (dist < closestDist) {
      closestDist = dist;
      closestEnemy = enemy;
    }
  }

  if (closestEnemy) {
    const angle = Math.atan2(closestEnemy.position.y - state.player.position.y, closestEnemy.position.x - state.player.position.x);
    state.player.facingAngle = angle;

    if (Math.random() < state.player.stats.accuracy) {
      dealDamageToEnemy(state, closestEnemy, state.player.stats.damage);
    } else {
      addFloatingText(state, { x: closestEnemy.position.x, y: closestEnemy.position.y - 20 }, 'MISS', '#6b7280', 14);
    }
  }
}

export function updateGameState(state: GameState, dt: number, keys: Set<string>) {
  if (state.isPaused || state.gameOver) return;

  state.gameTime += dt;

  if (state.player.isDead) {
    state.player.respawnTimer -= dt;
    if (state.player.respawnTimer <= 0) {
      state.player.isDead = false;
      state.player.currentHealth = state.player.stats.maxHealth * 0.5;
      state.player.currentMana = state.player.stats.maxMana * 0.5;
      const startPos = getPlayerStartPosition(state.dungeon);
      state.player.position = startPos;
    }
    state.camera.x += (state.player.position.x - state.camera.x) * 0.1;
    state.camera.y += (state.player.position.y - state.camera.y) * 0.1;
    return;
  }

  const speed = state.player.stats.movementSpeed;
  let dx = 0, dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx = (dx / len) * speed;
    dy = (dy / len) * speed;
    state.player.facingAngle = Math.atan2(dy, dx);
  }

  const newX = state.player.position.x + dx;
  const newY = state.player.position.y + dy;

  if (isWalkable(state.dungeon, newX, state.player.position.y)) {
    state.player.position.x = newX;
  }
  if (isWalkable(state.dungeon, state.player.position.x, newY)) {
    state.player.position.y = newY;
  }

  if (keys.has(' ')) {
    playerAttack(state);
  }

  state.player.currentHealth = Math.min(state.player.stats.maxHealth,
    state.player.currentHealth + state.player.stats.healthRegen * dt);
  state.player.currentMana = Math.min(state.player.stats.maxMana,
    state.player.currentMana + state.player.stats.manaRegen * dt);
  state.player.currentStamina = Math.min(state.player.stats.maxStamina,
    state.player.currentStamina + 5 * dt);

  for (const enemy of state.dungeon.enemies) {
    updateEnemyAI(state, enemy, dt);
  }

  state.dungeon.enemies = state.dungeon.enemies.filter(e => !(e.state === 'dead' && e.deathTimer <= 0));

  for (let i = state.dungeon.items.length - 1; i >= 0; i--) {
    const drop = state.dungeon.items[i];
    drop.sparkleTimer += dt;
    const dist = distance(state.player.position, drop.position);
    if (dist < PICKUP_RANGE) {
      if (state.player.inventory.length < 30) {
        state.player.inventory.push(drop.item);
        state.itemsCollected++;
        addFloatingText(state, drop.position, drop.item.name, drop.item.color, 14);
        state.dungeon.items.splice(i, 1);
      }
    }
  }

  for (const chest of state.dungeon.chests) {
    if (!chest.opened) {
      const dist = distance(state.player.position, chest.position);
      if (dist < CHEST_RANGE && keys.has('e')) {
        chest.opened = true;
        for (const item of chest.loot) {
          state.dungeon.items.push({
            id: `cdrop_${Date.now()}_${Math.random()}`,
            item,
            position: {
              x: chest.position.x + (Math.random() - 0.5) * 60,
              y: chest.position.y + (Math.random() - 0.5) * 60,
            },
            sparkleTimer: 0,
          });
        }
        for (let i = 0; i < 15; i++) {
          state.particles.push({
            position: { ...chest.position },
            velocity: { x: (Math.random() - 0.5) * 6, y: -3 - Math.random() * 4 },
            life: 1,
            maxLife: 1,
            color: '#fbbf24',
            size: 3 + Math.random() * 3,
            type: 'loot',
          });
        }
        addFloatingText(state, chest.position, 'Chest Opened!', '#fbbf24', 18);
      }
    }
  }

  const playerTileX = Math.floor(state.player.position.x / TILE_SIZE);
  const playerTileY = Math.floor(state.player.position.y / TILE_SIZE);
  if (playerTileX >= 0 && playerTileX < state.dungeon.width && playerTileY >= 0 && playerTileY < state.dungeon.height) {
    if (state.dungeon.tiles[playerTileY][playerTileX].type === 'stairs_down') {
      if (keys.has('e')) {
        state.currentFloor++;
        state.dungeon = generateDungeon(state.currentFloor);
        const startPos = getPlayerStartPosition(state.dungeon);
        state.player.position = startPos;
        state.camera = { ...startPos };
        addFloatingText(state, startPos, `Floor ${state.currentFloor}`, '#fbbf24', 24);
      }
    }
  }

  updateVisibility(state.dungeon, state.player.position);

  state.camera.x += (state.player.position.x - state.camera.x) * 0.08;
  state.camera.y += (state.player.position.y - state.camera.y) * 0.08;

  state.screenShake = Math.max(0, state.screenShake - dt * 15);

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.position.x += p.velocity.x;
    p.position.y += p.velocity.y;
    p.velocity.y += 1 * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.life -= dt;
    ft.position.y -= 30 * dt;
    if (ft.life <= 0) state.floatingTexts.splice(i, 1);
  }
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number, canvasHeight: number) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * state.screenShake * 2 : 0;
  const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * state.screenShake * 2 : 0;

  ctx.save();
  const offsetX = canvasWidth / 2 - state.camera.x + shakeX;
  const offsetY = canvasHeight / 2 - state.camera.y + shakeY;
  ctx.translate(offsetX, offsetY);

  const startTileX = Math.max(0, Math.floor((state.camera.x - canvasWidth / 2) / TILE_SIZE) - 1);
  const endTileX = Math.min(state.dungeon.width, Math.ceil((state.camera.x + canvasWidth / 2) / TILE_SIZE) + 1);
  const startTileY = Math.max(0, Math.floor((state.camera.y - canvasHeight / 2) / TILE_SIZE) - 1);
  const endTileY = Math.min(state.dungeon.height, Math.ceil((state.camera.y + canvasHeight / 2) / TILE_SIZE) + 1);

  const wallColors = ['#1a1520', '#181320', '#1c1625', '#191420'];
  const floorColors = ['#2a2535', '#282338', '#2c2730', '#292434'];
  const floorAccents = ['#322d40', '#302b3e', '#342f42', '#312c3f'];

  for (let y = startTileY; y < endTileY; y++) {
    for (let x = startTileX; x < endTileX; x++) {
      const tile = state.dungeon.tiles[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (!tile.explored && !tile.visible) continue;

      const alpha = tile.visible ? 1 : 0.4;
      ctx.globalAlpha = alpha;

      if (tile.type === 'wall') {
        ctx.fillStyle = wallColors[tile.variant];
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#0d0a12';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        if (tile.variant === 0) {
          ctx.fillStyle = '#221d2e';
          ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, 3);
        }
      } else if (tile.type === 'floor') {
        ctx.fillStyle = floorColors[tile.variant];
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        if (tile.variant % 2 === 0) {
          ctx.fillStyle = floorAccents[tile.variant];
          ctx.fillRect(px + 2, py + 2, 4, 4);
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      } else if (tile.type === 'stairs_down') {
        ctx.fillStyle = '#2a2535';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        const pulse = 0.6 + Math.sin(state.gameTime * 3) * 0.4;
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse * 0.3})`;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('>', px + TILE_SIZE / 2, py + TILE_SIZE / 2);

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }

      ctx.globalAlpha = 1;
    }
  }

  for (const chest of state.dungeon.chests) {
    const tileX = Math.floor(chest.position.x / TILE_SIZE);
    const tileY = Math.floor(chest.position.y / TILE_SIZE);
    if (tileX >= 0 && tileX < state.dungeon.width && tileY >= 0 && tileY < state.dungeon.height) {
      if (!state.dungeon.tiles[tileY][tileX].visible) continue;
    }

    const cx = chest.position.x;
    const cy = chest.position.y;

    if (!chest.opened) {
      const glow = 0.3 + Math.sin(state.gameTime * 2) * 0.15;
      ctx.fillStyle = `rgba(251, 191, 36, ${glow})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = chest.opened ? '#78716c' : '#b45309';
    ctx.fillRect(cx - 12, cy - 10, 24, 18);
    ctx.strokeStyle = chest.opened ? '#57534e' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 12, cy - 10, 24, 18);

    if (!chest.opened) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 3, cy - 4, 6, 6);
    }
  }

  for (const drop of state.dungeon.items) {
    const tileX = Math.floor(drop.position.x / TILE_SIZE);
    const tileY = Math.floor(drop.position.y / TILE_SIZE);
    if (tileX >= 0 && tileX < state.dungeon.width && tileY >= 0 && tileY < state.dungeon.height) {
      if (!state.dungeon.tiles[tileY][tileX].visible) continue;
    }

    const bob = Math.sin(drop.sparkleTimer * 3) * 3;
    const glow = 0.3 + Math.sin(drop.sparkleTimer * 4) * 0.2;

    ctx.fillStyle = `${drop.item.color}${Math.floor(glow * 255).toString(16).padStart(2, '0')}`;
    ctx.beginPath();
    ctx.arc(drop.position.x, drop.position.y + bob, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = drop.item.color;
    ctx.beginPath();
    ctx.arc(drop.position.x, drop.position.y + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(drop.position.x, drop.position.y + bob, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(drop.item.icon, drop.position.x, drop.position.y + bob);
  }

  for (const enemy of state.dungeon.enemies) {
    if (enemy.state === 'dead' && enemy.deathTimer <= 0) continue;

    const tileX = Math.floor(enemy.position.x / TILE_SIZE);
    const tileY = Math.floor(enemy.position.y / TILE_SIZE);
    if (tileX >= 0 && tileX < state.dungeon.width && tileY >= 0 && tileY < state.dungeon.height) {
      if (!state.dungeon.tiles[tileY][tileX].visible) continue;
    }

    if (enemy.state === 'dead') {
      ctx.globalAlpha = enemy.deathTimer;
    }

    const ex = enemy.position.x;
    const ey = enemy.position.y;

    if (enemy.hitFlash > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = enemy.color;
    }

    ctx.beginPath();
    if (enemy.type === 'spider') {
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + state.gameTime * 2;
        const legLen = enemy.radius + 6;
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + Math.cos(angle) * legLen, ey + Math.sin(angle) * legLen);
      }
      ctx.strokeStyle = enemy.hitFlash > 0 ? '#fff' : enemy.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, enemy.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'wraith') {
      const wobble = Math.sin(state.gameTime * 5) * 3;
      ctx.globalAlpha *= 0.7;
      ctx.arc(ex + wobble, ey, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = enemy.state === 'dead' ? enemy.deathTimer : 1;
    } else {
      ctx.arc(ex, ey, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (enemy.isBoss) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, enemy.radius + 4, 0, Math.PI * 2);
      ctx.stroke();

      const crownPoints = 5;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      for (let i = 0; i < crownPoints; i++) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / crownPoints;
        const r = enemy.radius + 8;
        const px = ex + Math.cos(angle) * r;
        const py = ey - enemy.radius - 8 + Math.sin(angle) * 4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.fill();
    }

    const eyeOffset = enemy.radius * 0.3;
    const eyeAngle = enemy.facingAngle;
    ctx.fillStyle = enemy.type === 'wraith' ? '#67e8f9' : (enemy.type === 'demon' ? '#fbbf24' : '#ff0000');
    ctx.beginPath();
    ctx.arc(ex + Math.cos(eyeAngle - 0.4) * eyeOffset, ey + Math.sin(eyeAngle - 0.4) * eyeOffset, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + Math.cos(eyeAngle + 0.4) * eyeOffset, ey + Math.sin(eyeAngle + 0.4) * eyeOffset, 2, 0, Math.PI * 2);
    ctx.fill();

    if (enemy.state !== 'dead' && enemy.health < enemy.maxHealth) {
      const barWidth = enemy.radius * 2 + 10;
      const barHeight = 4;
      const barX = ex - barWidth / 2;
      const barY = ey - enemy.radius - 12;
      const healthPct = enemy.health / enemy.maxHealth;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

      const healthColor = healthPct > 0.5 ? '#22c55e' : (healthPct > 0.25 ? '#f59e0b' : '#ef4444');
      ctx.fillStyle = healthColor;
      ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);

      if (enemy.isBoss) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(enemy.name, ex, barY - 5);
      }
    }

    ctx.globalAlpha = 1;
  }

  if (!state.player.isDead) {
    const px = state.player.position.x;
    const py = state.player.position.y;
    const pr = state.player.radius;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(px, py + pr, pr * 0.8, pr * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    const charClass = CHARACTER_CLASSES.find(c => c.id === state.player.classId);
    ctx.fillStyle = charClass?.secondaryColor || '#666';
    ctx.beginPath();
    ctx.arc(px, py, pr + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = state.player.color;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    const weaponLen = pr + 8;
    const weaponAngle = state.player.facingAngle;
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(weaponAngle) * pr * 0.5, py + Math.sin(weaponAngle) * pr * 0.5);
    ctx.lineTo(px + Math.cos(weaponAngle) * weaponLen, py + Math.sin(weaponAngle) * weaponLen);
    ctx.stroke();

    const eyeOffset = pr * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px + Math.cos(weaponAngle - 0.3) * eyeOffset, py + Math.sin(weaponAngle - 0.3) * eyeOffset, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.arc(px + Math.cos(weaponAngle + 0.3) * eyeOffset, py + Math.sin(weaponAngle + 0.3) * eyeOffset, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(px + Math.cos(weaponAngle - 0.3) * (eyeOffset + 1), py + Math.sin(weaponAngle - 0.3) * (eyeOffset + 1), 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.arc(px + Math.cos(weaponAngle + 0.3) * (eyeOffset + 1), py + Math.sin(weaponAngle + 0.3) * (eyeOffset + 1), 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.player.name, px, py - pr - 8);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(`Lv.${state.player.level}`, px, py - pr - 20);
  }

  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;

    if (p.type === 'levelup') {
      ctx.beginPath();
      const starAngle = state.gameTime * 5;
      for (let i = 0; i < 5; i++) {
        const a = starAngle + (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const r = p.size * (i % 2 === 0 ? 1 : 0.5);
        if (i === 0) ctx.moveTo(p.position.x + Math.cos(a) * r, p.position.y + Math.sin(a) * r);
        else ctx.lineTo(p.position.x + Math.cos(a) * r, p.position.y + Math.sin(a) * r);
      }
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (const ft of state.floatingTexts) {
    const alpha = ft.life / ft.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${ft.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.position.x, ft.position.y);
    ctx.fillText(ft.text, ft.position.x, ft.position.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  if (state.player.isDead) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU DIED', canvasWidth / 2, canvasHeight / 2 - 30);
    ctx.fillStyle = '#a3a3a3';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Respawning in ${Math.ceil(state.player.respawnTimer)}...`, canvasWidth / 2, canvasHeight / 2 + 20);
  }
}

export function renderMinimap(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number, size: number) {
  const mapScale = size / Math.max(state.dungeon.width, state.dungeon.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);

  for (let ty = 0; ty < state.dungeon.height; ty++) {
    for (let tx = 0; tx < state.dungeon.width; tx++) {
      const tile = state.dungeon.tiles[ty][tx];
      if (!tile.explored) continue;

      const mx = x + tx * mapScale;
      const my = y + ty * mapScale;

      if (tile.type === 'wall') continue;

      if (tile.visible) {
        ctx.fillStyle = tile.type === 'stairs_down' ? '#fbbf24' : '#4a4560';
      } else {
        ctx.fillStyle = '#2a2540';
      }
      ctx.fillRect(mx, my, Math.max(1, mapScale), Math.max(1, mapScale));
    }
  }

  for (const enemy of state.dungeon.enemies) {
    if (enemy.state === 'dead') continue;
    const etx = Math.floor(enemy.position.x / TILE_SIZE);
    const ety = Math.floor(enemy.position.y / TILE_SIZE);
    if (etx >= 0 && etx < state.dungeon.width && ety >= 0 && ety < state.dungeon.height) {
      if (state.dungeon.tiles[ety][etx].visible) {
        ctx.fillStyle = enemy.isBoss ? '#fbbf24' : '#ef4444';
        ctx.fillRect(x + etx * mapScale - 1, y + ety * mapScale - 1, 3, 3);
      }
    }
  }

  const ptx = state.player.position.x / TILE_SIZE;
  const pty = state.player.position.y / TILE_SIZE;
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(x + ptx * mapScale, y + pty * mapScale, 3, 0, Math.PI * 2);
  ctx.fill();
}
