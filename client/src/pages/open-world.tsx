import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import * as THREE from 'three';
import { HEROES, HeroData, CLASS_COLORS, RACE_COLORS } from '@/game/types';
import { loadOBJ } from '@/game/model-loader';
import {
  OpenWorldMonster, OpenWorldPlayerState, OpenWorldFloatingText,
  DungeonEntrance, SafeHouse, OpenWorldZone,
  MONSTER_TEMPLATES, WORLD_ZONES, DUNGEON_ENTRANCE_CONFIGS, SAFE_HOUSE_CONFIG,
  getMonsterTemplate, getZoneAtPosition, distXZ, spawnMonster,
} from '@/game/open-world-types';

const WORLD_SIZE = 1000;
const PLAYER_MOVE_SPEED = 45;
const PLAYER_ATTACK_RANGE = 12;
const PLAYER_ATTACK_COOLDOWN = 1.0;
const RESPAWN_COOLDOWN = 3.0;
const XP_PER_LEVEL = [0, 100, 250, 500, 800, 1200, 1700, 2400, 3200, 4200, 999999];

const TOWN_CONFIGS = [
  { name: 'Elvenhollow', race: 'Elf', pos: new THREE.Vector3(-200, 0, -200), color: 0x22d3ee },
  { name: 'Ironjaw Keep', race: 'Orc', pos: new THREE.Vector3(200, 0, 150), color: 0x65a30d },
  { name: 'Valorheim', race: 'Human', pos: new THREE.Vector3(-50, 0, 250), color: 0x94a3b8 },
];

