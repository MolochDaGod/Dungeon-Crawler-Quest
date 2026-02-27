import * as THREE from 'three';
import { loadGLB, loadFBX, LoadedModel, createAnimatedEntity, playAnimation, AnimatedEntity, loadAnimationSet, applyAnimationsToEntity, ANIMATION_PATHS } from './model-loader';
import { TOWER_PREFABS, HERO_PREFABS, ENV_PREFABS, CREATURE_PREFABS, MINION_PREFABS, getTowerPrefab, getHeroPrefabKey, getMinionPrefabKey, getJungleMobPrefab, getWeaponForClass, WEAPON_PREFABS } from './prefabs';
import { MobaState, MobaHero, MobaMinion, MobaTower, MobaNexus, HEROES, MAP_SIZE, TEAM_COLORS, LANE_WAYPOINTS, CLASS_COLORS, Projectile, Particle, FloatingText, SpellEffect, JungleCamp, JungleMob } from './types';

interface Entity3D {
  group: THREE.Group;
  entity?: AnimatedEntity;
  healthBar?: THREE.Mesh;
  healthBg?: THREE.Mesh;
  nameSprite?: THREE.Sprite;
  lastAnim?: string;
  mixer?: THREE.AnimationMixer;
}

const WORLD_SCALE = 0.05;

function mapAnimState(animState: string, dead: boolean): string {
  if (dead) return 'death';
  switch (animState) {
    case 'walk': return 'run';
    case 'attack':
    case 'combo_finisher':
    case 'dash_attack': return 'attack';
    case 'ability': return 'attack';
    case 'dodge':
    case 'block': return 'hit';
    case 'death': return 'death';
    case 'idle':
    default: return 'idle';
  }
}

function gameToWorld(x: number, y: number, z: number = 0): THREE.Vector3 {
  return new THREE.Vector3(x * WORLD_SCALE, z * WORLD_SCALE, y * WORLD_SCALE);
}

