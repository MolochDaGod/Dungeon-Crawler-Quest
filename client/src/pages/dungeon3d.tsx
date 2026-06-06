import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildVoxel3DCharacter, idlePose, walkPose, punchPose, kickPose } from '@/game/voxel3d';
import { SandboxWorld } from '@/game/sandbox-physics';
import { VoxelController } from '@/game/voxel-controller';

// ── Dungeon Room Generator ─────────────────────────────────────

interface DungeonRoom {
  x: number; z: number;
  w: number; d: number;
  doors: ('n' | 's' | 'e' | 'w')[];
}

function generateDungeon(floorCount: number): DungeonRoom[] {
  const rooms: DungeonRoom[] = [];
  const size = 12;
  let cx = 0, cz = 0;

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

function buildRoomMeshes(room: DungeonRoom, scene: THREE.Scene, sandbox: SandboxWorld): void {
  const { x, z, w, d } = room;
  const wallH = 3;
  const wallColor = 0x2a2a3e;
  const floorColor = 0x3a3a2e;

  // Floor
  const floorGeo = new THREE.PlaneGeometry(w, d);
  const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x + w / 2, 0.01, z + d / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // Walls (with door gaps)
  const hasDoor = (side: string) => room.doors.includes(side as any);

  // North wall (z=0 side)
  if (!hasDoor('n')) {
    sandbox.createBox(w, wallH, 0.5, x + w / 2, wallH / 2, z, 0, wallColor);
  } else {
    sandbox.createBox(w / 2 - 1.5, wallH, 0.5, x + w / 4 - 0.75, wallH / 2, z, 0, wallColor);
    sandbox.createBox(w / 2 - 1.5, wallH, 0.5, x + 3 * w / 4 + 0.75, wallH / 2, z, 0, wallColor);
  }

  // South wall
  if (!hasDoor('s')) {
    sandbox.createBox(w, wallH, 0.5, x + w / 2, wallH / 2, z + d, 0, wallColor);
  } else {
    sandbox.createBox(w / 2 - 1.5, wallH, 0.5, x + w / 4 - 0.75, wallH / 2, z + d, 0, wallColor);
    sandbox.createBox(w / 2 - 1.5, wallH, 0.5, x + 3 * w / 4 + 0.75, wallH / 2, z + d, 0, wallColor);
  }

  // West wall
  if (!hasDoor('w')) {
    sandbox.createBox(0.5, wallH, d, x, wallH / 2, z + d / 2, 0, wallColor);
  } else {
    sandbox.createBox(0.5, wallH, d / 2 - 1.5, x, wallH / 2, z + d / 4 - 0.75, 0, wallColor);
    sandbox.createBox(0.5, wallH, d / 2 - 1.5, x, wallH / 2, z + 3 * d / 4 + 0.75, 0, wallColor);
  }

  // East wall
  if (!hasDoor('e')) {
    sandbox.createBox(0.5, wallH, d, x + w, wallH / 2, z + d / 2, 0, wallColor);
  } else {
    sandbox.createBox(0.5, wallH, d / 2 - 1.5, x + w, wallH / 2, z + d / 4 - 0.75, 0, wallColor);
    sandbox.createBox(0.5, wallH, d / 2 - 1.5, x + w, wallH / 2, z + 3 * d / 4 + 0.75, 0, wallColor);
  }

  // Destructible props (crates, barrels)
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

// ── Enemy NPC ──────────────────────────────────────────────────

interface DungeonEnemy {
  rig: ReturnType<typeof buildVoxel3DCharacter>;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  attackCooldown: number;
}

// ── Page Component ─────────────────────────────────────────────

export default function Dungeon3DPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(1);
  const [kills, setKills] = useState(0);
  const [hp, setHp] = useState(100);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8; // darker for dungeon mood

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.Fog(0x0a0a12, 8, 30);

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 8, 8);

    // Dim dungeon lighting
    scene.add(new THREE.AmbientLight(0x222233, 0.3));
    const torchLight = new THREE.PointLight(0xff8844, 1.5, 15);
    torchLight.position.set(0, 3, 0);
    scene.add(torchLight);

    // Player light (follows player)
    const playerLight = new THREE.PointLight(0xffaa66, 1.0, 12);
    playerLight.position.set(0, 2, 0);
    scene.add(playerLight);

    // Physics world
    const sandbox = new SandboxWorld(scene);

    // Generate dungeon rooms
    const rooms = generateDungeon(floor);
    rooms.forEach(r => buildRoomMeshes(r, scene, sandbox));

    // Player
    const race = localStorage.getItem('grudge_hero_race') || 'Human';
    const heroClass = localStorage.getItem('grudge_hero_class') || 'Warrior';
    const rig = buildVoxel3DCharacter(race, heroClass);
    const startRoom = rooms[0];
    rig.group.position.set(startRoom.x + startRoom.w / 2, 0, startRoom.z + startRoom.d / 2);
    scene.add(rig.group);

    let playerHp = 100;

    // Controller
    const controller = new VoxelController(camera, rig.group, canvas, null, {
      onAttack: (type) => {
        // Melee attack — damage nearby enemies
        enemies.forEach(en => {
          if (en.hp <= 0) return;
          const dist = en.rig.group.position.distanceTo(rig.group.position);
          if (dist < 2.0) {
            en.hp -= type === 'lmb' ? 15 : 25;
            if (en.hp <= 0) {
              scene.remove(en.rig.group);
              setKills(k => k + 1);
            }
          }
        });
      },
    });

    // Spawn enemies in each room (except first)
    const enemies: DungeonEnemy[] = [];
    const enemyRaces = ['Orc', 'Undead', 'Barbarian'];
    const enemyClasses = ['Warrior', 'Worg'];

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
        scene.add(eRig.group);
        enemies.push({
          rig: eRig,
          hp: 30 + floor * 10,
          maxHp: 30 + floor * 10,
          pos: new THREE.Vector3(ex, 0, ez),
          target: new THREE.Vector3(ex, 0, ez),
          speed: 2 + Math.random(),
          attackCooldown: 0,
        });
      }
    }

    // Game loop
    const clock = new THREE.Clock();
    let animId = 0;
    let disposed = false;
    let time = 0;

    const loop = () => {
      if (disposed) return;
      animId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      time += dt;

      sandbox.step(dt);
      controller.update(dt);

      // Animate player
      const isAttacking = controller.state.lmbDown || controller.state.rmbDown;
      const pose = isAttacking ? punchPose(Math.sin(time * 10) * 0.5 + 0.5) : controller.isMoving() ? walkPose(time) : idlePose(time);
      rig.setPose(pose);
      rig.update(dt);

      // Player light follows
      playerLight.position.copy(rig.group.position);
      playerLight.position.y += 2;

      // Update enemies
      enemies.forEach(en => {
        if (en.hp <= 0) return;
        const toPlayer = new THREE.Vector3().subVectors(rig.group.position, en.rig.group.position);
        const dist = toPlayer.length();

        if (dist < 15) {
          // Chase player
          toPlayer.normalize();
          en.rig.group.position.addScaledVector(toPlayer, en.speed * dt);
          en.rig.group.lookAt(rig.group.position);
          en.rig.setPose(walkPose(time, 0.8));
        } else {
          en.rig.setPose(idlePose(time));
        }
        en.rig.update(dt);

        // Attack player if close
        en.attackCooldown -= dt;
        if (dist < 1.5 && en.attackCooldown <= 0) {
          playerHp -= 5;
          en.attackCooldown = 1.5;
          setHp(Math.max(0, playerHp));
        }
      });

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
  }, [floor]);

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a0a12' }}>
      {/* Dungeon HUD */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,10,5,0.9)', borderBottom: '2px solid #c5a059', borderRadius: '0 0 8px 8px', padding: '6px 20px', fontFamily: "'Oxanium',monospace", display: 'flex', gap: 16, pointerEvents: 'none', zIndex: 10 }}>
        <span style={{ color: '#c5a059', fontWeight: 'bold' }}>Floor {floor}</span>
        <span style={{ color: '#888' }}>|</span>
        <span style={{ color: '#4ade80' }}>Kills: {kills}</span>
      </div>

      {/* HP Bar */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 300, pointerEvents: 'none', fontFamily: "'Oxanium',monospace", zIndex: 10 }}>
        <div style={{ height: 16, background: '#1a0a0a', border: '1px solid #c5a059', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${hp}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#ffcc00)', transition: 'width 0.3s' }} />
        </div>
        <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 11, marginTop: 2 }}>{hp} / 100</div>
      </div>

      {/* Controls */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: "'Oxanium',monospace", pointerEvents: 'none' }}>
        WASD Move · LMB Light · RMB Heavy · Space Jump
      </div>
    </div>
  );
}