export default function OpenWorldPage() {
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTown, setCurrentTown] = useState<string | null>(null);
  const [currentZone, setCurrentZone] = useState<string>('Greenhollow');
  const [zoneLevel, setZoneLevel] = useState(1);
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 });
  const [heroInfo, setHeroInfo] = useState<HeroData | null>(null);
  const [playerState, setPlayerState] = useState<OpenWorldPlayerState>({
    hp: 200, maxHp: 200, mp: 100, maxMp: 100,
    level: 1, xp: 0, xpToNext: 100, gold: 0,
    atk: 20, def: 10, spd: 60, kills: 0,
    inCombat: false, attackTimer: 0, attackCooldown: PLAYER_ATTACK_COOLDOWN,
    targetMonsterId: null,
  });
  const [nearDungeon, setNearDungeon] = useState<string | null>(null);
  const [nearDungeonLevel, setNearDungeonLevel] = useState(0);
  const [inSafeHouse, setInSafeHouse] = useState(false);
  const [combatLog, setCombatLog] = useState<{ text: string; color: string }[]>([]);
  const [targetMonsterInfo, setTargetMonsterInfo] = useState<{ name: string; hp: number; maxHp: number; isBoss: boolean } | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const heroId = parseInt(localStorage.getItem('grudge_hero_id') || '-1');

  useEffect(() => {
    if (heroId < 0) { setLocation('/'); return; }
    const hd = HEROES.find(h => h.id === heroId);
    if (hd) {
      setHeroInfo(hd);
      setPlayerState(prev => ({ ...prev, hp: hd.hp, maxHp: hd.hp, mp: hd.mp, maxMp: hd.mp, atk: hd.atk, def: hd.def, spd: hd.spd }));
    }
  }, [heroId, setLocation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ═══ RENDERER ═══
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
    scene.fog = new THREE.FogExp2(0x1a2a3a, 0.0015);
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 3000);
    camera.position.set(0, 30, 35);

    // ═══ LIGHTING ═══
    scene.add(new THREE.AmbientLight(0x556677, 0.5));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362a1a, 0.6));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
    sun.position.set(100, 200, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -500; sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500; sun.shadow.camera.bottom = -500;
    sun.shadow.camera.far = 800;
    scene.add(sun);

    // ═══ GROUND ═══
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 200, 200);
    groundGeo.rotateX(-Math.PI / 2);
    const positions = groundGeo.attributes.position;
    const gColors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      positions.setY(i, Math.sin(x * 0.015) * Math.cos(z * 0.012) * 4 + Math.sin(x * 0.04 + z * 0.03) * 2);
      const zone = getZoneAtPosition(x, z);
      if (zone) {
        const c = new THREE.Color(zone.groundColor); const v = 0.8 + Math.random() * 0.2;
        gColors[i * 3] = c.r * v; gColors[i * 3 + 1] = c.g * v; gColors[i * 3 + 2] = c.b * v;
      } else {
        const v = 0.15 + Math.random() * 0.08;
        gColors[i * 3] = v + 0.05; gColors[i * 3 + 1] = v + 0.2; gColors[i * 3 + 2] = v;
      }
    }
    groundGeo.computeVertexNormals();
    groundGeo.setAttribute('color', new THREE.BufferAttribute(gColors, 3));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 }));
    ground.receiveShadow = true;
    scene.add(ground);

    // ═══ ROADS ═══
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.9 });
    for (let i = 0; i < TOWN_CONFIGS.length; i++) {
      for (let j = i + 1; j < TOWN_CONFIGS.length; j++) {
        const a = TOWN_CONFIGS[i].pos, b = TOWN_CONFIGS[j].pos;
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        const rg = new THREE.PlaneGeometry(len, 8); rg.rotateX(-Math.PI / 2);
        const road = new THREE.Mesh(rg, roadMat);
        road.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2);
        road.rotation.y = -Math.atan2(dz, dx); road.receiveShadow = true;
        scene.add(road);
      }
    }

    // ═══ TOWNS ═══
    for (const tc of TOWN_CONFIGS) {
      const tg = new THREE.Group(); tg.position.copy(tc.pos); scene.add(tg);
      const color = new THREE.Color(tc.color);
      const hall = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 2, 8), new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.8 }));
      hall.castShadow = true; hall.position.y = 1; tg.add(hall);
      const bd = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 8), new THREE.MeshStandardMaterial({ color: tc.race === 'Elf' ? 0x4a7a5a : tc.race === 'Orc' ? 0x5a4a3a : 0x6a6a7a, roughness: 0.7 }));
      bd.castShadow = true; bd.position.y = 6; tg.add(bd);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(8, 5, tc.race === 'Elf' ? 6 : 4), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 }));
      rf.castShadow = true; rf.position.y = 12.5; tg.add(rf);
      const lt = new THREE.PointLight(tc.color, 1.5, 40); lt.position.y = 10; tg.add(lt);
      for (let h = 0; h < 6; h++) {
        const a = (h / 6) * Math.PI * 2, r = 30 + Math.random() * 20;
        const hg = new THREE.Group(); hg.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        const hs = 3 + Math.random() * 2;
        const w = new THREE.Mesh(new THREE.BoxGeometry(hs, hs * 1.2, hs), new THREE.MeshStandardMaterial({ color: tc.race === 'Elf' ? 0x5a7a5a : tc.race === 'Orc' ? 0x5a4030 : 0x7a7a8a, roughness: 0.85 }));
        w.castShadow = true; w.position.y = hs * 0.6; hg.add(w);
        const hr2 = new THREE.Mesh(new THREE.ConeGeometry(hs * 0.8, hs * 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x5a5a6a, roughness: 0.6 }));
        hr2.castShadow = true; hr2.position.y = hs * 1.35; hg.add(hr2);
        tg.add(hg);
      }
      // label
      const nc = document.createElement('canvas'); nc.width = 256; nc.height = 64;
      const nctx = nc.getContext('2d')!;
      nctx.font = 'bold 24px Oxanium, sans-serif';
      nctx.fillStyle = `#${tc.color.toString(16).padStart(6, '0')}`;
      nctx.textAlign = 'center'; nctx.strokeStyle = '#000'; nctx.lineWidth = 3;
      nctx.strokeText(tc.name, 128, 40); nctx.fillText(tc.name, 128, 40);
      const ns = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nc), transparent: true }));
      ns.position.set(tc.pos.x, 22, tc.pos.z); ns.scale.set(20, 5, 1); scene.add(ns);
    }

    // ═══ TREES ═══
    const trkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
    const leafColors = [0x1a8a4a, 0x2a7a3a, 0x1a6a3a, 0x3a8a5a];
    for (let t = 0; t < 200; t++) {
      const zone = WORLD_ZONES[Math.floor(Math.random() * WORLD_ZONES.length)];
      if (zone.biome !== 'forest' && zone.biome !== 'grassland') continue;
      const a = Math.random() * Math.PI * 2, d = Math.random() * zone.radius * 0.9;
      const tx = zone.centerX + Math.cos(a) * d, tz = zone.centerZ + Math.sin(a) * d;
      if (TOWN_CONFIGS.some(tc => distXZ(tx, tz, tc.pos.x, tc.pos.z) < 70) || distXZ(tx, tz, SAFE_HOUSE_CONFIG.x, SAFE_HOUSE_CONFIG.z) < 35) continue;
      const th = 5 + Math.random() * 6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, th, 6), trkMat);
      trunk.castShadow = true; trunk.position.set(tx, th / 2, tz); scene.add(trunk);
      const cs = 2.5 + Math.random() * 2.5;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(cs, 8, 6), new THREE.MeshStandardMaterial({ color: leafColors[Math.floor(Math.random() * leafColors.length)], roughness: 0.8 }));
      crown.castShadow = true; crown.position.set(tx, th + cs * 0.5, tz); scene.add(crown);
    }

    // ═══ ROCKS ═══
    const rkMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9, metalness: 0.1 });
    for (let r = 0; r < 60; r++) {
      const rx = (Math.random() - 0.5) * WORLD_SIZE * 1.6, rz = (Math.random() - 0.5) * WORLD_SIZE * 1.6;
      const sz = 1 + Math.random() * 3;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), rkMat);
      rock.castShadow = true; rock.position.set(rx, sz * 0.3, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random()); scene.add(rock);
    }

    // ═══ SAFE HOUSE ═══
    const shg = new THREE.Group(); shg.position.set(SAFE_HOUSE_CONFIG.x, 0, SAFE_HOUSE_CONFIG.z); scene.add(shg);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.8 });
    const wGeo = new THREE.BoxGeometry(14, 6, 0.5);
    [-7, 7].forEach(zz => { const w = new THREE.Mesh(wGeo, wMat); w.castShadow = true; w.position.set(0, 3, zz); shg.add(w); });
    const sideWall = new THREE.Mesh(wGeo, wMat); sideWall.castShadow = true; sideWall.rotation.y = Math.PI / 2; sideWall.position.set(-7, 3, 0); shg.add(sideWall);
    // Door wall with gap
    [4.5, -4.5].forEach(yy => { const dw = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.5), wMat); dw.castShadow = true; dw.position.set(yy, 3, 0); dw.rotation.y = Math.PI / 2; shg.add(dw); });
    // For right wall, use the door segments above at x=7 side
    const rightWallTop = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 0.5), wMat);
    rightWallTop.castShadow = true; rightWallTop.position.set(0, 5, 0); rightWallTop.rotation.y = Math.PI / 2;
    shg.add(rightWallTop);
    // Roof
    const srf = new THREE.Mesh(new THREE.ConeGeometry(11, 4, 4), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.7 }));
    srf.castShadow = true; srf.position.y = 8; srf.rotation.y = Math.PI / 4; shg.add(srf);
    // Floor
    const flGeo = new THREE.PlaneGeometry(14, 14); flGeo.rotateX(-Math.PI / 2);
    shg.add(new THREE.Mesh(flGeo, new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95 })));
    // Campfire
    const fireLight = new THREE.PointLight(0xff6622, 2.5, 25); fireLight.position.set(0, 2, 0); shg.add(fireLight);
    const fireMesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 6), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
    fireMesh.position.set(0, 0.75, 0); shg.add(fireMesh);
    // Labels
    const mkLabel = (text: string, color: string, x: number, y: number, z: number, sx: number) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.font = 'bold 20px Oxanium, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(text, 128, 40); ctx.fillText(text, 128, 40);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      s.position.set(x, y, z); s.scale.set(sx, sx / 4, 1); scene.add(s);
    };
    mkLabel('Safe House', '#4ade80', SAFE_HOUSE_CONFIG.x, 14, SAFE_HOUSE_CONFIG.z, 15);
    // Healing aura
    const auraMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    const auraRing = new THREE.Mesh(new THREE.RingGeometry(SAFE_HOUSE_CONFIG.radius - 1, SAFE_HOUSE_CONFIG.radius, 32), auraMat);
    auraRing.rotation.x = -Math.PI / 2; auraRing.position.set(SAFE_HOUSE_CONFIG.x, 0.1, SAFE_HOUSE_CONFIG.z);
    scene.add(auraRing);

    // ═══ DUNGEON ENTRANCES ═══
    const dungeonEntrances: DungeonEntrance[] = [];
    for (const dc of DUNGEON_ENTRANCE_CONFIGS) {
      const pg = new THREE.Group(); pg.position.set(dc.x, 0, dc.z); scene.add(pg);
      const archMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.7 });
      const pl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 10, 1.5), archMat); pl.castShadow = true; pl.position.set(-4, 5, 0); pg.add(pl);
      const pr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 10, 1.5), archMat); pr.castShadow = true; pr.position.set(4, 5, 0); pg.add(pr);
      const at = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 1.5), archMat); at.castShadow = true; at.position.y = 10.5; pg.add(at);
      const portalMat = new THREE.MeshBasicMaterial({ color: dc.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), portalMat); portal.position.y = 5.5; portal.name = 'portal_vortex'; pg.add(portal);
      pg.add(new THREE.PointLight(dc.color, 2, 40).translateY(6));
      // Label
      const lc = document.createElement('canvas'); lc.width = 256; lc.height = 64;
      const lctx = lc.getContext('2d')!;
      lctx.font = 'bold 18px Oxanium, sans-serif'; lctx.fillStyle = `#${dc.color.toString(16).padStart(6, '0')}`; lctx.textAlign = 'center';
      lctx.strokeStyle = '#000'; lctx.lineWidth = 3;
      lctx.strokeText(dc.name, 128, 30); lctx.fillText(dc.name, 128, 30);
      lctx.font = '14px Oxanium, sans-serif'; lctx.fillStyle = '#aaa';
      lctx.strokeText(`Level ${dc.dungeonLevel}+`, 128, 52); lctx.fillText(`Level ${dc.dungeonLevel}+`, 128, 52);
      const ls = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true }));
      ls.position.set(0, 14, 0); ls.scale.set(16, 4, 1); pg.add(ls);
      dungeonEntrances.push({ ...dc, portalMesh: pg });
    }

    // ═══ PLAYER ═══
    const heroData = HEROES.find(h => h.id === heroId);
    const hColor = heroData ? new THREE.Color(CLASS_COLORS[heroData.heroClass] || '#888') : new THREE.Color(0x888888);
    const playerGroup = new THREE.Group();
    const pMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 8, 16), new THREE.MeshStandardMaterial({ color: hColor, roughness: 0.4, metalness: 0.3, emissive: hColor, emissiveIntensity: 0.2 }));
    pMesh.castShadow = true; pMesh.position.y = 1.1; playerGroup.add(pMesh);
    const pRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    pRing.rotation.x = -Math.PI / 2; pRing.position.y = 0.02; playerGroup.add(pRing);
    scene.add(playerGroup);

    // ═══ MONSTERS ═══
    const monsters: OpenWorldMonster[] = [];
    const meshCache = new Map<string, THREE.Group>();
    const ftSprites: THREE.Sprite[] = [];

    for (const zone of WORLD_ZONES) {
      for (let m = 0; m < zone.maxMonsters; m++) {
        const tid = zone.spawnTable[Math.floor(Math.random() * zone.spawnTable.length)];
        const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * (zone.radius - 50);
        const mon = spawnMonster(tid, zone.centerX + Math.cos(a) * d, zone.centerZ + Math.sin(a) * d);
        if (mon) monsters.push(mon);
      }
    }
    for (const de of DUNGEON_ENTRANCE_CONFIGS) {
      if (de.bossGuardId) { const b = spawnMonster(de.bossGuardId, de.x + 15, de.z + 15); if (b) monsters.push(b); }
    }

    // Load and create monster meshes
    async function loadMesh(tid: string): Promise<THREE.Group | null> {
      if (meshCache.has(tid)) return meshCache.get(tid)!.clone();
      const tmpl = getMonsterTemplate(tid);
      if (!tmpl) return null;
      try {
        const model = await loadOBJ(tmpl.modelPath, tmpl.mtlPath, tmpl.texturePath);
        model.scene.scale.setScalar(tmpl.scale);
        model.scene.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true; });
        meshCache.set(tid, model.scene); return model.scene.clone();
      } catch {
        const fb = new THREE.Group();
        const bs = tmpl.isBoss ? 3 : 1.5;
        const bx = new THREE.Mesh(new THREE.BoxGeometry(bs, bs * 1.5, bs), new THREE.MeshStandardMaterial({ color: tmpl.color, roughness: 0.5, emissive: new THREE.Color(tmpl.color), emissiveIntensity: 0.3 }));
        bx.castShadow = true; bx.position.y = bs * 0.75; fb.add(bx);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const eg = new THREE.SphereGeometry(0.15, 6, 4);
        const eL = new THREE.Mesh(eg, eyeMat); eL.position.set(-0.3, bs * 1.2, bs * 0.5); fb.add(eL);
        const eR = new THREE.Mesh(eg, eyeMat); eR.position.set(0.3, bs * 1.2, bs * 0.5); fb.add(eR);
        meshCache.set(tid, fb); return fb.clone();
      }
    }

    for (const mon of monsters) {
      loadMesh(mon.templateId).then(mesh => {
        if (mesh && !mon.mesh) {
          mon.mesh = mesh; mesh.position.set(mon.x, 0, mon.z); scene.add(mesh);
          const tmpl = getMonsterTemplate(mon.templateId);
          // HP bar
          const hc = document.createElement('canvas'); hc.width = 64; hc.height = 8;
          const ht = new THREE.CanvasTexture(hc);
          const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: ht, transparent: true }));
          hs.position.y = tmpl?.isBoss ? 6 : 3.5; hs.scale.set(tmpl?.isBoss ? 6 : 3, 0.4, 1);
          hs.name = 'hp_bar'; hs.userData.canvas = hc; hs.userData.texture = ht; mesh.add(hs);
          // Name
          const nc2 = document.createElement('canvas'); nc2.width = 128; nc2.height = 24;
          const nctx2 = nc2.getContext('2d')!;
          nctx2.font = 'bold 14px Oxanium, sans-serif'; nctx2.fillStyle = tmpl?.isBoss ? '#ff4444' : '#ff8844';
          nctx2.textAlign = 'center'; nctx2.strokeStyle = '#000'; nctx2.lineWidth = 2;
          nctx2.strokeText(tmpl?.name || '???', 64, 16); nctx2.fillText(tmpl?.name || '???', 64, 16);
          const ns2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nc2), transparent: true }));
          ns2.position.y = (tmpl?.isBoss ? 6 : 3.5) + 0.6; ns2.scale.set(tmpl?.isBoss ? 8 : 4, 0.8, 1); mesh.add(ns2);
        }
      });
    }

    function addFT(x: number, y: number, z: number, text: string, color: string) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32;
      const ctx = c.getContext('2d')!;
      ctx.font = 'bold 20px Oxanium, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeText(text, 64, 24); ctx.fillText(text, 64, 24);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      s.position.set(x, y + 3, z); s.scale.set(4, 1, 1); s.userData.life = 1.2; s.userData.vy = 8;
      scene.add(s); ftSprites.push(s);
    }

    // ═══ GAME STATE ═══
    let px = 0, pz = 0, facing = 0;
    const ps: OpenWorldPlayerState = {
      hp: heroData?.hp || 200, maxHp: heroData?.hp || 200, mp: heroData?.mp || 100, maxMp: heroData?.mp || 100,
      level: 1, xp: 0, xpToNext: 100, gold: 0, atk: heroData?.atk || 20, def: heroData?.def || 10, spd: heroData?.spd || 60,
      kills: 0, inCombat: false, attackTimer: 0, attackCooldown: PLAYER_ATTACK_COOLDOWN, targetMonsterId: null,
    };
    const logs: { text: string; color: string }[] = [];
    const addLog = (t: string, c: string) => { logs.push({ text: t, color: c }); if (logs.length > 20) logs.shift(); };

    function playerAttack(mon: OpenWorldMonster) {
      if (ps.attackTimer > 0 || mon.state === 'dead') return;
      const dmg = Math.round(Math.max(1, ps.atk - mon.def * 0.5) * (0.9 + Math.random() * 0.2));
      mon.hp -= dmg; mon.hitFlash = 0.2; ps.attackTimer = ps.attackCooldown; ps.inCombat = true;
      addFT(mon.x, 2, mon.z, `-${dmg}`, '#ff4444');
      addLog(`You hit ${getMonsterTemplate(mon.templateId)?.name} for ${dmg}`, '#ffd700');
      if (mon.state !== 'dead') { mon.state = 'chase'; mon.targetId = -1; }
      if (mon.hp <= 0) {
        mon.hp = 0; mon.state = 'dead'; mon.deathTimer = RESPAWN_COOLDOWN;
        const tmpl = getMonsterTemplate(mon.templateId);
        ps.xp += tmpl?.xpValue || 0; ps.gold += tmpl?.goldValue || 0; ps.kills++;
        addLog(`Killed ${tmpl?.name}! +${tmpl?.xpValue}xp +${tmpl?.goldValue}g`, '#4ade80');
        addFT(mon.x, 3, mon.z, `+${tmpl?.xpValue}xp`, '#4ade80');
        while (ps.xp >= ps.xpToNext && ps.level < 10) {
          ps.xp -= ps.xpToNext; ps.level++;
          ps.xpToNext = XP_PER_LEVEL[ps.level] || 999999;
          ps.maxHp += 25; ps.hp = ps.maxHp; ps.maxMp += 15; ps.mp = ps.maxMp; ps.atk += 3; ps.def += 2;
          addLog(`LEVEL UP! Now level ${ps.level}`, '#ffd700');
          addFT(px, 4, pz, `LEVEL ${ps.level}!`, '#ffd700');
        }
        if (mon.mesh) mon.mesh.visible = false;
      }
    }

    function monAttack(mon: OpenWorldMonster) {
      if (mon.attackTimer > 0) return;
      const dmg = Math.round(Math.max(1, mon.atk - ps.def * 0.5) * (0.9 + Math.random() * 0.2));
      ps.hp -= dmg; mon.attackTimer = mon.attackCooldown;
      addFT(px, 3, pz, `-${dmg}`, '#ff6666');
      addLog(`${getMonsterTemplate(mon.templateId)?.name} hit you for ${dmg}`, '#ef4444');
      if (ps.hp <= 0) {
        ps.hp = 0;
        addLog('Defeated! Respawning at safe house...', '#ff4444');
        px = SAFE_HOUSE_CONFIG.x; pz = SAFE_HOUSE_CONFIG.z;
        ps.hp = ps.maxHp * 0.5; ps.mp = ps.maxMp * 0.5; ps.inCombat = false; ps.targetMonsterId = null;
      }
    }

    function updateMon(mon: OpenWorldMonster, dt: number) {
      if (mon.state === 'dead') {
        mon.deathTimer -= dt;
        if (mon.deathTimer <= 0) {
          mon.hp = mon.maxHp; mon.state = 'idle'; mon.x = mon.homeX; mon.z = mon.homeZ; mon.targetId = null;
          if (mon.mesh) { mon.mesh.visible = true; mon.mesh.position.set(mon.x, 0, mon.z); }
        }
        return;
      }
      mon.attackTimer = Math.max(0, mon.attackTimer - dt);
      mon.hitFlash = Math.max(0, mon.hitFlash - dt);
      const dp = distXZ(mon.x, mon.z, px, pz), dh = distXZ(mon.x, mon.z, mon.homeX, mon.homeZ);

      if (mon.state === 'idle') {
        mon.patrolAngle += dt * 0.3;
        if (dp < mon.aggroRange && ps.hp > 0) { mon.state = 'chase'; mon.targetId = -1; }
        if (Math.random() < dt * 0.15) mon.state = 'patrol';
      } else if (mon.state === 'patrol') {
        const ptx = mon.homeX + Math.cos(mon.patrolAngle) * mon.patrolRadius;
        const ptz = mon.homeZ + Math.sin(mon.patrolAngle) * mon.patrolRadius;
        const pdx = ptx - mon.x, pdz = ptz - mon.z, pl = Math.sqrt(pdx * pdx + pdz * pdz);
        if (pl > 1) { mon.x += (pdx / pl) * mon.spd * 0.3 * dt; mon.z += (pdz / pl) * mon.spd * 0.3 * dt; mon.facing = Math.atan2(pdx, pdz); }
        mon.patrolAngle += dt * 0.5;
        if (dp < mon.aggroRange && ps.hp > 0) { mon.state = 'chase'; mon.targetId = -1; }
        if (Math.random() < dt * 0.1) mon.state = 'idle';
      } else if (mon.state === 'chase') {
        if (dh > mon.leashRange) { mon.state = 'retreat'; }
        else if (dp < mon.attackRange) { mon.state = 'attack'; }
        else if (dp > mon.aggroRange * 1.5) { mon.state = 'retreat'; }
        else { const cdx = px - mon.x, cdz = pz - mon.z, cl = Math.sqrt(cdx * cdx + cdz * cdz); if (cl > 0) { mon.x += (cdx / cl) * mon.spd * dt; mon.z += (cdz / cl) * mon.spd * dt; mon.facing = Math.atan2(cdx, cdz); } }
      } else if (mon.state === 'attack') {
        if (dp > mon.attackRange * 1.5) mon.state = 'chase';
        else { mon.facing = Math.atan2(px - mon.x, pz - mon.z); monAttack(mon); }
        if (dh > mon.leashRange) mon.state = 'retreat';
      } else if (mon.state === 'retreat') {
        const rdx = mon.homeX - mon.x, rdz = mon.homeZ - mon.z, rl = Math.sqrt(rdx * rdx + rdz * rdz);
        if (rl > 2) { mon.x += (rdx / rl) * mon.spd * 1.2 * dt; mon.z += (rdz / rl) * mon.spd * 1.2 * dt; mon.facing = Math.atan2(rdx, rdz); }
        else { mon.state = 'idle'; mon.hp = Math.min(mon.maxHp, mon.hp + mon.maxHp * 0.3); }
      }

      if (mon.mesh && mon.state !== 'dead') {
        mon.mesh.position.set(mon.x, 0, mon.z); mon.mesh.rotation.y = mon.facing;
        mon.mesh.traverse(child => {
          if (child.name === 'hp_bar') {
            const cv = child.userData.canvas as HTMLCanvasElement;
            const cx = cv.getContext('2d')!; cx.clearRect(0, 0, 64, 8);
            cx.fillStyle = '#300'; cx.fillRect(0, 0, 64, 8);
            const pct = mon.hp / mon.maxHp;
            cx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#ef4444';
            cx.fillRect(0, 0, 64 * pct, 8); cx.strokeStyle = '#000'; cx.strokeRect(0, 0, 64, 8);
            (child.userData.texture as THREE.CanvasTexture).needsUpdate = true;
          }
        });
      }
    }

    // ═══ INPUT ═══
    // WASD = move | 1234 = abilities | LMB = light attack | RMB = heavy melee | F = interact/dungeon | ESC = home
    const HEAVY_ATTACK_MULT = 2.0;
    const HEAVY_ATTACK_COOLDOWN = 1.8;
    let heavyAttackTimer = 0;

    const findClosestMonster = (): OpenWorldMonster | null => {
      let closest: OpenWorldMonster | null = null, closestD = PLAYER_ATTACK_RANGE;
      for (const m of monsters) { if (m.state === 'dead') continue; const d = distXZ(px, pz, m.x, m.z); if (d < closestD) { closest = m; closestD = d; } }
      return closest;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      const key = e.key.toLowerCase();
      // 1-4: abilities (placeholder for future ability system)
      if (key === '1' || key === '2' || key === '3' || key === '4') {
        e.preventDefault();
        addLog(`Ability ${key} used`, '#60a5fa');
      }
      // F: interact with dungeon entrance
      if (key === 'f') {
        for (const de of dungeonEntrances) {
          if (distXZ(px, pz, de.x, de.z) < 25) { localStorage.setItem('grudge_dungeon_level', de.dungeonLevel.toString()); setLocation('/dungeon'); return; }
        }
      }
      if (e.key === 'Escape') setLocation('/');
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };
    const raycaster = new THREE.Raycaster(), mVec = new THREE.Vector2();

    // LMB = light attack (select + quick hit)
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      mVec.x = (e.clientX / container.clientWidth) * 2 - 1;
      mVec.y = -(e.clientY / container.clientHeight) * 2 + 1;
      raycaster.setFromCamera(mVec, camera);
      let cm: OpenWorldMonster | null = null, cd = Infinity;
      for (const m of monsters) {
        if (m.state === 'dead' || !m.mesh) continue;
        const ints = raycaster.intersectObject(m.mesh, true);
        if (ints.length > 0 && ints[0].distance < cd) { cm = m; cd = ints[0].distance; }
      }
      if (cm) { ps.targetMonsterId = cm.id; if (distXZ(px, pz, cm.x, cm.z) < PLAYER_ATTACK_RANGE) playerAttack(cm); }
      else { const cl = findClosestMonster(); if (cl) { ps.targetMonsterId = cl.id; playerAttack(cl); } else ps.targetMonsterId = null; }
    };

    // RMB = heavy melee attack (more damage, longer cooldown)
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (heavyAttackTimer > 0) return;
      const target = ps.targetMonsterId !== null ? monsters.find(m => m.id === ps.targetMonsterId && m.state !== 'dead') : findClosestMonster();
      if (target && distXZ(px, pz, target.x, target.z) < PLAYER_ATTACK_RANGE * 1.2) {
        const dmg = Math.round(Math.max(1, ps.atk * HEAVY_ATTACK_MULT - target.def * 0.3) * (0.9 + Math.random() * 0.2));
        target.hp -= dmg; target.hitFlash = 0.3; heavyAttackTimer = HEAVY_ATTACK_COOLDOWN; ps.inCombat = true;
        addFT(target.x, 2, target.z, `-${dmg}!`, '#ff2222');
        addLog(`HEAVY HIT ${getMonsterTemplate(target.templateId)?.name} for ${dmg}`, '#ef4444');
        if (target.state !== 'dead') { target.state = 'chase'; target.targetId = -1; }
        if (target.hp <= 0) {
          target.hp = 0; target.state = 'dead'; target.deathTimer = 3;
          const tmpl = getMonsterTemplate(target.templateId);
          ps.xp += tmpl?.xpValue || 0; ps.gold += tmpl?.goldValue || 0; ps.kills++;
          addLog(`Killed ${tmpl?.name}! +${tmpl?.xpValue}xp +${tmpl?.goldValue}g`, '#4ade80');
          addFT(target.x, 3, target.z, `+${tmpl?.xpValue}xp`, '#4ade80');
          while (ps.xp >= ps.xpToNext && ps.level < 10) {
            ps.xp -= ps.xpToNext; ps.level++;
            ps.xpToNext = XP_PER_LEVEL[ps.level] || 999999;
            ps.maxHp += 25; ps.hp = ps.maxHp; ps.maxMp += 15; ps.mp = ps.maxMp; ps.atk += 3; ps.def += 2;
            addLog(`LEVEL UP! Now level ${ps.level}`, '#ffd700');
          }
          if (target.mesh) target.mesh.visible = false;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    container.addEventListener('click', onClick);
    container.addEventListener('contextmenu', onContextMenu);
    const resize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); };
    window.addEventListener('resize', resize);

    // ═══ LOOP ═══
    let lastTime = performance.now(), animId = 0, hudT = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
      const keys = keysRef.current;
      let dx = 0, dz = 0;
      if (keys.has('w') || keys.has('arrowup')) dz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dz += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (dx !== 0 || dz !== 0) {
        const l = Math.sqrt(dx * dx + dz * dz); dx /= l; dz /= l;
        px += dx * PLAYER_MOVE_SPEED * dt; pz += dz * PLAYER_MOVE_SPEED * dt;
        facing = Math.atan2(dx, dz);
        pMesh.position.y = 1.1 + Math.sin(now * 0.008) * 0.1;
      }
      px = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, px));
      pz = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, pz));
      playerGroup.position.set(px, 0, pz); playerGroup.rotation.y = facing;
      camera.position.x += (px - 8 - camera.position.x) * 0.05;
      camera.position.y += (30 - camera.position.y) * 0.05;
      camera.position.z += (pz + 35 - camera.position.z) * 0.05;
      camera.lookAt(px, 0, pz);

      ps.attackTimer = Math.max(0, ps.attackTimer - dt);
      heavyAttackTimer = Math.max(0, heavyAttackTimer - dt);
      if (ps.targetMonsterId !== null) {
        const t = monsters.find(m => m.id === ps.targetMonsterId);
        if (t && t.state !== 'dead' && distXZ(px, pz, t.x, t.z) < PLAYER_ATTACK_RANGE) playerAttack(t);
      }
      const inSafe = distXZ(px, pz, SAFE_HOUSE_CONFIG.x, SAFE_HOUSE_CONFIG.z) < SAFE_HOUSE_CONFIG.radius;
      if (inSafe && ps.hp < ps.maxHp) { ps.hp = Math.min(ps.maxHp, ps.hp + SAFE_HOUSE_CONFIG.healRate * dt); ps.mp = Math.min(ps.maxMp, ps.mp + SAFE_HOUSE_CONFIG.healRate * 0.5 * dt); }
      if (!ps.inCombat) { ps.hp = Math.min(ps.maxHp, ps.hp + 2 * dt); ps.mp = Math.min(ps.maxMp, ps.mp + 3 * dt); }
      let anyAggro = false;
      for (const m of monsters) { updateMon(m, dt); if (m.state === 'chase' || m.state === 'attack') anyAggro = true; }
      ps.inCombat = anyAggro;

      // Floating texts
      for (let i = ftSprites.length - 1; i >= 0; i--) {
        const s = ftSprites[i]; s.userData.life -= dt; s.position.y += s.userData.vy * dt; s.userData.vy *= 0.95;
        if (s.material instanceof THREE.SpriteMaterial) s.material.opacity = Math.max(0, s.userData.life / 1.2);
        if (s.userData.life <= 0) { scene.remove(s); ftSprites.splice(i, 1); }
      }
      // Portal anim
      for (const de of dungeonEntrances) {
        de.portalMesh?.traverse(o => {
          if (o.name === 'portal_vortex') { o.rotation.z = now * 0.001; if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) o.material.opacity = 0.4 + Math.sin(now * 0.003) * 0.2; }
        });
      }
      fireLight.intensity = 2 + Math.sin(now * 0.01) * 0.5;
      fireMesh.scale.y = 1 + Math.sin(now * 0.015) * 0.15;
      auraMat.opacity = 0.15 + Math.sin(now * 0.002) * 0.05;

      const zone = getZoneAtPosition(px, pz);
      let nTown: string | null = null;
      for (const tc of TOWN_CONFIGS) { if (distXZ(px, pz, tc.pos.x, tc.pos.z) < 60) { nTown = tc.name; break; } }
      let nDung: string | null = null, nDungLvl = 0;
      for (const de of dungeonEntrances) { if (distXZ(px, pz, de.x, de.z) < 25) { nDung = de.name; nDungLvl = de.dungeonLevel; break; } }
      let tInfo: typeof targetMonsterInfo = null;
      if (ps.targetMonsterId !== null) {
        const tm = monsters.find(m => m.id === ps.targetMonsterId);
        if (tm && tm.state !== 'dead') { const tmpl = getMonsterTemplate(tm.templateId); tInfo = { name: tmpl?.name || '???', hp: tm.hp, maxHp: tm.maxHp, isBoss: tmpl?.isBoss || false }; }
      }

      hudT += dt;
      if (hudT > 0.08) {
        hudT = 0;
        setCurrentTown(nTown); setCurrentZone(zone?.name || 'Wilderness'); setZoneLevel(zone?.level || 0);
        setPlayerPos({ x: Math.round(px), z: Math.round(pz) });
        setNearDungeon(nDung); setNearDungeonLevel(nDungLvl); setInSafeHouse(inSafe);
        setTargetMonsterInfo(tInfo); setPlayerState({ ...ps }); setCombatLog([...logs.slice(-8)]);
      }
      renderer.render(scene, camera);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); container.removeEventListener('click', onClick); container.removeEventListener('contextmenu', onContextMenu); window.removeEventListener('resize', resize); renderer.dispose(); if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement); };
  }, [heroId]);

  const hpPct = playerState.maxHp > 0 ? (playerState.hp / playerState.maxHp) * 100 : 0;
  const mpPct = playerState.maxMp > 0 ? (playerState.mp / playerState.maxMp) * 100 : 0;
  const xpPct = playerState.xpToNext > 0 ? (playerState.xp / playerState.xpToNext) * 100 : 0;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" data-testid="open-world-page">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999, fontFamily: "'Oxanium', sans-serif" }}>
        {/* Top Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))', border: '2px solid #c5a059', borderRadius: 8, padding: '8px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
          <div className="text-center">
            <div className="text-lg font-black text-[#c5a059]">{currentZone}</div>
            <div className="text-xs text-gray-500">Level {zoneLevel} Zone | WASD move | LMB light | RMB heavy | 1-4 abilities | F enter dungeon | ESC home</div>
          </div>
        </div>
        {/* Hero Info */}
        {heroInfo && (
          <div className="absolute top-4 left-4 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))', border: '1px solid #c5a059', borderRadius: 6, padding: '8px 12px', minWidth: 180 }}>
            <div className="text-sm font-bold text-[#c5a059]">{heroInfo.name}</div>
            <div className="text-xs text-gray-400">{heroInfo.race} {heroInfo.heroClass} | Lv{playerState.level}</div>
            <div className="flex items-center mt-1" style={{ gap: 4 }}>
              <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#200', border: '1px solid #500' }}>
                <div className="h-full transition-all" style={{ width: `${hpPct}%`, background: 'linear-gradient(to right, #b91c1c, #ef4444)' }} />
              </div>
              <span className="text-[9px] text-red-300 w-16 text-right">{Math.floor(playerState.hp)}/{playerState.maxHp}</span>
            </div>
            <div className="flex items-center mt-0.5" style={{ gap: 4 }}>
              <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#002', border: '1px solid #005' }}>
                <div className="h-full transition-all" style={{ width: `${mpPct}%`, background: 'linear-gradient(to right, #1e40af, #3b82f6)' }} />
              </div>
              <span className="text-[9px] text-blue-300 w-16 text-right">{Math.floor(playerState.mp)}/{playerState.maxMp}</span>
            </div>
            <div className="flex items-center mt-0.5" style={{ gap: 4 }}>
              <div className="h-1.5 rounded-sm overflow-hidden" style={{ flex: 1, background: '#220', border: '1px solid #440' }}>
                <div className="h-full transition-all" style={{ width: `${xpPct}%`, background: 'linear-gradient(to right, #ca8a04, #eab308)' }} />
              </div>
              <span className="text-[9px] text-yellow-400 w-16 text-right">{playerState.xp}/{playerState.xpToNext}xp</span>
            </div>
            <div className="flex mt-1" style={{ gap: 8, fontSize: 9 }}>
              <span style={{ color: '#fbbf24' }}>ATK {playerState.atk}</span>
              <span style={{ color: '#60a5fa' }}>DEF {playerState.def}</span>
              <span style={{ color: '#4ade80' }}>SPD {playerState.spd}</span>
            </div>
            <div className="flex mt-0.5" style={{ gap: 8, fontSize: 9 }}>
              <span style={{ color: '#ffd700' }}>Gold: {playerState.gold}</span>
              <span style={{ color: '#4ade80' }}>Kills: {playerState.kills}</span>
            </div>
            <div className="text-[10px] text-gray-600 mt-1">Pos: {playerPos.x}, {playerPos.z}</div>
          </div>
        )}
        {/* Target Info */}
        {targetMonsterInfo && (
          <div className="absolute top-4 right-4 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))', border: `2px solid ${targetMonsterInfo.isBoss ? '#ff4444' : '#ff8844'}`, borderRadius: 6, padding: '8px 12px', minWidth: 160 }}>
            <div className="text-sm font-bold" style={{ color: targetMonsterInfo.isBoss ? '#ff4444' : '#ff8844' }}>
              {targetMonsterInfo.isBoss && '\u2620 '}{targetMonsterInfo.name}
            </div>
            <div className="flex items-center mt-1" style={{ gap: 4 }}>
              <div className="h-3 rounded-sm overflow-hidden" style={{ flex: 1, background: '#200', border: '1px solid #500' }}>
                <div className="h-full transition-all" style={{ width: `${(targetMonsterInfo.hp / targetMonsterInfo.maxHp) * 100}%`, background: targetMonsterInfo.isBoss ? 'linear-gradient(to right, #991b1b, #ef4444)' : 'linear-gradient(to right, #92400e, #fbbf24)' }} />
              </div>
              <span className="text-[9px] text-red-300 w-16 text-right">{Math.floor(targetMonsterInfo.hp)}/{targetMonsterInfo.maxHp}</span>
            </div>
          </div>
        )}
        {/* Safe House */}
        {inSafeHouse && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2" style={{ background: 'rgba(0,80,0,0.6)', border: '1px solid #4ade80', borderRadius: 6, padding: '4px 16px', color: '#4ade80', fontSize: 12, fontWeight: 'bold' }}>
            SAFE ZONE — Healing active
          </div>
        )}
        {/* Combat Log */}
        <div className="absolute bottom-24 left-4 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(20,15,10,0.9), rgba(8,5,0,0.9))', border: '1px solid #c5a05940', borderRadius: 4, padding: '6px 10px', width: 260, maxHeight: 140, overflow: 'hidden' }}>
          <div style={{ color: '#c5a059', fontSize: 10, marginBottom: 2 }}>COMBAT LOG</div>
          {combatLog.map((msg, i) => (<div key={i} style={{ color: msg.color, fontSize: 10, lineHeight: 1.3 }}>{msg.text}</div>))}
        </div>
        {/* Town / Dungeon Prompts */}
        {currentTown && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(15,10,5,0.98), rgba(10,5,0,0.95))', border: '2px solid #c5a059', borderRadius: 8, padding: '12px 24px', boxShadow: '0 4px 30px rgba(0,0,0,0.9)' }}>
            <div className="text-center">
              <div className="text-lg font-black text-[#c5a059]">{currentTown}</div>
              <div className="text-xs text-gray-400 mt-1">
                {currentTown === 'Elvenhollow' && 'Ancient elven sanctuary among the great trees'}
                {currentTown === 'Ironjaw Keep' && 'Fortified orcish stronghold of blood and iron'}
                {currentTown === 'Valorheim' && 'Noble human citadel of honor and steel'}
              </div>
            </div>
          </div>
        )}
        {nearDungeon && !currentTown && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(20,5,30,0.98), rgba(10,0,20,0.95))', border: '2px solid #8866ff', borderRadius: 8, padding: '12px 24px', boxShadow: '0 4px 30px rgba(100,50,200,0.3)' }}>
            <div className="text-center">
              <div className="text-lg font-black text-[#aa88ff]">{nearDungeon}</div>
              <div className="text-xs text-gray-400 mt-1">Level {nearDungeonLevel}+ Dungeon</div>
              <div className="text-[10px] text-[#aa88ff] mt-2 font-bold">Press F to enter</div>
            </div>
          </div>
        )}
        {/* Nav Buttons */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex pointer-events-auto" style={{ gap: 8 }}>
          <button onClick={() => setLocation('/game')} className="text-xs font-bold px-4 py-2 rounded" style={{ background: 'rgba(197,160,89,0.2)', border: '1px solid #c5a059', color: '#c5a059', cursor: 'pointer' }}>MOBA MODE</button>
          <button onClick={() => setLocation('/dungeon')} className="text-xs font-bold px-4 py-2 rounded" style={{ background: 'rgba(136,102,255,0.2)', border: '1px solid #8866ff', color: '#8866ff', cursor: 'pointer' }}>DUNGEON</button>
          <button onClick={() => setLocation('/')} className="text-xs font-bold px-4 py-2 rounded" style={{ background: 'rgba(197,160,89,0.2)', border: '1px solid #c5a059', color: '#c5a059', cursor: 'pointer' }}>HOME</button>
        </div>
        {/* Minimap */}
        <div className="absolute bottom-4 right-4 pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(15,10,5,0.95), rgba(10,5,0,0.85))', border: '1px solid #c5a059', borderRadius: 6, padding: 8, width: 180, height: 180 }}>
          <div className="relative w-full h-full">
            <div className="absolute inset-0 rounded" style={{ background: '#1a2a1a' }} />
            {WORLD_ZONES.map((zone, i) => (<div key={`z${i}`} className="absolute rounded-full" style={{ background: `#${zone.groundColor.toString(16).padStart(6, '0')}40`, left: `${((zone.centerX + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, top: `${((zone.centerZ + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, width: `${(zone.radius / WORLD_SIZE) * 100}%`, height: `${(zone.radius / WORLD_SIZE) * 100}%`, transform: 'translate(-50%, -50%)' }} />))}
            {TOWN_CONFIGS.map((tc, i) => (<div key={`t${i}`} className="absolute w-3 h-3 rounded-full" style={{ background: `#${tc.color.toString(16).padStart(6, '0')}`, left: `${((tc.pos.x + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, top: `${((tc.pos.z + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, transform: 'translate(-50%, -50%)', boxShadow: `0 0 6px #${tc.color.toString(16).padStart(6, '0')}` }} title={tc.name} />))}
            {DUNGEON_ENTRANCE_CONFIGS.map((dc, i) => (<div key={`d${i}`} className="absolute" style={{ width: 6, height: 6, background: `#${dc.color.toString(16).padStart(6, '0')}`, left: `${((dc.x + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, top: `${((dc.z + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, transform: 'translate(-50%, -50%) rotate(45deg)', boxShadow: `0 0 4px #${dc.color.toString(16).padStart(6, '0')}` }} title={dc.name} />))}
            <div className="absolute" style={{ width: 5, height: 5, background: '#4ade80', left: `${((SAFE_HOUSE_CONFIG.x + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, top: `${((SAFE_HOUSE_CONFIG.z + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 4px #4ade80' }} title="Safe House" />
            <div className="absolute w-2 h-2 rounded-full bg-yellow-400" style={{ left: `${((playerPos.x + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, top: `${((playerPos.z + WORLD_SIZE) / (WORLD_SIZE * 2)) * 100}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 8px #ffd700' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