export class ThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private lastTime: number;

  private heroMeshes = new Map<number, Entity3D>();
  private minionMeshes = new Map<number, Entity3D>();
  private towerMeshes = new Map<number, Entity3D>();
  private nexusMeshes = new Map<number, Entity3D>();
  private jungleMobMeshes = new Map<number, Entity3D>();
  private projectileMeshes = new Map<number, THREE.Mesh>();
  private particlePool: THREE.Mesh[] = [];
  private activeParticles: THREE.Mesh[] = [];

  private groundMesh!: THREE.Mesh;
  private laneMeshes: THREE.Mesh[] = [];
  private envObjects: THREE.Group[] = [];
  private loadedModels = new Map<string, LoadedModel>();
  private modelLoadQueue = new Set<string>();
  private sharedAnimClips = new Map<string, THREE.AnimationClip>();
  private initialized = false;
  private loadingComplete = false;

  private hudCanvas!: HTMLCanvasElement;
  private hudCtx!: CanvasRenderingContext2D;

  private raycaster = new THREE.Raycaster();
  private mouseNdc = new THREE.Vector2();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2332);
    this.scene.fog = new THREE.FogExp2(0x1a2332, 0.003);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 15, 15);
    this.camera.lookAt(0, 0, 0);

    this.lastTime = performance.now();
    this.setupLighting();
    this.setupGround();
    this.setupLanes();

    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 512;
    this.hudCanvas.height = 64;
    this.hudCtx = this.hudCanvas.getContext('2d')!;

    window.addEventListener('resize', () => this.onResize());
    this.initialized = true;
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0x445566, 0.6);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362a1a, 0.5);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
    fill.position.set(-30, 40, -20);
    this.scene.add(fill);
  }

  private setupGround() {
    const size = MAP_SIZE * WORLD_SCALE;
    const segments = 64;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const worldX = (x / WORLD_SCALE);
      const worldY = (z / WORLD_SCALE);
      let height = 0;

      const centerDist = Math.sqrt((worldX - MAP_SIZE / 2) ** 2 + (worldY - MAP_SIZE / 2) ** 2);
      if (centerDist > MAP_SIZE * 0.42) {
        height = (centerDist - MAP_SIZE * 0.42) * 0.003;
      }

      const isLane = this.isNearLane(worldX + MAP_SIZE / 2, worldY + MAP_SIZE / 2);
      if (isLane) height -= 0.05;

      height += (Math.sin(x * 2) * Math.cos(z * 3)) * 0.05;
      positions.setY(i, height);
    }
    geo.computeVertexNormals();

    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const worldX = (x / WORLD_SCALE) + MAP_SIZE / 2;
      const worldY = (z / WORLD_SCALE) + MAP_SIZE / 2;
      const isLane = this.isNearLane(worldX, worldY);
      const isRiver = this.isNearRiver(worldX, worldY);
      const centerDist = Math.sqrt((worldX - MAP_SIZE / 2) ** 2 + (worldY - MAP_SIZE / 2) ** 2);

      let r, g, b;
      if (isRiver) {
        r = 0.15; g = 0.35; b = 0.55;
      } else if (isLane) {
        r = 0.4; g = 0.35; b = 0.25;
      } else if (centerDist > MAP_SIZE * 0.45) {
        r = 0.3; g = 0.25; b = 0.2;
      } else {
        r = 0.2 + Math.random() * 0.05;
        g = 0.4 + Math.random() * 0.08;
        b = 0.15 + Math.random() * 0.05;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.groundMesh = new THREE.Mesh(geo, mat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  private isNearLane(x: number, y: number): boolean {
    for (const lane of LANE_WAYPOINTS) {
      for (let i = 1; i < lane.length; i++) {
        const a = lane[i - 1], b = lane[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
        const px = a.x + t * dx, py = a.y + t * dy;
        const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (d < 120) return true;
      }
    }
    return false;
  }

  private isNearRiver(x: number, y: number): boolean {
    const cx = MAP_SIZE / 2, cy = MAP_SIZE / 2;
    const angle = Math.atan2(y - cy, x - cx);
    const riverDist = Math.abs(Math.sin(angle * 2)) * 200 + 50;
    const d = Math.abs(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - MAP_SIZE * 0.25);
    return d < riverDist * 0.3;
  }

  private setupLanes() {
    const laneMats = [
      new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x4f4030, roughness: 0.95 }),
    ];

    for (let l = 0; l < 3; l++) {
      const lane = LANE_WAYPOINTS[l];
      for (let i = 1; i < lane.length; i++) {
        const a = lane[i - 1], b = lane[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const width = 4;
        const geo = new THREE.PlaneGeometry(len * WORLD_SCALE, width * WORLD_SCALE);
        geo.rotateX(-Math.PI / 2);

        const mesh = new THREE.Mesh(geo, laneMats[l]);
        mesh.position.copy(gameToWorld(
          (a.x + b.x) / 2 - MAP_SIZE / 2,
          (a.y + b.y) / 2 - MAP_SIZE / 2,
          0.02
        ));
        mesh.rotation.y = -angle;
        mesh.receiveShadow = true;
        this.laneMeshes.push(mesh);
        this.scene.add(mesh);
      }
    }
  }

  private loadModel(prefab: { modelPath: string; texturePath?: string; format?: string }): Promise<void> {
    if (this.loadedModels.has(prefab.modelPath) || this.modelLoadQueue.has(prefab.modelPath)) {
      return Promise.resolve();
    }
    this.modelLoadQueue.add(prefab.modelPath);
    const isGlb = prefab.format === 'glb' || prefab.modelPath.endsWith('.glb');
    const loader = isGlb ? loadGLB(prefab.modelPath) : loadFBX(prefab.modelPath, prefab.texturePath);
    return loader
      .then(m => { this.loadedModels.set(prefab.modelPath, m); })
      .catch(() => {});
  }

  async loadModels(state: MobaState) {
    const promises: Promise<void>[] = [];

    for (const tower of state.towers) {
      const prefabKey = getTowerPrefab(tower.team, tower.lane);
      const prefab = TOWER_PREFABS[prefabKey];
      if (prefab) promises.push(this.loadModel(prefab));
    }

    for (const hero of state.heroes) {
      const heroData = HEROES[hero.heroDataId];
      if (!heroData) continue;
      const prefabKey = getHeroPrefabKey(heroData.race, heroData.heroClass, heroData.name);
      const prefab = HERO_PREFABS[prefabKey];
      if (prefab) promises.push(this.loadModel(prefab));
    }

    const minionPrefabKeys = ['melee_team0', 'melee_team1', 'ranged_team0', 'ranged_team1', 'siege_team0', 'siege_team1'];
    for (const key of minionPrefabKeys) {
      const prefab = MINION_PREFABS[key];
      if (prefab) promises.push(this.loadModel(prefab));
    }

    const creatureKeys = ['wolf', 'dragon', 'raptor', 'skeleton'];
    for (const key of creatureKeys) {
      const prefab = CREATURE_PREFABS[key];
      if (prefab) promises.push(this.loadModel(prefab));
    }

    const envModelsToLoad = ['tree', 'rock', 'castle', 'fortress', 'banner', 'torch', 'campfire'];
    for (const key of envModelsToLoad) {
      const prefab = ENV_PREFABS[key];
      if (prefab) promises.push(this.loadModel(prefab));
    }

    promises.push(
      loadAnimationSet(ANIMATION_PATHS).then(clips => {
        this.sharedAnimClips = clips;
      })
    );

    await Promise.allSettled(promises);
    this.loadingComplete = true;
  }

  private createHealthBar(width: number): { bar: THREE.Mesh; bg: THREE.Mesh } {
    const bgGeo = new THREE.PlaneGeometry(width, 0.15);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });
    const bg = new THREE.Mesh(bgGeo, bgMat);

    const barGeo = new THREE.PlaneGeometry(width, 0.12);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x22cc22 });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.z = 0.001;

    return { bar, bg };
  }

  private getOrCreateHero(hero: MobaHero): Entity3D | null {
    if (this.heroMeshes.has(hero.id)) return this.heroMeshes.get(hero.id)!;

    const heroData = HEROES[hero.heroDataId];
    if (!heroData) return null;

    const prefabKey = getHeroPrefabKey(heroData.race, heroData.heroClass, heroData.name);
    const prefab = HERO_PREFABS[prefabKey];
    if (!prefab) return null;

    const model = this.loadedModels.get(prefab.modelPath);
    const group = new THREE.Group();
    let mixer: THREE.AnimationMixer | undefined;
    let entity: AnimatedEntity | undefined;

    if (model) {
      const clone = model.scene.clone();
      clone.scale.setScalar(prefab.scale);
      clone.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      group.add(clone);

      mixer = new THREE.AnimationMixer(clone);
      const actions = new Map<string, THREE.AnimationAction>();
      if (model.animations && model.animations.length > 0) {
        for (const clip of model.animations) {
          const action = mixer.clipAction(clip);
          const clipName = clip.name.toLowerCase();
          actions.set(clipName, action);
        }
      }
      for (const [name, clip] of Array.from(this.sharedAnimClips)) {
        if (!actions.has(name)) {
          const action = mixer.clipAction(clip);
          actions.set(name, action);
        }
      }
      const idleAction = actions.get('idle') || Array.from(actions.values()).find(a => {
        const name = (a as any)._clip?.name?.toLowerCase() || '';
        return name.includes('idle') || name.includes('tpose');
      });
      if (idleAction) {
        idleAction.play();
      } else if (actions.size > 0) {
        const firstAction = actions.values().next().value;
        if (firstAction) firstAction.play();
      }
      entity = { group: clone, mixer, actions, currentAction: 'idle' };
    } else {
      const capsuleGeo = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16);
      const color = new THREE.Color(CLASS_COLORS[heroData.heroClass] || '#888');
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.5, metalness: 0.3,
        emissive: color, emissiveIntensity: 0.15
      });
      const mesh = new THREE.Mesh(capsuleGeo, mat);
      mesh.castShadow = true;
      mesh.position.y = 0.02;
      group.add(mesh);
    }

    if (hero.isPlayer) {
      const ringGeo = new THREE.RingGeometry(0.5, 0.6, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      group.add(ring);
    }

    const teamColor = new THREE.Color(TEAM_COLORS[hero.team]);
    const indicatorGeo = new THREE.RingGeometry(0.35, 0.4, 16);
    const indicatorMat = new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.y = 0.02;
    group.add(indicator);

    const { bar, bg } = this.createHealthBar(1.2);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 2.0;
    hpGroup.lookAt(this.camera.position);
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg, entity, mixer };
    this.scene.add(group);
    this.heroMeshes.set(hero.id, entity3D);
    return entity3D;
  }

  private getOrCreateMinion(minion: MobaMinion): Entity3D {
    if (this.minionMeshes.has(minion.id)) return this.minionMeshes.get(minion.id)!;

    const group = new THREE.Group();
    const prefabKey = getMinionPrefabKey(minion.minionType, minion.team);
    const prefab = MINION_PREFABS[prefabKey];
    const model = prefab ? this.loadedModels.get(prefab.modelPath) : null;
    let mixer: THREE.AnimationMixer | undefined;

    if (model) {
      const clone = model.scene.clone();
      clone.scale.setScalar(prefab!.scale);
      clone.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      group.add(clone);

      if (model.animations && model.animations.length > 0) {
        mixer = new THREE.AnimationMixer(clone);
        for (const clip of model.animations) {
          const action = mixer.clipAction(clip);
          action.play();
          break;
        }
      }
    } else {
      const size = minion.minionType === 'siege' ? 0.35 : 0.2;
      const teamColor = new THREE.Color(TEAM_COLORS[minion.team]);
      const bodyGeo = new THREE.BoxGeometry(size, size * 1.2, size);
      const mat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6, metalness: 0.2 });
      const body = new THREE.Mesh(bodyGeo, mat);
      body.castShadow = true;
      body.position.y = size * 0.6;
      group.add(body);

      const eyeSize = size * 0.15;
      const eyeGeo = new THREE.SphereGeometry(eyeSize, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-size * 0.2, size * 0.8, size * 0.4);
      group.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(size * 0.2, size * 0.8, size * 0.4);
      group.add(rightEye);
    }

    const { bar, bg } = this.createHealthBar(0.6);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 1.2;
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg, mixer };
    this.scene.add(group);
    this.minionMeshes.set(minion.id, entity3D);
    return entity3D;
  }

  private getOrCreateJungleMob(mob: JungleMob): Entity3D {
    if (this.jungleMobMeshes.has(mob.id)) return this.jungleMobMeshes.get(mob.id)!;

    const group = new THREE.Group();
    const prefabKey = getJungleMobPrefab(mob.mobType);
    const prefab = CREATURE_PREFABS[prefabKey];
    const model = prefab ? this.loadedModels.get(prefab.modelPath) : null;
    let mixer: THREE.AnimationMixer | undefined;

    if (model) {
      const clone = model.scene.clone();
      clone.scale.setScalar(prefab!.scale);
      clone.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      group.add(clone);

      if (model.animations && model.animations.length > 0) {
        mixer = new THREE.AnimationMixer(clone);
        for (const clip of model.animations) {
          const action = mixer.clipAction(clip);
          action.play();
          break;
        }
      }
    } else {
      const size = mob.mobType === 'buff' ? 0.5 : mob.mobType === 'medium' ? 0.35 : 0.25;
      const mobColor = mob.mobType === 'buff' ? 0x9333ea : mob.mobType === 'medium' ? 0x3b82f6 : 0x22c55e;
      const bodyGeo = new THREE.SphereGeometry(size, 12, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: mobColor, roughness: 0.5, metalness: 0.2,
        emissive: new THREE.Color(mobColor), emissiveIntensity: 0.2
      });
      const body = new THREE.Mesh(bodyGeo, mat);
      body.castShadow = true;
      body.position.y = size;
      group.add(body);

      const eyeGeo = new THREE.SphereGeometry(size * 0.2, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-size * 0.3, size * 1.2, size * 0.6);
      group.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(size * 0.3, size * 1.2, size * 0.6);
      group.add(rightEye);
    }

    const { bar, bg } = this.createHealthBar(0.8);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 1.5;
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg, mixer };
    this.scene.add(group);
    this.jungleMobMeshes.set(mob.id, entity3D);
    return entity3D;
  }

  private getOrCreateTower(tower: MobaTower): Entity3D {
    if (this.towerMeshes.has(tower.id)) return this.towerMeshes.get(tower.id)!;

    const group = new THREE.Group();
    const prefabKey = getTowerPrefab(tower.team, tower.lane);
    const prefab = TOWER_PREFABS[prefabKey];
    const model = prefab ? this.loadedModels.get(prefab.modelPath) : null;

    if (model) {
      const clone = model.scene.clone();
      clone.scale.setScalar(prefab!.scale);
      clone.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      group.add(clone);
    } else {
      const teamColor = new THREE.Color(TEAM_COLORS[tower.team]);
      const baseGeo = new THREE.CylinderGeometry(0.6, 0.8, 0.4, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.9 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.castShadow = true;
      base.position.y = 0.2;
      group.add(base);

      const bodyGeo = new THREE.CylinderGeometry(0.4, 0.55, 2.5, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x776655, roughness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.position.y = 1.65;
      group.add(body);

      const topGeo = new THREE.ConeGeometry(0.6, 1, 8);
      const topMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.5, metalness: 0.3 });
      const top = new THREE.Mesh(topGeo, topMat);
      top.castShadow = true;
      top.position.y = 3.4;
      group.add(top);

      const orbGeo = new THREE.SphereGeometry(0.15, 16, 16);
      const orbMat = new THREE.MeshStandardMaterial({
        color: teamColor, emissive: teamColor, emissiveIntensity: 0.8,
        roughness: 0.2, metalness: 0.6
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 4.0;
      group.add(orb);

      const light = new THREE.PointLight(teamColor.getHex(), 0.8, 8);
      light.position.y = 4.0;
      group.add(light);
    }

    const { bar, bg } = this.createHealthBar(1.5);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 4.5;
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg };
    this.scene.add(group);
    this.towerMeshes.set(tower.id, entity3D);
    return entity3D;
  }

  private getOrCreateNexus(nexus: MobaNexus): Entity3D {
    if (this.nexusMeshes.has(nexus.id)) return this.nexusMeshes.get(nexus.id)!;

    const group = new THREE.Group();
    const teamColor = new THREE.Color(TEAM_COLORS[nexus.team]);

    const baseGeo = new THREE.CylinderGeometry(1.5, 2, 0.5, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.castShadow = true;
    base.position.y = 0.25;
    group.add(base);

    const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: teamColor, emissive: teamColor, emissiveIntensity: 0.6,
      roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.castShadow = true;
    crystal.position.y = 1.8;
    crystal.name = 'crystal';
    group.add(crystal);

    const shellGeo = new THREE.IcosahedronGeometry(1.1, 0);
    const shellMat = new THREE.MeshStandardMaterial({
      color: teamColor, transparent: true, opacity: 0.15,
      wireframe: true, emissive: teamColor, emissiveIntensity: 0.3
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = 1.8;
    shell.name = 'shell';
    group.add(shell);

    const light = new THREE.PointLight(teamColor.getHex(), 1.5, 15);
    light.position.y = 2;
    group.add(light);

    const { bar, bg } = this.createHealthBar(2.0);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 3.5;
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg };
    this.scene.add(group);
    this.nexusMeshes.set(nexus.id, entity3D);
    return entity3D;
  }

  private updateHealthBar(entity3D: Entity3D, hp: number, maxHp: number, teamColor: string) {
    if (!entity3D.healthBar || !entity3D.healthBg) return;
    const ratio = Math.max(0, hp / maxHp);
    entity3D.healthBar.scale.x = Math.max(0.01, ratio);
    entity3D.healthBar.position.x = -(1 - ratio) * 0.5 * entity3D.healthBg.scale.x;

    const mat = entity3D.healthBar.material as THREE.MeshBasicMaterial;
    if (ratio > 0.6) mat.color.setHex(0x22cc22);
    else if (ratio > 0.3) mat.color.setHex(0xcccc22);
    else mat.color.setHex(0xcc2222);

    const hpGroup = entity3D.healthBar.parent;
    if (hpGroup) {
      hpGroup.lookAt(this.camera.position);
    }
  }

  private spawnProjectile3D(proj: Projectile) {
    if (this.projectileMeshes.has(proj.id)) return;

    const color = new THREE.Color(proj.color);
    const geo = new THREE.SphereGeometry(proj.size * 0.02, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.0,
      roughness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    const trailGeo = new THREE.SphereGeometry(proj.size * 0.015, 6, 6);
    const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
    for (let i = 0; i < 3; i++) {
      const trail = new THREE.Mesh(trailGeo, trailMat.clone());
      trail.name = `trail_${i}`;
      mesh.add(trail);
    }

    this.scene.add(mesh);
    this.projectileMeshes.set(proj.id, mesh);
  }

  private spawnParticle3D(p: Particle) {
    const geo = new THREE.SphereGeometry(p.size * 0.02, 6, 6);
    const color = new THREE.Color(p.color);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(gameToWorld(p.x - MAP_SIZE / 2, p.y - MAP_SIZE / 2, 1));
    mesh.userData = { particle: p };
    this.scene.add(mesh);
    this.activeParticles.push(mesh);
  }

  private placeDecorations(state: MobaState) {
    if (this.envObjects.length > 0) return;

    const treeModel = this.loadedModels.get(ENV_PREFABS.tree?.modelPath || '');
    const rockModel = this.loadedModels.get(ENV_PREFABS.rock?.modelPath || '');

    for (const deco of state.decorations) {
      const group = new THREE.Group();
      const wx = deco.x - MAP_SIZE / 2;
      const wy = deco.y - MAP_SIZE / 2;

      if (deco.type === 'tree' && treeModel) {
        const clone = treeModel.scene.clone();
        clone.scale.setScalar(ENV_PREFABS.tree.scale * (0.8 + Math.random() * 0.4));
        clone.rotation.y = Math.random() * Math.PI * 2;
        clone.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        group.add(clone);
      } else if (deco.type === 'rock' && rockModel) {
        const clone = rockModel.scene.clone();
        clone.scale.setScalar(ENV_PREFABS.rock.scale * (0.6 + Math.random() * 0.6));
        clone.rotation.y = Math.random() * Math.PI * 2;
        clone.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        group.add(clone);
      } else {
        if (deco.type === 'tree') {
          const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.castShadow = true;
          trunk.position.y = 0.4;
          group.add(trunk);

          const crownGeo = new THREE.SphereGeometry(0.5, 8, 6);
          const green = 0x228833 + Math.floor(Math.random() * 0x222222);
          const crownMat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.8 });
          const crown = new THREE.Mesh(crownGeo, crownMat);
          crown.castShadow = true;
          crown.position.y = 1.1;
          crown.scale.y = 0.8 + Math.random() * 0.4;
          group.add(crown);
        } else {
          const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.15, 0);
          const rockMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.95 });
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.castShadow = true;
          rock.position.y = 0.15;
          rock.rotation.set(Math.random(), Math.random(), Math.random());
          group.add(rock);
        }
      }

      group.position.copy(gameToWorld(wx, wy));
      this.scene.add(group);
      this.envObjects.push(group);
    }
  }

  render(state: MobaState) {
    if (!this.initialized) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const time = now / 1000;

    if (!this.loadingComplete) {
      this.loadModels(state);
    }

    if (this.envObjects.length === 0 && state.decorations.length > 0) {
      this.placeDecorations(state);
    }

    const player = state.heroes[state.playerHeroIndex];
    if (player) {
      const targetX = (player.x - MAP_SIZE / 2) * WORLD_SCALE;
      const targetZ = (player.y - MAP_SIZE / 2) * WORLD_SCALE;
      const camDist = 20 / state.camera.zoom;
      const camHeight = 15 / state.camera.zoom;

      this.camera.position.x += (targetX - camDist * 0.3 - this.camera.position.x) * 0.08;
      this.camera.position.y += (camHeight - this.camera.position.y) * 0.08;
      this.camera.position.z += (targetZ + camDist - this.camera.position.z) * 0.08;
      this.camera.lookAt(targetX, 0, targetZ);
    }

    for (const hero of state.heroes) {
      if (hero.dead) {
        const existing = this.heroMeshes.get(hero.id);
        if (existing) existing.group.visible = false;
        continue;
      }
      const e = this.getOrCreateHero(hero);
      if (!e) continue;
      e.group.visible = true;
      const wx = (hero.x - MAP_SIZE / 2) * WORLD_SCALE;
      const wz = (hero.y - MAP_SIZE / 2) * WORLD_SCALE;
      e.group.position.set(wx, 0, wz);
      e.group.rotation.y = -hero.facing + Math.PI / 2;

      if (e.entity) {
        const targetAnim = mapAnimState(hero.animState, hero.dead);
        if (e.entity.currentAction !== targetAnim) {
          playAnimation(e.entity, targetAnim, 0.15);
        }
        if (hero.animState === 'attack' || hero.animState === 'combo_finisher') {
          const attackAction = e.entity.actions.get('attack');
          if (attackAction && !hero.dead) {
            attackAction.setLoop(THREE.LoopOnce, 1);
            attackAction.clampWhenFinished = true;
          }
        }
        if (targetAnim === 'death') {
          const deathAction = e.entity.actions.get('death');
          if (deathAction) {
            deathAction.setLoop(THREE.LoopOnce, 1);
            deathAction.clampWhenFinished = true;
          }
        }
      } else {
        const mesh = e.group.children[0];
        if (mesh) {
          if (hero.animState === 'walk') {
            const stride = Math.sin(time * 8);
            mesh.position.y = 0.02 + Math.max(0, stride) * 0.06;
            mesh.rotation.z = 0;
            mesh.rotation.x = Math.sin(time * 8) * 0.04;
          } else if (hero.animState === 'attack' || hero.animState === 'combo_finisher') {
            mesh.position.y = 0.02;
            const windupPhase = hero.attackWindup > 0 ? 1 : 0;
            mesh.rotation.z = windupPhase > 0 ? Math.sin(time * 15) * 0.05 : Math.sin(time * 25) * 0.15;
            mesh.rotation.x = windupPhase > 0 ? -0.1 : 0.15;
          } else if (hero.animState === 'ability') {
            mesh.position.y = 0.02 + Math.sin(time * 6) * 0.08;
            mesh.rotation.z = 0;
          } else {
            mesh.position.y = 0.02;
            mesh.rotation.z = 0;
            mesh.rotation.x = 0;
          }
        }
      }

      this.updateHealthBar(e, hero.hp, hero.maxHp, TEAM_COLORS[hero.team]);

      if (e.mixer) e.mixer.update(dt);
    }

    for (const minion of state.minions) {
      if (minion.dead) {
        const existing = this.minionMeshes.get(minion.id);
        if (existing) existing.group.visible = false;
        continue;
      }
      const e = this.getOrCreateMinion(minion);
      e.group.visible = true;
      const wx = (minion.x - MAP_SIZE / 2) * WORLD_SCALE;
      const wz = (minion.y - MAP_SIZE / 2) * WORLD_SCALE;
      e.group.position.set(wx, 0, wz);
      e.group.rotation.y = -minion.facing + Math.PI / 2;
      e.group.children[0].position.y = 0.02 + Math.max(0, Math.sin(time * 6 + minion.id)) * 0.02;

      this.updateHealthBar(e, minion.hp, minion.maxHp, TEAM_COLORS[minion.team]);
    }

    for (const tower of state.towers) {
      if (tower.dead) {
        const existing = this.towerMeshes.get(tower.id);
        if (existing) existing.group.visible = false;
        continue;
      }
      const e = this.getOrCreateTower(tower);
      e.group.visible = true;
      e.group.position.copy(gameToWorld(tower.x - MAP_SIZE / 2, tower.y - MAP_SIZE / 2));
      this.updateHealthBar(e, tower.hp, tower.maxHp, TEAM_COLORS[tower.team]);
    }

    for (const nexus of state.nexuses) {
      if (nexus.dead) {
        const existing = this.nexusMeshes.get(nexus.id);
        if (existing) existing.group.visible = false;
        continue;
      }
      const e = this.getOrCreateNexus(nexus);
      e.group.visible = true;
      e.group.position.copy(gameToWorld(nexus.x - MAP_SIZE / 2, nexus.y - MAP_SIZE / 2));

      const crystal = e.group.getObjectByName('crystal');
      if (crystal) {
        crystal.rotation.y += dt * 0.5;
        crystal.position.y = 1.8 + Math.sin(time * 2) * 0.1;
      }
      const shell = e.group.getObjectByName('shell');
      if (shell) {
        shell.rotation.y -= dt * 0.3;
        shell.rotation.x += dt * 0.2;
      }

      this.updateHealthBar(e, nexus.hp, nexus.maxHp, TEAM_COLORS[nexus.team]);
    }

    const activeProjectileIds = new Set(state.projectiles.map(p => p.id));
    for (const [id, mesh] of Array.from(this.projectileMeshes)) {
      if (!activeProjectileIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    }

    for (const proj of state.projectiles) {
      this.spawnProjectile3D(proj);
      const mesh = this.projectileMeshes.get(proj.id);
      if (mesh) {
        const wx = (proj.x - MAP_SIZE / 2) * WORLD_SCALE;
        const wz = (proj.y - MAP_SIZE / 2) * WORLD_SCALE;
        mesh.position.set(wx, 0.5, wz);

        for (let i = 0; i < 3; i++) {
          const trail = mesh.getObjectByName(`trail_${i}`);
          if (trail) {
            trail.position.z = (i + 1) * 0.1;
            (trail as THREE.Mesh).material = ((trail as THREE.Mesh).material as THREE.MeshBasicMaterial);
            ((trail as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.3 - i * 0.08;
          }
        }
      }
    }

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const mesh = this.activeParticles[i];
      const p = mesh.userData.particle as Particle;
      if (!p || p.life <= 0) {
        this.scene.remove(mesh);
        this.activeParticles.splice(i, 1);
        continue;
      }
      mesh.position.copy(gameToWorld(p.x - MAP_SIZE / 2, p.y - MAP_SIZE / 2, 1 + p.vy * 0.01));
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, p.life / p.maxLife);
    }

    const newParticles = state.particles.filter(p => p.life > p.maxLife * 0.95);
    for (const p of newParticles.slice(0, 5)) {
      this.spawnParticle3D(p);
    }

    this.cleanupDeadEntities(state);
    this.renderer.render(this.scene, this.camera);
  }

  private cleanupDeadEntities(state: MobaState) {
    const heroIds = new Set(state.heroes.map(h => h.id));
    for (const [id, e] of Array.from(this.heroMeshes)) {
      if (!heroIds.has(id)) {
        this.scene.remove(e.group);
        this.heroMeshes.delete(id);
      }
    }

    const minionIds = new Set(state.minions.filter(m => !m.dead).map(m => m.id));
    for (const [id, e] of Array.from(this.minionMeshes)) {
      if (!minionIds.has(id)) {
        this.scene.remove(e.group);
        this.minionMeshes.delete(id);
      }
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose() {
    this.renderer.dispose();
    this.scene.clear();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouseNdc.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersection);

    if (intersection) {
      return {
        x: intersection.x / WORLD_SCALE + MAP_SIZE / 2,
        y: intersection.z / WORLD_SCALE + MAP_SIZE / 2
      };
    }
    return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
  }
}
