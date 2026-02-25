import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HEROES, HeroData, CLASS_COLORS, RACE_COLORS } from '@/game/types';

interface Town {
  name: string;
  race: string;
  position: THREE.Vector3;
  color: number;
  buildings: THREE.Group[];
}

const WORLD_SIZE = 800;

const TOWN_CONFIGS = [
  { name: 'Elvenhollow', race: 'Elf', pos: new THREE.Vector3(-200, 0, -200), color: 0x22d3ee },
  { name: 'Ironjaw Keep', race: 'Orc', pos: new THREE.Vector3(200, 0, 150), color: 0x65a30d },
  { name: 'Valorheim', race: 'Human', pos: new THREE.Vector3(-50, 0, 250), color: 0x94a3b8 },
];

export default function OpenWorldPage() {
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTown, setCurrentTown] = useState<string | null>(null);
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 });
  const [heroInfo, setHeroInfo] = useState<HeroData | null>(null);
  const keysRef = useRef<Set<string>>(new Set());

  const heroId = parseInt(localStorage.getItem('grudge_hero_id') || '-1');

  useEffect(() => {
    if (heroId < 0) { setLocation('/'); return; }
    const hd = HEROES.find(h => h.id === heroId);
    if (hd) setHeroInfo(hd);
  }, [heroId, setLocation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2a3a);
    scene.fog = new THREE.FogExp2(0x1a2a3a, 0.002);

    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 25, 30);

    const ambient = new THREE.AmbientLight(0x556677, 0.5);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362a1a, 0.6);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
    sun.position.set(100, 150, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
    sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
    scene.add(sun);

    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 128, 128);
    groundGeo.rotateX(-Math.PI / 2);
    const positions = groundGeo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const noise = Math.sin(x * 0.02) * Math.cos(z * 0.015) * 3 + Math.sin(x * 0.05 + z * 0.03) * 1.5;
      positions.setY(i, noise);
      const isNearTown = TOWN_CONFIGS.some(t => {
        const dx = x - t.pos.x, dz = z - t.pos.z;
        return Math.sqrt(dx * dx + dz * dz) < 80;
      });
      if (isNearTown) {
        colors[i * 3] = 0.45; colors[i * 3 + 1] = 0.38; colors[i * 3 + 2] = 0.28;
      } else {
        const v = 0.15 + Math.random() * 0.08;
        colors[i * 3] = v + 0.05; colors[i * 3 + 1] = v + 0.25; colors[i * 3 + 2] = v;
      }
    }
    groundGeo.computeVertexNormals();
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.9 });
    for (let i = 0; i < TOWN_CONFIGS.length; i++) {
      for (let j = i + 1; j < TOWN_CONFIGS.length; j++) {
        const a = TOWN_CONFIGS[i].pos, b = TOWN_CONFIGS[j].pos;
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);
        const roadGeo = new THREE.PlaneGeometry(len, 8);
        roadGeo.rotateX(-Math.PI / 2);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2);
        road.rotation.y = -angle;
        road.receiveShadow = true;
        scene.add(road);
      }
    }

    const gltfLoader = new GLTFLoader();
    const towns: Town[] = [];

    for (const tc of TOWN_CONFIGS) {
      const town: Town = { name: tc.name, race: tc.race, position: tc.pos, color: tc.color, buildings: [] };
      const townGroup = new THREE.Group();
      townGroup.position.copy(tc.pos);
      scene.add(townGroup);

      const color = new THREE.Color(tc.color);

      const hallBase = new THREE.CylinderGeometry(6, 7, 2, 8);
      const hallMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.8 });
      const hall = new THREE.Mesh(hallBase, hallMat);
      hall.castShadow = true; hall.position.y = 1;
      townGroup.add(hall);

      const hallBody = new THREE.BoxGeometry(10, 8, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: tc.race === 'Elf' ? 0x4a7a5a : tc.race === 'Orc' ? 0x5a4a3a : 0x6a6a7a, roughness: 0.7 });
      const body = new THREE.Mesh(hallBody, bodyMat);
      body.castShadow = true; body.position.y = 6;
      townGroup.add(body);

      const roofGeo = new THREE.ConeGeometry(8, 5, tc.race === 'Elf' ? 6 : 4);
      const roofMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.castShadow = true; roof.position.y = 12.5;
      townGroup.add(roof);

      const bannerGeo = new THREE.PlaneGeometry(2, 4);
      const bannerMat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.3 });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(0, 18, 0); banner.name = 'banner';
      townGroup.add(banner);

      const light = new THREE.PointLight(tc.color, 1.5, 40);
      light.position.y = 10;
      townGroup.add(light);

      for (let h = 0; h < 6; h++) {
        const angle = (h / 6) * Math.PI * 2;
        const radius = 30 + Math.random() * 20;
        const houseGroup = new THREE.Group();
        houseGroup.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        houseGroup.rotation.y = Math.random() * Math.PI * 2;

        const houseSize = 3 + Math.random() * 2;
        const wallGeo = new THREE.BoxGeometry(houseSize, houseSize * 1.2, houseSize);
        const wallColor = tc.race === 'Elf' ? 0x5a7a5a : tc.race === 'Orc' ? 0x5a4030 : 0x7a7a8a;
        const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.castShadow = true; wall.position.y = houseSize * 0.6;
        houseGroup.add(wall);

        const hRoofGeo = tc.race === 'Elf'
          ? new THREE.ConeGeometry(houseSize * 0.8, houseSize * 0.6, 6)
          : new THREE.ConeGeometry(houseSize * 0.8, houseSize * 0.5, 4);
        const hRoofMat = new THREE.MeshStandardMaterial({ color: tc.race === 'Elf' ? 0x2a9a6a : tc.race === 'Orc' ? 0x8a5a2a : 0x5a5a6a, roughness: 0.6 });
        const hRoof = new THREE.Mesh(hRoofGeo, hRoofMat);
        hRoof.castShadow = true; hRoof.position.y = houseSize * 1.35;
        houseGroup.add(hRoof);

        townGroup.add(houseGroup);
      }

      if (tc.race === 'Elf') {
        for (let t = 0; t < 8; t++) {
          const tAngle = (t / 8) * Math.PI * 2 + Math.random() * 0.3;
          const tRadius = 50 + Math.random() * 30;
          const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 6 + Math.random() * 4, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.castShadow = true;
          trunk.position.set(Math.cos(tAngle) * tRadius + tc.pos.x, 3, Math.sin(tAngle) * tRadius + tc.pos.z);
          scene.add(trunk);
          const crownGeo = new THREE.SphereGeometry(3 + Math.random() * 2, 8, 6);
          const crownMat = new THREE.MeshStandardMaterial({ color: 0x1a8a4a + Math.floor(Math.random() * 0x222222), roughness: 0.8 });
          const crown = new THREE.Mesh(crownGeo, crownMat);
          crown.castShadow = true;
          crown.position.set(trunk.position.x, 7 + Math.random() * 2, trunk.position.z);
          scene.add(crown);
        }
      } else if (tc.race === 'Orc') {
        for (let s = 0; s < 4; s++) {
          const sAngle = (s / 4) * Math.PI * 2;
          const sRadius = 55;
          const spikeGeo = new THREE.ConeGeometry(1, 8, 4);
          const spikeMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
          const spike = new THREE.Mesh(spikeGeo, spikeMat);
          spike.castShadow = true;
          spike.position.set(Math.cos(sAngle) * sRadius + tc.pos.x, 4, Math.sin(sAngle) * sRadius + tc.pos.z);
          scene.add(spike);
        }
        const wallGeo = new THREE.TorusGeometry(50, 1.5, 4, 32);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.rotation.x = -Math.PI / 2;
        wall.position.set(tc.pos.x, 1.5, tc.pos.z);
        wall.castShadow = true;
        scene.add(wall);
      } else {
        const wallGeo = new THREE.TorusGeometry(55, 2, 4, 32);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x7a7a8a, roughness: 0.7 });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.rotation.x = -Math.PI / 2;
        wall.position.set(tc.pos.x, 2, tc.pos.z);
        wall.castShadow = true;
        scene.add(wall);

        const gateTowerGeo = new THREE.CylinderGeometry(2, 2.5, 12, 8);
        const gateTowerMat = new THREE.MeshStandardMaterial({ color: 0x8a8a9a, roughness: 0.6 });
        for (let g = 0; g < 2; g++) {
          const gt = new THREE.Mesh(gateTowerGeo, gateTowerMat);
          gt.castShadow = true;
          gt.position.set(tc.pos.x + (g === 0 ? -5 : 5), 6, tc.pos.z + 55);
          scene.add(gt);
        }
      }

      const nameCanvas = document.createElement('canvas');
      nameCanvas.width = 256; nameCanvas.height = 64;
      const ctx = nameCanvas.getContext('2d')!;
      ctx.font = 'bold 24px Oxanium, sans-serif';
      ctx.fillStyle = `#${tc.color.toString(16).padStart(6, '0')}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(tc.name, 128, 40);
      ctx.fillText(tc.name, 128, 40);
      const nameTexture = new THREE.CanvasTexture(nameCanvas);
      const nameMat = new THREE.SpriteMaterial({ map: nameTexture, transparent: true });
      const nameSprite = new THREE.Sprite(nameMat);
      nameSprite.position.set(tc.pos.x, 22, tc.pos.z);
      nameSprite.scale.set(20, 5, 1);
      scene.add(nameSprite);

      towns.push(town);
    }

    const heroData = HEROES.find(h => h.id === heroId);
    const heroColor = heroData ? new THREE.Color(CLASS_COLORS[heroData.heroClass] || '#888') : new THREE.Color(0x888888);

    const playerGroup = new THREE.Group();
    const capsuleGeo = new THREE.CapsuleGeometry(0.5, 1.2, 8, 16);
    const capsuleMat = new THREE.MeshStandardMaterial({ color: heroColor, roughness: 0.4, metalness: 0.3, emissive: heroColor, emissiveIntensity: 0.2 });
    const playerMesh = new THREE.Mesh(capsuleGeo, capsuleMat);
    playerMesh.castShadow = true; playerMesh.position.y = 1.1;
    playerGroup.add(playerMesh);

    const ringGeo = new THREE.RingGeometry(0.8, 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    playerGroup.add(ring);

    scene.add(playerGroup);

    let px = 0, pz = 0, facing = 0;
    const moveSpeed = 40;

    const onKeyDown = (e: KeyboardEvent) => { keysRef.current.add(e.key.toLowerCase()); };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const resize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', resize);

    let lastTime = performance.now();
    let animId = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const keys = keysRef.current;
      let dx = 0, dz = 0;
      if (keys.has('w') || keys.has('arrowup')) dz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dz += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      if (dx !== 0 || dz !== 0) {
        const len = Math.sqrt(dx * dx + dz * dz);
        dx /= len; dz /= len;
        px += dx * moveSpeed * dt;
        pz += dz * moveSpeed * dt;
        facing = Math.atan2(dx, dz);
        playerMesh.position.y = 1.1 + Math.sin(now * 0.008) * 0.1;
      }

      px = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, px));
      pz = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, pz));

      playerGroup.position.set(px, 0, pz);
      playerGroup.rotation.y = facing;

      camera.position.x += (px - 8 - camera.position.x) * 0.05;
      camera.position.y += (25 - camera.position.y) * 0.05;
      camera.position.z += (pz + 30 - camera.position.z) * 0.05;
      camera.lookAt(px, 0, pz);

      let nearTown: string | null = null;
      for (const tc of TOWN_CONFIGS) {
        const tdx = px - tc.pos.x, tdz = pz - tc.pos.z;
        if (Math.sqrt(tdx * tdx + tdz * tdz) < 60) {
          nearTown = tc.name;
          break;
        }
      }
      setCurrentTown(nearTown);
      setPlayerPos({ x: Math.round(px), z: Math.round(pz) });

      scene.traverse(obj => {
        if (obj.name === 'banner') {
          obj.rotation.y = Math.sin(now * 0.002 + obj.position.x) * 0.3;
        }
      });

      renderer.render(scene, camera);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [heroId]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" data-testid="open-world-page">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999, fontFamily: "'Oxanium', sans-serif" }}>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))',
            border: '2px solid #c5a059',
            borderRadius: 8,
            padding: '8px 24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          <div className="text-center">
            <div className="text-lg font-black text-[#c5a059]" data-testid="text-world-title">OPEN WORLD</div>
            <div className="text-xs text-gray-500">WASD to move | ESC to return</div>
          </div>
        </div>

        {heroInfo && (
          <div className="absolute top-4 left-4 pointer-events-auto"
            style={{
              background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))',
              border: '1px solid #c5a059',
              borderRadius: 6,
              padding: '8px 12px',
            }}
          >
            <div className="text-sm font-bold text-[#c5a059]" data-testid="text-hero-name">{heroInfo.name}</div>
            <div className="text-xs text-gray-400">{heroInfo.race} {heroInfo.heroClass}</div>
            <div className="text-[10px] text-gray-600 mt-1" data-testid="text-player-coords">
              Pos: {playerPos.x}, {playerPos.z}
            </div>
          </div>
        )}

        {currentTown && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto"
            style={{
              background: 'linear-gradient(to bottom, rgba(15,10,5,0.98), rgba(10,5,0,0.95))',
              border: '2px solid #c5a059',
              borderRadius: 8,
              padding: '12px 24px',
              boxShadow: '0 4px 30px rgba(0,0,0,0.9)',
            }}
            data-testid="panel-town-info"
          >
            <div className="text-center">
              <div className="text-lg font-black text-[#c5a059]">{currentTown}</div>
              <div className="text-xs text-gray-400 mt-1">
                {currentTown === 'Elvenhollow' && 'Ancient elven sanctuary among the great trees'}
                {currentTown === 'Ironjaw Keep' && 'Fortified orcish stronghold of blood and iron'}
                {currentTown === 'Valorheim' && 'Noble human citadel of honor and steel'}
              </div>
              <div className="text-[10px] text-[#c5a059] mt-2">Press E to enter</div>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex pointer-events-auto" style={{ gap: 8 }}>
          <button
            onClick={() => setLocation('/game')}
            className="text-xs font-bold px-4 py-2 rounded"
            style={{ background: 'rgba(197,160,89,0.2)', border: '1px solid #c5a059', color: '#c5a059', cursor: 'pointer' }}
            data-testid="button-to-moba"
          >
            MOBA MODE
          </button>
          <button
            onClick={() => setLocation('/')}
            className="text-xs font-bold px-4 py-2 rounded"
            style={{ background: 'rgba(197,160,89,0.2)', border: '1px solid #c5a059', color: '#c5a059', cursor: 'pointer' }}
            data-testid="button-to-home"
          >
            HOME
          </button>
        </div>

        <div className="absolute bottom-4 right-4 pointer-events-auto"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))',
            border: '1px solid #c5a059',
            borderRadius: 6,
            padding: 8,
            width: 150,
            height: 150,
          }}
          data-testid="panel-minimap"
        >
          <div className="relative w-full h-full">
            <div className="absolute inset-0 rounded" style={{ background: '#1a2a1a' }} />
            {TOWN_CONFIGS.map((tc, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  background: `#${tc.color.toString(16).padStart(6, '0')}`,
                  left: `${((tc.pos.x + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`,
                  top: `${((tc.pos.z + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: `0 0 6px #${tc.color.toString(16).padStart(6, '0')}`,
                }}
                title={tc.name}
              />
            ))}
            <div
              className="absolute w-2 h-2 rounded-full bg-yellow-400"
              style={{
                left: `${((playerPos.x + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`,
                top: `${((playerPos.z + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`,
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 8px #ffd700',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
