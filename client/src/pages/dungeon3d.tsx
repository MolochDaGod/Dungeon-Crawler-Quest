/**
 * dungeon3d — Explorer dungeon crawl
 *
 * Fleet-style explorer controller (soft-lock + hard lock + shoulder camera),
 * class/weapon skill bar, and hostile AI. Replaces the old VoxelController loop.
 *
 * Live: https://dcq.grudge-studio.com/dungeon3d
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { buildVoxel3DCharacter, idlePose, walkPose, punchPose, kickPose } from '@/game/voxel3d';
import { SandboxWorld } from '@/game/sandbox-physics';
import {
  ExplorerController,
  type SoftLockTarget,
} from '@/game/explorer-controller';
import { getHeroAbilities, type AbilityDef } from '@/game/types';
import { getAbilitiesWithWeapon } from '@/game/weapon-skills';

// ── Dungeon Room Generator ─────────────────────────────────────

interface DungeonRoom {
  x: number;
  z: number;
  w: number;
  d: number;
  doors: ('n' | 's' | 'e' | 'w')[];
}

function generateDungeon(floorCount: number): DungeonRoom[] {
  const rooms: DungeonRoom[] = [];
  const size = 12;
  let cx = 0;
  let cz = 0;

  for (let i = 0; i < 4 + floorCount * 2; i++) {
    const w = size + Math.floor(Math.random() * 6);
    const d = size + Math.floor(Math.random() * 6);
    const doors: DungeonRoom['doors'] = [];
    if (i > 0) doors.push('w');
    if (i < 3 + floorCount * 2) doors.push('e');
    if (Math.random() > 0.5) doors.push(Math.random() > 0.5 ? 'n' : 's');

    rooms.push({ x: cx, z: cz, w, d, doors });
    cx += w + 2;
    if (Math.random() > 0.6) cz += (Math.random() > 0.5 ? 1 : -1) * (d + 2);
  }
  return rooms;
}

function buildRoomMeshes(
  room: DungeonRoom,
  scene: THREE.Scene,
  sandbox: SandboxWorld,
  occluders: THREE.Object3D[],
): void {
  const { x, z, w, d } = room;
  const wallH = 3;
  const wallColor = 0x2a2a3e;
  const floorColor = 0x3a3a2e;

  const floorGeo = new THREE.PlaneGeometry(w, d);
  const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x + w / 2, 0.01, z + d / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const hasDoor = (side: string) => room.doors.includes(side as DungeonRoom['doors'][number]);

  const addWallBox = (bw: number, bh: number, bd: number, px: number, py: number, pz: number) => {
    const obj = sandbox.createBox(bw, bh, bd, px, py, pz, 0, wallColor);
    if (obj?.mesh) occluders.push(obj.mesh);
  };

  if (!hasDoor('n')) {
    addWallBox(w, wallH, 0.5, x + w / 2, wallH / 2, z);
  } else {
    addWallBox(w / 2 - 1.5, wallH, 0.5, x + w / 4 - 0.75, wallH / 2, z);
    addWallBox(w / 2 - 1.5, wallH, 0.5, x + 3 * w / 4 + 0.75, wallH / 2, z);
  }
  if (!hasDoor('s')) {
    addWallBox(w, wallH, 0.5, x + w / 2, wallH / 2, z + d);
  } else {
    addWallBox(w / 2 - 1.5, wallH, 0.5, x + w / 4 - 0.75, wallH / 2, z + d);
    addWallBox(w / 2 - 1.5, wallH, 0.5, x + 3 * w / 4 + 0.75, wallH / 2, z + d);
  }
  if (!hasDoor('w')) {
    addWallBox(0.5, wallH, d, x, wallH / 2, z + d / 2);
  } else {
    addWallBox(0.5, wallH, d / 2 - 1.5, x, wallH / 2, z + d / 4 - 0.75);
    addWallBox(0.5, wallH, d / 2 - 1.5, x, wallH / 2, z + 3 * d / 4 + 0.75);
  }
  if (!hasDoor('e')) {
    addWallBox(0.5, wallH, d, x + w, wallH / 2, z + d / 2);
  } else {
    addWallBox(0.5, wallH, d / 2 - 1.5, x + w, wallH / 2, z + d / 4 - 0.75);
    addWallBox(0.5, wallH, d / 2 - 1.5, x + w, wallH / 2, z + 3 * d / 4 + 0.75);
  }

  const propCount = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < propCount; i++) {
    const px = x + 1 + Math.random() * (w - 2);
    const pz = z + 1 + Math.random() * (d - 2);
    if (Math.random() > 0.5) {
      sandbox.createBox(0.8, 0.8, 0.8, px, 0.4, pz, 10, 0x885533);
    } else {
      sandbox.createCylinder(0.4, 1.0, px, 0.5, pz, 10, 0x3366cc);
    }
  }
}

// ── Enemy ──────────────────────────────────────────────────────

interface DungeonEnemy {
  id: string;
  rig: ReturnType<typeof buildVoxel3DCharacter>;
  hp: number;
  maxHp: number;
  speed: number;
  attackCooldown: number;
  hitFlash: number;
  alive: boolean;
  /** World reticle under feet when soft/hard locked */
  ring: THREE.Mesh;
}

/** 2D ability range (~80–120) → metres for SI dungeon */
function abilityRangeM(range: number): number {
  if (range <= 0) return 2.2;
  return Math.max(1.6, Math.min(12, range / 40));
}

function abilityRadiusM(radius: number): number {
  if (radius <= 0) return 0;
  return Math.max(1.2, Math.min(8, radius / 40));
}

// ── Skill HUD state ────────────────────────────────────────────

interface SkillHudSlot {
  name: string;
  key: string;
  cd: number;
  maxCd: number;
  ready: boolean;
}

// ── Page ───────────────────────────────────────────────────────

export default function Dungeon3DPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(1);
  const [kills, setKills] = useState(0);
  const [hp, setHp] = useState(100);
  const [mp, setMp] = useState(100);
  const [lockLabel, setLockLabel] = useState('');
  const [softLabel, setSoftLabel] = useState('');
  const [skills, setSkills] = useState<SkillHudSlot[]>([]);
  const [flash, setFlash] = useState('');
  const [dead, setDead] = useState(false);

  const flashTimer = useRef(0);
  const showFlash = useCallback((msg: string, sec = 0.8) => {
    setFlash(msg);
    flashTimer.current = sec;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:none;';
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.Fog(0x0a0a12, 10, 36);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 4, 6);

    scene.add(new THREE.AmbientLight(0x222233, 0.35));
    const torchLight = new THREE.PointLight(0xff8844, 1.4, 16);
    torchLight.position.set(0, 3, 0);
    scene.add(torchLight);

    const playerLight = new THREE.PointLight(0xffaa66, 1.1, 14);
    playerLight.position.set(0, 2, 0);
    scene.add(playerLight);

    // Soft-lock world reticle (ground ring along aim)
    const reticleGeo = new THREE.RingGeometry(0.35, 0.48, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const worldReticle = new THREE.Mesh(reticleGeo, reticleMat);
    worldReticle.rotation.x = -Math.PI / 2;
    worldReticle.visible = false;
    scene.add(worldReticle);

    const sandbox = new SandboxWorld(scene);
    const occluders: THREE.Object3D[] = [];

    const rooms = generateDungeon(floor);
    rooms.forEach((r) => buildRoomMeshes(r, scene, sandbox, occluders));

    // Player
    try {
      const raw = localStorage.getItem('grudge_custom_hero');
      if (raw) {
        const h = JSON.parse(raw);
        if (h.race) localStorage.setItem('grudge_hero_race', h.race);
        if (h.heroClass) localStorage.setItem('grudge_hero_class', h.heroClass);
      }
    } catch { /* ignore */ }
    const race = localStorage.getItem('grudge_hero_race') || 'Human';
    const heroClass = localStorage.getItem('grudge_hero_class') || 'Warrior';
    const rig = buildVoxel3DCharacter(race, heroClass);
    const startRoom = rooms[0];
    rig.group.position.set(
      startRoom.x + startRoom.w / 2,
      0,
      startRoom.z + startRoom.d / 2,
    );
    scene.add(rig.group);

    let playerHp = 100;
    let playerMp = 100;
    let playerDead = false;
    let invuln = 0;
    let attackAnimT = 0;
    let killCount = 0;

    // Weapon / class skills
    const classAbilities: AbilityDef[] = getHeroAbilities(race, heroClass);
    let abilities: AbilityDef[] = classAbilities;
    // Try weapon loadout from storage (sync path — async OS skills optional)
    try {
      const raw = localStorage.getItem('grudge_weapon_loadout');
      if (raw) {
        // Prefer class abilities; loadout may be incomplete offline
        abilities = getAbilitiesWithWeapon(null, race, heroClass);
      }
    } catch {
      /* ignore */
    }
    if (abilities.length === 0) {
      abilities = classAbilities.length
        ? classAbilities
        : [
            {
              name: 'Slash',
              key: 'Q',
              cooldown: 0.4,
              manaCost: 0,
              damage: 18,
              range: 90,
              radius: 0,
              duration: 0,
              type: 'damage',
              castType: 'targeted',
              description: 'Basic slash',
              slot: 'attack',
            },
          ];
    }

    const skillCd: number[] = abilities.map(() => 0);
    const syncSkillHud = () => {
      setSkills(
        abilities.slice(0, 4).map((a, i) => ({
          name: a.name,
          key: a.key || String(i + 1),
          cd: skillCd[i] ?? 0,
          maxCd: a.cooldown || 0.5,
          ready: (skillCd[i] ?? 0) <= 0 && playerMp >= (a.manaCost || 0),
        })),
      );
    };
    syncSkillHud();

    // Enemies
    const enemies: DungeonEnemy[] = [];
    const enemyRaces = ['Orc', 'Undead', 'Barbarian'];
    const enemyClasses = ['Warrior', 'Worg'];
    let enemySeq = 0;

    const makeRing = (color: number) => {
      const g = new THREE.RingGeometry(0.5, 0.62, 28);
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    };

    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      const count = 1 + Math.floor(Math.random() * 3);
      for (let j = 0; j < count; j++) {
        const eRace = enemyRaces[Math.floor(Math.random() * enemyRaces.length)];
        const eClass = enemyClasses[Math.floor(Math.random() * enemyClasses.length)];
        const eRig = buildVoxel3DCharacter(eRace, eClass);
        const ex = r.x + 2 + Math.random() * (r.w - 4);
        const ez = r.z + 2 + Math.random() * (r.d - 4);
        eRig.group.position.set(ex, 0, ez);
        eRig.group.userData.selectable = 'hostile';
        eRig.group.userData.enemyId = `en-${++enemySeq}`;
        scene.add(eRig.group);
        enemies.push({
          id: eRig.group.userData.enemyId,
          rig: eRig,
          hp: 30 + floor * 12,
          maxHp: 30 + floor * 12,
          speed: 2.2 + Math.random() * 0.8,
          attackCooldown: 0,
          hitFlash: 0,
          alive: true,
          ring: makeRing(0xef4444),
        });
      }
    }

    const publishTargets = () => {
      const list: SoftLockTarget[] = enemies
        .filter((e) => e.alive)
        .map((e) => ({
          id: e.id,
          point: new THREE.Vector3(
            e.rig.group.position.x,
            e.rig.group.position.y + 1.1,
            e.rig.group.position.z,
          ),
          mesh: e.rig.group,
          alive: true,
        }));
      controller.setTargets(list);
    };

    const damageEnemy = (en: DungeonEnemy, dmg: number) => {
      if (!en.alive) return;
      en.hp -= dmg;
      en.hitFlash = 0.2;
      if (en.hp <= 0) {
        en.alive = false;
        en.hp = 0;
        scene.remove(en.rig.group);
        scene.remove(en.ring);
        killCount += 1;
        setKills(killCount);
        publishTargets();
        showFlash('KILL', 0.5);
        // Floor clear → next
        if (enemies.every((e) => !e.alive)) {
          showFlash('FLOOR CLEAR', 1.5);
          setTimeout(() => setFloor((f) => f + 1), 1600);
        }
      }
    };

    const hitEnemiesInRange = (
      origin: THREE.Vector3,
      range: number,
      damage: number,
      preferId?: string | null,
    ) => {
      let hit = 0;
      // Prefer locked target first
      if (preferId) {
        const preferred = enemies.find((e) => e.id === preferId && e.alive);
        if (preferred) {
          const d = preferred.rig.group.position.distanceTo(origin);
          if (d <= range + 0.3) {
            damageEnemy(preferred, damage);
            hit++;
            return hit;
          }
        }
      }
      for (const en of enemies) {
        if (!en.alive) continue;
        const d = en.rig.group.position.distanceTo(origin);
        if (d <= range) {
          damageEnemy(en, damage);
          hit++;
        }
      }
      return hit;
    };

    const hitConeOrAoe = (
      origin: THREE.Vector3,
      aim: THREE.Vector3,
      ability: AbilityDef,
      preferId?: string | null,
    ) => {
      const range = abilityRangeM(ability.range || 100);
      const radius = abilityRadiusM(ability.radius || 0);
      if (ability.castType === 'self_cast' || ability.type === 'aoe') {
        const r = radius > 0 ? radius : range;
        for (const en of enemies) {
          if (!en.alive) continue;
          if (en.rig.group.position.distanceTo(origin) <= r) {
            damageEnemy(en, ability.damage);
          }
        }
        return;
      }
      if (ability.castType === 'cone') {
        const dir = new THREE.Vector3().subVectors(aim, origin);
        dir.y = 0;
        if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
        dir.normalize();
        const coneRange = radius > 0 ? radius : range;
        for (const en of enemies) {
          if (!en.alive) continue;
          const toE = new THREE.Vector3().subVectors(en.rig.group.position, origin);
          toE.y = 0;
          const dist = toE.length();
          if (dist > coneRange || dist < 0.01) continue;
          toE.normalize();
          if (toE.dot(dir) > 0.5) damageEnemy(en, ability.damage);
        }
        return;
      }
      // targeted / skillshot / default — single or small radius
      hitEnemiesInRange(origin, range, ability.damage, preferId);
    };

    // Controller
    const controller = new ExplorerController(camera, rig.group, canvas, {
      onAttack: (type, aim) => {
        if (playerDead) return;
        attackAnimT = type === 'lmb' ? 0.35 : 0.5;
        const origin = rig.group.position.clone();
        origin.y = 0;
        const prefer =
          controller.state.hardTarget?.id ?? controller.state.softTarget?.id ?? null;
        const dmg = type === 'lmb' ? 14 + floor * 2 : 22 + floor * 3;
        const range = type === 'lmb' ? 2.1 : 2.6;
        const n = hitEnemiesInRange(origin, range, dmg, prefer);
        if (n === 0 && prefer) {
          // Miss locked target — still slash air
        }
      },
      onSkill: (slot, aim, target) => {
        if (playerDead) return;
        const ab = abilities[slot];
        if (!ab) return;
        if ((skillCd[slot] ?? 0) > 0) {
          showFlash('ON CD', 0.4);
          return;
        }
        const cost = ab.manaCost || 0;
        if (playerMp < cost) {
          showFlash('NO MP', 0.4);
          return;
        }
        playerMp = Math.max(0, playerMp - cost);
        setMp(playerMp);
        skillCd[slot] = ab.cooldown > 0 ? ab.cooldown : 0.45;
        attackAnimT = 0.45;
        showFlash(ab.name.toUpperCase(), 0.7);

        const origin = rig.group.position.clone();

        if (ab.type === 'buff' || ab.castType === 'self_cast') {
          if (ab.damage > 0 || ab.type === 'aoe') {
            hitConeOrAoe(origin, aim, ab, target?.id);
          } else if ((ab.effect || '').includes('block') || ab.name.toLowerCase().includes('parry')) {
            invuln = Math.max(invuln, ab.duration || 1.2);
            showFlash('GUARD', 0.6);
          } else if (ab.type === 'heal') {
            playerHp = Math.min(100, playerHp + (ab.damage || 25));
            setHp(playerHp);
          } else {
            // buff — short invuln pulse as feedback
            invuln = Math.max(invuln, 0.4);
          }
        } else if (ab.type === 'dash') {
          // Simple dash toward aim
          const dir = new THREE.Vector3().subVectors(aim, origin);
          dir.y = 0;
          if (dir.lengthSq() > 1e-4) {
            dir.normalize();
            const dash = Math.min(abilityRangeM(ab.range || 200) * 0.45, 6);
            rig.group.position.addScaledVector(dir, dash);
          }
          if (ab.damage > 0) {
            hitEnemiesInRange(rig.group.position, 2.4, ab.damage, target?.id);
          }
        } else {
          hitConeOrAoe(origin, aim, ab, target?.id);
        }
        syncSkillHud();
      },
      onDodge: () => {
        invuln = Math.max(invuln, 0.28);
        showFlash('DODGE', 0.35);
      },
      onParry: () => {
        invuln = Math.max(invuln, 0.45);
        showFlash('PARRY', 0.4);
      },
      onLockChange: (locked, t) => {
        setLockLabel(locked ? `LOCK · ${t?.id ?? ''}` : '');
        showFlash(locked ? 'LOCK ON' : 'LOCK OFF', 0.5);
      },
      onSoftLockChange: (t) => {
        setSoftLabel(t ? `TARGET · ${t.id}` : '');
      },
    });
    controller.setOccluders(occluders);
    publishTargets();

    // Game loop
    const clock = new THREE.Clock();
    let animId = 0;
    let disposed = false;
    let time = 0;
    let hudAccum = 0;

    const loop = () => {
      if (disposed) return;
      animId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      time += dt;

      if (flashTimer.current > 0) {
        flashTimer.current -= dt;
        if (flashTimer.current <= 0) setFlash('');
      }
      if (invuln > 0) invuln -= dt;
      if (attackAnimT > 0) attackAnimT -= dt;

      // Skill CDs + MP regen
      let skillDirty = false;
      for (let i = 0; i < skillCd.length; i++) {
        if (skillCd[i] > 0) {
          skillCd[i] = Math.max(0, skillCd[i] - dt);
          skillDirty = true;
        }
      }
      playerMp = Math.min(100, playerMp + 4 * dt);
      hudAccum += dt;
      if (hudAccum > 0.2) {
        hudAccum = 0;
        setMp(Math.round(playerMp));
        if (skillDirty) syncSkillHud();
      }

      sandbox.step(dt);
      if (!playerDead) controller.update(dt);

      // Player pose
      let pose;
      if (attackAnimT > 0) {
        pose = punchPose(1 - attackAnimT / 0.5);
      } else if (controller.isMoving()) {
        pose = walkPose(time * (controller.state.sprinting ? 1.4 : 1));
      } else {
        pose = idlePose(time);
      }
      rig.setPose(pose);
      rig.update(dt);

      playerLight.position.copy(rig.group.position);
      playerLight.position.y += 2;
      torchLight.position.set(
        rig.group.position.x + Math.sin(time) * 2,
        3,
        rig.group.position.z + Math.cos(time * 0.7) * 2,
      );

      // Soft-lock rings + world reticle
      const softId = controller.state.softTarget?.id;
      const hardId = controller.state.hardTarget?.id;
      for (const en of enemies) {
        if (!en.alive) continue;
        en.ring.visible = en.id === softId || en.id === hardId;
        en.ring.position.set(
          en.rig.group.position.x,
          0.05,
          en.rig.group.position.z,
        );
        const mat = en.ring.material as THREE.MeshBasicMaterial;
        mat.color.setHex(en.id === hardId ? 0xf97316 : 0xef4444);
        mat.opacity = en.id === hardId ? 0.9 : 0.65;
      }

      // World reticle along aim
      const aim = controller.resolveAimPoint();
      const hasFocus = controller.state.softLockEnabled || controller.state.hardLocked;
      worldReticle.visible = hasFocus && !playerDead;
      if (worldReticle.visible) {
        const px = rig.group.position.x;
        const pz = rig.group.position.z;
        let rx = aim.x;
        let rz = aim.z;
        // Clamp ring 2–8 m ahead on player→aim line
        const dx = rx - px;
        const dz = rz - pz;
        const dist = Math.hypot(dx, dz) || 1;
        const clamp = Math.min(8, Math.max(2, dist));
        rx = px + (dx / dist) * clamp;
        rz = pz + (dz / dist) * clamp;
        worldReticle.position.set(rx, 0.06, rz);
        const rmat = worldReticle.material as THREE.MeshBasicMaterial;
        rmat.color.setHex(controller.state.hardLocked ? 0xef4444 : 0xf59e0b);
      }

      // Enemies AI
      for (const en of enemies) {
        if (!en.alive) continue;
        if (en.hitFlash > 0) en.hitFlash -= dt;

        const toPlayer = new THREE.Vector3().subVectors(
          rig.group.position,
          en.rig.group.position,
        );
        toPlayer.y = 0;
        const dist = toPlayer.length();

        if (!playerDead && dist < 16) {
          if (dist > 1.4) {
            toPlayer.normalize();
            en.rig.group.position.addScaledVector(toPlayer, en.speed * dt);
            en.rig.group.lookAt(
              rig.group.position.x,
              en.rig.group.position.y,
              rig.group.position.z,
            );
            en.rig.setPose(walkPose(time, 0.9));
          } else {
            en.rig.setPose(punchPose(Math.sin(time * 8) * 0.5 + 0.5));
          }
        } else {
          en.rig.setPose(idlePose(time));
        }
        en.rig.update(dt);

        en.attackCooldown -= dt;
        if (!playerDead && dist < 1.55 && en.attackCooldown <= 0) {
          en.attackCooldown = 1.35;
          if (invuln <= 0) {
            playerHp -= 6 + floor;
            if (playerHp <= 0) {
              playerHp = 0;
              playerDead = true;
              setDead(true);
              showFlash('YOU DIED', 3);
            }
            setHp(Math.max(0, playerHp));
          } else {
            showFlash('BLOCKED', 0.3);
          }
        }
      }

      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      controller.dispose();
      sandbox.dispose();
      renderer.dispose();
      window.removeEventListener('resize', onResize);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
  }, [floor, showFlash]);

  const restart = () => {
    setDead(false);
    setHp(100);
    setMp(100);
    setKills(0);
    setFloor(1);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        background: '#0a0a12',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15,10,5,0.92)',
          borderBottom: '2px solid #c5a059',
          borderRadius: '0 0 8px 8px',
          padding: '6px 20px',
          fontFamily: "'Oxanium',monospace",
          display: 'flex',
          gap: 16,
          pointerEvents: 'none',
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#c5a059', fontWeight: 'bold' }}>Floor {floor}</span>
        <span style={{ color: '#555' }}>|</span>
        <span style={{ color: '#4ade80' }}>Kills: {kills}</span>
        {lockLabel && (
          <>
            <span style={{ color: '#555' }}>|</span>
            <span style={{ color: '#f97316', fontWeight: 600 }}>{lockLabel}</span>
          </>
        )}
        {!lockLabel && softLabel && (
          <>
            <span style={{ color: '#555' }}>|</span>
            <span style={{ color: '#f59e0b' }}>{softLabel}</span>
          </>
        )}
      </div>

      {/* Screen crosshair (focus / soft-lock) */}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 18,
          height: 18,
          border: `2px solid ${lockLabel ? '#ef4444' : 'rgba(245,158,11,0.75)'}`,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9,
          boxShadow: lockLabel ? '0 0 8px #ef444488' : 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 3,
            height: 3,
            margin: '-1.5px 0 0 -1.5px',
            background: lockLabel ? '#ef4444' : '#f59e0b',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Combat flash */}
      {flash && (
        <div
          style={{
            position: 'absolute',
            top: '22%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fde68a',
            fontFamily: "'Oxanium',monospace",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: 2,
            textShadow: '0 0 12px #c5a059, 0 2px 4px #000',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          {flash}
        </div>
      )}

      {/* HP / MP */}
      <div
        style={{
          position: 'absolute',
          bottom: 88,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 320,
          pointerEvents: 'none',
          fontFamily: "'Oxanium',monospace",
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: 14,
            background: '#1a0a0a',
            border: '1px solid #c5a059',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${hp}%`,
              height: '100%',
              background: 'linear-gradient(90deg,#ef4444,#ffcc00)',
              transition: 'width 0.15s',
            }}
          />
        </div>
        <div
          style={{
            height: 8,
            marginTop: 4,
            background: '#0a1220',
            border: '1px solid #3b82f6',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${mp}%`,
              height: '100%',
              background: 'linear-gradient(90deg,#2563eb,#38bdf8)',
              transition: 'width 0.15s',
            }}
          />
        </div>
        <div style={{ textAlign: 'center', color: '#aaa', fontSize: 10, marginTop: 3 }}>
          HP {hp}/100 · MP {Math.round(mp)}
        </div>
      </div>

      {/* Skill bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          zIndex: 10,
          pointerEvents: 'none',
          fontFamily: "'Oxanium',monospace",
        }}
      >
        {skills.map((s, i) => (
          <div
            key={i}
            style={{
              width: 64,
              height: 64,
              background: s.ready ? 'rgba(20,16,10,0.9)' : 'rgba(10,8,6,0.85)',
              border: `2px solid ${s.ready ? '#c5a059' : '#444'}`,
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: s.ready ? 1 : 0.55,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span style={{ color: '#c5a059', fontSize: 11, fontWeight: 700 }}>{s.key}</span>
            <span
              style={{
                color: '#eee',
                fontSize: 9,
                textAlign: 'center',
                padding: '0 2px',
                lineHeight: 1.15,
              }}
            >
              {s.name}
            </span>
            {s.cd > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {s.cd.toFixed(1)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls help */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          color: 'rgba(255,255,255,0.38)',
          fontSize: 10,
          fontFamily: "'Oxanium',monospace",
          pointerEvents: 'none',
          textAlign: 'right',
          lineHeight: 1.45,
          maxWidth: 280,
        }}
      >
        WASD move · Shift sprint · Space jump · Click free-look
        <br />
        LMB attack · RMB hard lock · Tab soft-lock · Alt+Tab free cam
        <br />
        1–4 / Q E R F skills · X dodge · C parry
      </div>

      {dead && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
            fontFamily: "'Oxanium',monospace",
          }}
        >
          <div style={{ color: '#ef4444', fontSize: 36, fontWeight: 800, marginBottom: 12 }}>
            YOU DIED
          </div>
          <div style={{ color: '#aaa', marginBottom: 20 }}>Floor {floor} · {kills} kills</div>
          <button
            type="button"
            onClick={restart}
            style={{
              background: '#c5a059',
              color: '#1a1008',
              border: 'none',
              padding: '10px 28px',
              borderRadius: 6,
              fontWeight: 700,
              fontFamily: "'Oxanium',monospace",
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Restart Floor 1
          </button>
        </div>
      )}
    </div>
  );
}
