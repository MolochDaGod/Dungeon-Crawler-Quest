import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { loadGLB, loadFBX, LoadedModel, createAnimatedEntity, playAnimation, AnimatedEntity, loadAnimationSet, applyAnimationsToEntity, ANIMATION_PATHS } from './model-loader';
import { TOWER_PREFABS, HERO_PREFABS, ENV_PREFABS, CREATURE_PREFABS, MINION_PREFABS, getTowerPrefab, getHeroPrefabKey, getMinionPrefabKey, getJungleMobPrefab, getWeaponForClass, WEAPON_PREFABS } from './prefabs';
import { MobaState, MobaHero, MobaMinion, MobaTower, MobaNexus, HEROES, MAP_SIZE, TEAM_COLORS, LANE_WAYPOINTS, CLASS_COLORS, Projectile, Particle, FloatingText, SpellEffect, SpellProjectile, AreaDamageZoneState, JungleCamp, JungleMob } from './types';

interface Entity3D {
  group: THREE.Group;
  entity?: AnimatedEntity;
  healthBar?: THREE.Mesh;
  healthBg?: THREE.Mesh;
  manaBar?: THREE.Mesh;
  nameSprite?: THREE.Sprite;
  lastAnim?: string;
  mixer?: THREE.AnimationMixer;
  body?: CANNON.Body;
  shadowMesh?: THREE.Mesh;
  weaponTrail?: THREE.Mesh;
  weaponTrailPositions?: THREE.Vector3[];
}

interface SpellVFX3D {
  group: THREE.Group;
  life: number;
  maxLife: number;
  type: string;
  update: (dt: number, life: number) => void;
}

const WORLD_SCALE = 0.05;
const PHYSICS_STEP = 1 / 60;
const GRAVITY = -9.82;

function mapAnimState(animState: string, dead: boolean, hasAnim?: (name: string) => boolean): string {
  if (dead) return 'death';
  const has = hasAnim || (() => false);
  switch (animState) {
    case 'walk':
      return has('walk') ? 'walk' : 'run';
    case 'attack':
      return 'attack';
    case 'combo_finisher':
      return has('slash') ? 'slash' : 'attack';
    case 'lunge_slash':
      return has('slash') ? 'slash' : 'attack';
    case 'dash_attack':
      return 'attack';
    case 'ability':
      return has('slash') ? 'slash' : 'attack';
    case 'dodge':
      return has('jump') ? 'jump' : 'hit';
    case 'block':
      return has('block') ? 'block' : 'hit';
    case 'death': return 'death';
    case 'idle':
    default: return 'idle';
  }
}

function gameToWorld(x: number, y: number, z: number = 0): THREE.Vector3 {
  return new THREE.Vector3(x * WORLD_SCALE, z * WORLD_SCALE, y * WORLD_SCALE);
}

const _tempVec = new THREE.Vector3();
const _tempColor = new THREE.Color();

export class ThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private lastTime: number;

  private physicsWorld: CANNON.World;
  private groundBody!: CANNON.Body;

  private heroMeshes = new Map<number, Entity3D>();
  private minionMeshes = new Map<number, Entity3D>();
  private towerMeshes = new Map<number, Entity3D>();
  private nexusMeshes = new Map<number, Entity3D>();
  private jungleMobMeshes = new Map<number, Entity3D>();
  private projectileMeshes = new Map<number, THREE.Group>();
  private spellProjectileMeshes = new Map<number, THREE.Group>();
  private spellVFX: SpellVFX3D[] = [];
  private areaZoneMeshes = new Map<number, THREE.Group>();

  private particleSystem!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleColors!: Float32Array;
  private particleSizes!: Float32Array;
  private particleAlphas!: Float32Array;
  private maxParticles = 2000;
  private activeParticleCount = 0;

  private groundMesh!: THREE.Mesh;
  private waterMesh!: THREE.Mesh;
  private laneMeshes: THREE.Mesh[] = [];
  private envObjects: THREE.Group[] = [];
  private loadedModels = new Map<string, LoadedModel>();
  private modelLoadQueue = new Set<string>();
  private sharedAnimClips = new Map<string, THREE.AnimationClip>();
  private prefabAnimClips = new Map<string, Map<string, THREE.AnimationClip>>();
  private initialized = false;
  private loadingComplete = false;

  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;

  private cameraShake = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private cameraSmooth = new THREE.Vector3();

  private raycaster = new THREE.Raycaster();
  private mouseNdc = new THREE.Vector2();

  private clock = new THREE.Clock();
  private elapsedTime = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1520);
    this.scene.fog = new THREE.FogExp2(0x0d1520, 0.0015);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500);
    this.camera.position.set(0, 18, 18);
    this.camera.lookAt(0, 0, 0);

    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, GRAVITY, 0),
    });
    this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    this.physicsWorld.defaultContactMaterial.restitution = 0;
    this.physicsWorld.defaultContactMaterial.friction = 0.05;

    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physicsWorld.addBody(this.groundBody);

    this.lastTime = performance.now();
    this.setupLighting();
    this.setupGround();
    this.setupWater();
    this.setupLanes();
    this.setupParticleSystem();
    this.setupSkybox();

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
    this.ambientLight = new THREE.AmbientLight(0x334466, 0.4);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x6688bb, 0x2d1f0a, 0.5);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    this.sunLight.position.set(60, 100, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -120;
    this.sunLight.shadow.camera.right = 120;
    this.sunLight.shadow.camera.top = 120;
    this.sunLight.shadow.camera.bottom = -120;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x4466aa, 0.3);
    this.fillLight.position.set(-40, 50, -30);
    this.scene.add(this.fillLight);

    const rimLight = new THREE.DirectionalLight(0xff8844, 0.15);
    rimLight.position.set(-20, 30, 60);
    this.scene.add(rimLight);
  }

  private setupSkybox() {
    const skyGeo = new THREE.SphereGeometry(200, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x0a1628) },
        bottomColor: { value: new THREE.Color(0x1a2a3a) },
        offset: { value: 20 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  private setupGround() {
    const size = MAP_SIZE * WORLD_SCALE;
    const segments = 128;
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
        height = (centerDist - MAP_SIZE * 0.42) * 0.004;
      }

      const isLane = this.isNearLane(worldX + MAP_SIZE / 2, worldY + MAP_SIZE / 2);
      if (isLane) height -= 0.03;

      const isJungle = this.isJungleArea(worldX + MAP_SIZE / 2, worldY + MAP_SIZE / 2);
      if (isJungle) height += (Math.sin(x * 5) * Math.cos(z * 7)) * 0.03;

      height += (Math.sin(x * 3.7) * Math.cos(z * 2.3)) * 0.04;
      height += (Math.sin(x * 7.1 + z * 5.3)) * 0.015;
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
      const isJungle = this.isJungleArea(worldX, worldY);
      const centerDist = Math.sqrt((worldX - MAP_SIZE / 2) ** 2 + (worldY - MAP_SIZE / 2) ** 2);
      const noise = Math.sin(x * 11.3 + z * 7.7) * 0.03;

      let r: number, g: number, b: number;
      if (isRiver) {
        r = 0.08 + noise; g = 0.22 + noise; b = 0.4 + noise * 0.5;
      } else if (isLane) {
        r = 0.32 + noise; g = 0.28 + noise; b = 0.2 + noise;
      } else if (isJungle) {
        r = 0.12 + noise; g = 0.28 + noise * 1.5; b = 0.1 + noise;
      } else if (centerDist > MAP_SIZE * 0.45) {
        r = 0.25 + noise; g = 0.2 + noise; b = 0.15 + noise;
      } else {
        r = 0.15 + noise;
        g = 0.35 + noise * 1.2;
        b = 0.1 + noise;
      }

      const team0Dist = Math.sqrt((worldX - 200) ** 2 + (worldY - 200) ** 2);
      const team1Dist = Math.sqrt((worldX - (MAP_SIZE - 200)) ** 2 + (worldY - (MAP_SIZE - 200)) ** 2);
      if (team0Dist < 400) {
        const f = 1 - team0Dist / 400;
        r += f * 0.08; g += f * 0.04; b += f * 0.12;
      }
      if (team1Dist < 400) {
        const f = 1 - team1Dist / 400;
        r += f * 0.12; g += f * 0.04; b += f * 0.03;
      }

      colors[i * 3] = Math.max(0, Math.min(1, r));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, g));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, b));
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    });

    this.groundMesh = new THREE.Mesh(geo, mat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  private setupWater() {
    const size = MAP_SIZE * WORLD_SCALE;
    const waterGeo = new THREE.PlaneGeometry(size * 0.6, size * 0.15, 32, 8);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0x0a3060) },
        color2: { value: new THREE.Color(0x1a5090) },
        opacity: { value: 0.6 },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float wave = sin(pos.x * 8.0 + time * 2.0) * 0.02 + sin(pos.z * 6.0 + time * 1.5) * 0.015;
          pos.y += wave + 0.01;
          vWave = wave;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float opacity;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vec3 col = mix(color1, color2, vUv.x + vWave * 5.0);
          float specular = pow(max(0.0, vWave * 20.0 + 0.5), 4.0) * 0.3;
          col += vec3(specular);
          gl_FragColor = vec4(col, opacity);
        }
      `,
    });

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    const cx = 0;
    const cz = 0;
    this.waterMesh.position.set(cx, 0.01, cz);
    this.waterMesh.rotation.y = Math.PI / 4;
    this.scene.add(this.waterMesh);
  }

  private setupParticleSystem() {
    const geo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleSizes = new Float32Array(this.maxParticles);
    this.particleAlphas = new Float32Array(this.maxParticles);

    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.particleSizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'uniform float size;',
        'uniform float size;\nattribute float particleSize;'
      );
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = particleSize > 0.0 ? particleSize * 100.0 : size;'
      );
    };

    this.particleSystem = new THREE.Points(geo, mat);
    this.scene.add(this.particleSystem);
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

  private isJungleArea(x: number, y: number): boolean {
    const cx = MAP_SIZE / 2, cy = MAP_SIZE / 2;
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (d > MAP_SIZE * 0.42) return false;
    return !this.isNearLane(x, y) && !this.isNearRiver(x, y);
  }

  private setupLanes() {
    for (let l = 0; l < 3; l++) {
      const lane = LANE_WAYPOINTS[l];
      for (let i = 1; i < lane.length; i++) {
        const a = lane[i - 1], b = lane[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const width = 5;
        const geo = new THREE.PlaneGeometry(len * WORLD_SCALE, width * WORLD_SCALE);
        geo.rotateX(-Math.PI / 2);

        const laneColor = l === 1 ? 0x4a3e2e : 0x3f3628;
        const mat = new THREE.MeshStandardMaterial({
          color: laneColor,
          roughness: 0.95,
          metalness: 0.0,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(gameToWorld(
          (a.x + b.x) / 2 - MAP_SIZE / 2,
          (a.y + b.y) / 2 - MAP_SIZE / 2,
          0.015
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
      if (prefab) {
        promises.push(this.loadModel(prefab));
        if (prefab.animations) {
          const hasCustomAnims = Object.keys(prefab.animations).some(
            k => !(k in ANIMATION_PATHS) || prefab.animations![k] !== (ANIMATION_PATHS as Record<string, string>)[k]
          );
          if (hasCustomAnims && !this.prefabAnimClips.has(prefabKey)) {
            promises.push(
              loadAnimationSet(prefab.animations).then(clips => {
                this.prefabAnimClips.set(prefabKey, clips);
              })
            );
          }
        }
      }
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

    const envModelsToLoad = [
      'tree', 'rock', 'castle', 'fortress', 'banner', 'torch', 'campfire',
      'camp_fire_glb', 'gravestone', 'tree_lava',
      'crypt', 'barracks', 'forge', 'storage_house', 'hellhouse',
      'tree_house', 'cabin_shed', 'coliseum', 'necropolis_walls', 'arch',
    ];
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

  private createHealthBar(width: number, withMana = false): { bar: THREE.Mesh; bg: THREE.Mesh; mana?: THREE.Mesh } {
    const bgGeo = new THREE.PlaneGeometry(width, 0.12);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85, depthTest: false });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.renderOrder = 999;

    const barGeo = new THREE.PlaneGeometry(width, 0.1);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x22cc22, depthTest: false });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.z = 0.001;
    bar.renderOrder = 1000;

    let mana: THREE.Mesh | undefined;
    if (withMana) {
      const manaGeo = new THREE.PlaneGeometry(width, 0.06);
      const manaMat = new THREE.MeshBasicMaterial({ color: 0x4466dd, depthTest: false });
      mana = new THREE.Mesh(manaGeo, manaMat);
      mana.position.set(0, -0.1, 0.001);
      mana.renderOrder = 1000;
    }

    return { bar, bg, mana };
  }

  private createShadowDecal(radius: number): THREE.Mesh {
    const geo = new THREE.CircleGeometry(radius, 16);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.005;
    return mesh;
  }

  private getOrCreateHero(hero: MobaHero): Entity3D | null {
    if (this.heroMeshes.has(hero.id)) return this.heroMeshes.get(hero.id)!;

    const heroData = HEROES[hero.heroDataId];
    if (!heroData) return null;

    const prefabKey = getHeroPrefabKey(heroData.race, heroData.heroClass, heroData.name);
    const prefab = HERO_PREFABS[prefabKey];
    const model = prefab ? this.loadedModels.get(prefab.modelPath) : null;
    const group = new THREE.Group();
    let mixer: THREE.AnimationMixer | undefined;
    let entity: AnimatedEntity | undefined;

    if (model) {
      const clone = model.scene.clone();
      clone.scale.setScalar(prefab!.scale);
      clone.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const mesh = child as THREE.Mesh;
          if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.roughness = Math.max(0.3, mat.roughness);
            mat.envMapIntensity = 0.5;
          }
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
      const prefabAnims = this.prefabAnimClips.get(prefabKey);
      if (prefabAnims && prefabAnims.size > 0) {
        for (const [name, clip] of Array.from(prefabAnims)) {
          if (!actions.has(name)) {
            const action = mixer.clipAction(clip);
            actions.set(name, action);
          }
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
      this.buildCapsuleHero(group, heroData, hero);
    }

    if (hero.isPlayer) {
      const ringGeo = new THREE.RingGeometry(0.55, 0.65, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.015;
      ring.name = 'playerRing';
      group.add(ring);
    }

    const teamColor = new THREE.Color(TEAM_COLORS[hero.team]);
    const indicatorGeo = new THREE.RingGeometry(0.38, 0.44, 16);
    const indicatorMat = new THREE.MeshBasicMaterial({
      color: teamColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.y = 0.02;
    group.add(indicator);

    const { bar, bg, mana } = this.createHealthBar(1.2, true);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    if (mana) hpGroup.add(mana);
    hpGroup.position.y = 2.2;
    hpGroup.lookAt(this.camera.position);
    group.add(hpGroup);

    const shadow = this.createShadowDecal(0.5);
    group.add(shadow);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg, manaBar: mana, entity, mixer, shadowMesh: shadow };
    this.scene.add(group);
    this.heroMeshes.set(hero.id, entity3D);
    return entity3D;
  }

  private buildCapsuleHero(group: THREE.Group, heroData: any, hero: MobaHero) {
    const classColor = new THREE.Color(CLASS_COLORS[heroData.heroClass] || '#888');
    const teamColor = new THREE.Color(TEAM_COLORS[hero.team]);

    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'heroBody';

    const torsoGeo = new THREE.CapsuleGeometry(0.22, 0.5, 8, 16);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: classColor,
      roughness: 0.45,
      metalness: 0.25,
      emissive: classColor,
      emissiveIntensity: 0.08,
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.castShadow = true;
    torso.position.y = 0.7;
    torso.name = 'torso';
    bodyGroup.add(torso);

    const headGeo = new THREE.SphereGeometry(0.18, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xddbbaa,
      roughness: 0.6,
      metalness: 0.05,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    head.position.y = 1.25;
    head.name = 'head';
    bodyGroup.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.07, 1.28, 0.15);
      bodyGroup.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), pupilMat);
      pupil.position.set(side * 0.07, 1.28, 0.18);
      bodyGroup.add(pupil);
    }

    const legGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.45, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.castShadow = true;
      leg.position.set(side * 0.12, 0.22, 0);
      leg.name = side === -1 ? 'leftLeg' : 'rightLeg';
      bodyGroup.add(leg);
    }

    const armGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6);
    const armMat = new THREE.MeshStandardMaterial({
      color: classColor.clone().multiplyScalar(0.8),
      roughness: 0.5,
      metalness: 0.2,
    });
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.castShadow = true;
      arm.position.set(side * 0.3, 0.8, 0);
      arm.name = side === -1 ? 'leftArm' : 'rightArm';
      bodyGroup.add(arm);
    }

    this.addWeaponToBody(bodyGroup, heroData);
    group.add(bodyGroup);
  }

  private addWeaponToBody(bodyGroup: THREE.Group, heroData: any) {
    const weaponGroup = new THREE.Group();
    weaponGroup.name = 'weapon';

    if (heroData.heroClass === 'Warrior') {
      const bladeGeo = new THREE.BoxGeometry(0.04, 0.5, 0.08);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.8 });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 0.25;
      weaponGroup.add(blade);
      const hiltGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6);
      const hiltMat = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
      const hilt = new THREE.Mesh(hiltGeo, hiltMat);
      weaponGroup.add(hilt);
      const guardGeo = new THREE.BoxGeometry(0.15, 0.03, 0.03);
      const guard = new THREE.Mesh(guardGeo, new THREE.MeshStandardMaterial({ color: 0xc5a059, metalness: 0.6 }));
      guard.position.y = 0.05;
      weaponGroup.add(guard);
    } else if (heroData.heroClass === 'Worg') {
      for (const side of [-1, 0, 1]) {
        const clawGeo = new THREE.ConeGeometry(0.02, 0.15, 4);
        const clawMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.7 });
        const claw = new THREE.Mesh(clawGeo, clawMat);
        claw.position.set(side * 0.04, 0.1, 0.08);
        claw.rotation.x = -0.3;
        weaponGroup.add(claw);
      }
    } else if (heroData.heroClass === 'Ranger') {
      const bowGeo = new THREE.TorusGeometry(0.2, 0.015, 8, 16, Math.PI);
      const bowMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.7 });
      const bow = new THREE.Mesh(bowGeo, bowMat);
      bow.rotation.z = Math.PI / 2;
      weaponGroup.add(bow);
      const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.4, 4);
      const stringMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
      const string = new THREE.Mesh(stringGeo, stringMat);
      weaponGroup.add(string);
    } else if (heroData.heroClass === 'Mage') {
      const staffGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.8, 6);
      const staffMat = new THREE.MeshStandardMaterial({ color: 0x4a2f6b, roughness: 0.5 });
      const staff = new THREE.Mesh(staffGeo, staffMat);
      staff.position.y = 0.4;
      weaponGroup.add(staff);
      const orbGeo = new THREE.SphereGeometry(0.06, 12, 8);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0x8844ff,
        emissive: 0x6622cc,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.3,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 0.85;
      orb.name = 'staffOrb';
      weaponGroup.add(orb);
    }

    weaponGroup.position.set(0.35, 0.7, 0.05);
    bodyGroup.add(weaponGroup);
  }

  private animateCapsuleHero(entity3D: Entity3D, hero: MobaHero, time: number, dt: number) {
    const body = entity3D.group.getObjectByName('heroBody');
    if (!body) return;

    const torso = body.getObjectByName('torso');
    const head = body.getObjectByName('head');
    const leftLeg = body.getObjectByName('leftLeg');
    const rightLeg = body.getObjectByName('rightLeg');
    const leftArm = body.getObjectByName('leftArm');
    const rightArm = body.getObjectByName('rightArm');
    const weapon = body.getObjectByName('weapon');
    const staffOrb = body.getObjectByName('staffOrb');

    if (hero.animState === 'walk') {
      const speed = 8;
      const stride = Math.sin(time * speed);
      if (leftLeg) {
        leftLeg.rotation.x = stride * 0.4;
        leftLeg.position.y = 0.22 + Math.max(0, Math.sin(time * speed)) * 0.05;
      }
      if (rightLeg) {
        rightLeg.rotation.x = -stride * 0.4;
        rightLeg.position.y = 0.22 + Math.max(0, -Math.sin(time * speed)) * 0.05;
      }
      if (leftArm) leftArm.rotation.x = -stride * 0.3;
      if (rightArm) rightArm.rotation.x = stride * 0.3;
      if (torso) {
        torso.position.y = 0.7 + Math.abs(Math.sin(time * speed * 2)) * 0.02;
        torso.rotation.z = Math.sin(time * speed) * 0.03;
      }
      if (head) head.position.y = 1.25 + Math.abs(Math.sin(time * speed * 2)) * 0.02;

    } else if (hero.animState === 'attack' || hero.animState === 'combo_finisher' || hero.animState === 'dash_attack' || hero.animState === 'lunge_slash') {
      const attackPhase = hero.animTimer * 12;
      const swingPower = hero.animState === 'combo_finisher' ? 1.5 : 1.0;

      if (torso) {
        torso.rotation.x = Math.sin(attackPhase) * 0.2 * swingPower;
        torso.rotation.z = Math.sin(attackPhase * 0.7) * 0.1;
      }
      if (rightArm) {
        rightArm.rotation.x = -0.5 + Math.sin(attackPhase) * 0.8 * swingPower;
        rightArm.rotation.z = Math.sin(attackPhase * 0.8) * 0.3;
      }
      if (leftArm) leftArm.rotation.x = Math.sin(attackPhase * 0.5) * 0.2;
      if (weapon) {
        weapon.rotation.x = Math.sin(attackPhase) * 0.6 * swingPower;
        weapon.rotation.z = Math.sin(attackPhase * 1.2) * 0.4;
      }

    } else if (hero.animState === 'ability') {
      if (leftArm) {
        leftArm.rotation.x = -1.2 + Math.sin(time * 6) * 0.2;
        leftArm.rotation.z = -0.3;
      }
      if (rightArm) {
        rightArm.rotation.x = -1.2 + Math.sin(time * 6 + 1) * 0.2;
        rightArm.rotation.z = 0.3;
      }
      if (torso) torso.position.y = 0.7 + Math.sin(time * 4) * 0.05;
      if (staffOrb) {
        const glow = ((staffOrb as THREE.Mesh).material as THREE.MeshStandardMaterial);
        glow.emissiveIntensity = 0.8 + Math.sin(time * 8) * 0.5;
      }

    } else if (hero.animState === 'dodge') {
      if (torso) {
        torso.rotation.z = time * 15;
        torso.position.y = 0.5;
      }

    } else if (hero.animState === 'block') {
      if (leftArm) {
        leftArm.rotation.x = -0.8;
        leftArm.position.z = 0.15;
      }
      if (rightArm) {
        rightArm.rotation.x = -0.8;
        rightArm.position.z = 0.15;
      }

    } else {
      if (leftLeg) { leftLeg.rotation.x = 0; leftLeg.position.y = 0.22; }
      if (rightLeg) { rightLeg.rotation.x = 0; rightLeg.position.y = 0.22; }
      if (leftArm) { leftArm.rotation.x = 0; leftArm.rotation.z = 0; leftArm.position.z = 0; }
      if (rightArm) { rightArm.rotation.x = 0; rightArm.rotation.z = 0; }
      if (torso) { torso.rotation.set(0, 0, 0); torso.position.y = 0.7 + Math.sin(time * 2) * 0.01; }
      if (head) head.position.y = 1.25 + Math.sin(time * 2) * 0.01;
      if (weapon) weapon.rotation.set(0, 0, 0);
    }
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
      const size = minion.minionType === 'siege' ? 0.3 : 0.18;
      const teamColor = new THREE.Color(TEAM_COLORS[minion.team]);

      const bodyGeo = new THREE.BoxGeometry(size, size * 1.3, size * 0.8);
      const mat = new THREE.MeshStandardMaterial({
        color: teamColor,
        roughness: 0.55,
        metalness: 0.2,
        emissive: teamColor,
        emissiveIntensity: 0.05,
      });
      const body = new THREE.Mesh(bodyGeo, mat);
      body.castShadow = true;
      body.position.y = size * 0.7;
      body.name = 'body';
      group.add(body);

      const eyeSize = size * 0.12;
      const eyeGeo = new THREE.SphereGeometry(eyeSize, 8, 8);
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xffff88,
        emissive: 0xffff44,
        emissiveIntensity: 0.5,
      });
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(side * size * 0.2, size * 0.9, size * 0.35);
        group.add(eye);
      }

      if (minion.minionType === 'ranged') {
        const staffGeo = new THREE.CylinderGeometry(0.01, 0.015, size * 2, 4);
        const staffMat = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
        const staff = new THREE.Mesh(staffGeo, staffMat);
        staff.position.set(size * 0.4, size * 0.8, 0);
        staff.rotation.z = 0.2;
        group.add(staff);
      }
    }

    const shadow = this.createShadowDecal(0.25);
    group.add(shadow);

    const { bar, bg } = this.createHealthBar(0.6);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 1.0;
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg, mixer, shadowMesh: shadow };
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
      const isBuff = mob.mobType === 'buff';
      const size = isBuff ? 0.5 : mob.mobType === 'medium' ? 0.35 : 0.25;
      const mobColor = isBuff ? 0x7722bb : mob.mobType === 'medium' ? 0x2266aa : 0x228844;

      const bodyGeo = isBuff ? new THREE.DodecahedronGeometry(size, 1) : new THREE.SphereGeometry(size, 10, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: mobColor,
        roughness: 0.4,
        metalness: 0.25,
        emissive: new THREE.Color(mobColor),
        emissiveIntensity: isBuff ? 0.3 : 0.15,
      });
      const body = new THREE.Mesh(bodyGeo, mat);
      body.castShadow = true;
      body.position.y = size;
      body.name = 'mobBody';
      group.add(body);

      if (isBuff) {
        const crownGeo = new THREE.ConeGeometry(size * 0.3, size * 0.4, 5);
        const crownMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          emissive: 0xffa000,
          emissiveIntensity: 0.4,
          metalness: 0.7,
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.y = size * 2;
        group.add(crown);

        const glowLight = new THREE.PointLight(mobColor, 0.8, 5);
        glowLight.position.y = size;
        group.add(glowLight);
      }

      const eyeGeo = new THREE.SphereGeometry(size * 0.18, 8, 8);
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xff2222,
        emissive: 0xff0000,
        emissiveIntensity: 0.6,
      });
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(side * size * 0.35, size * 1.2, size * 0.55);
        group.add(eye);
      }
    }

    const shadow = this.createShadowDecal(mob.mobType === 'buff' ? 0.6 : 0.3);
    group.add(shadow);

    const { bar, bg } = this.createHealthBar(mob.mobType === 'buff' ? 1.2 : 0.8);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = mob.mobType === 'buff' ? 2.0 : 1.5;
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg, mixer, shadowMesh: shadow };
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

      const baseGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.9 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.castShadow = true;
      base.position.y = 0.25;
      group.add(base);

      const bodyGeo = new THREE.CylinderGeometry(0.45, 0.6, 2.8, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.75, metalness: 0.1 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.position.y = 1.9;
      group.add(body);

      const crenGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.3, 8);
      const crenMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.8 });
      const cren = new THREE.Mesh(crenGeo, crenMat);
      cren.castShadow = true;
      cren.position.y = 3.45;
      group.add(cren);

      const topGeo = new THREE.ConeGeometry(0.55, 1.0, 8);
      const topMat = new THREE.MeshStandardMaterial({
        color: teamColor,
        roughness: 0.4,
        metalness: 0.35,
        emissive: teamColor,
        emissiveIntensity: 0.1,
      });
      const top = new THREE.Mesh(topGeo, topMat);
      top.castShadow = true;
      top.position.y = 4.1;
      group.add(top);

      const orbGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const orbMat = new THREE.MeshStandardMaterial({
        color: teamColor,
        emissive: teamColor,
        emissiveIntensity: 1.0,
        roughness: 0.1,
        metalness: 0.5,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 4.7;
      orb.name = 'towerOrb';
      group.add(orb);

      const light = new THREE.PointLight(teamColor.getHex(), 1.0, 10);
      light.position.y = 4.7;
      group.add(light);
    }

    const shadow = this.createShadowDecal(1.0);
    group.add(shadow);

    const { bar, bg } = this.createHealthBar(1.5);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 5.2;
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

    const baseGeo = new THREE.CylinderGeometry(1.5, 2, 0.6, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.85, metalness: 0.1 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.castShadow = true;
    base.receiveShadow = true;
    base.position.y = 0.3;
    group.add(base);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pillarGeo = new THREE.CylinderGeometry(0.12, 0.15, 2, 6);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.7, metalness: 0.15 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.castShadow = true;
      pillar.position.set(Math.cos(angle) * 1.2, 1.3, Math.sin(angle) * 1.2);
      group.add(pillar);
    }

    const crystalGeo = new THREE.OctahedronGeometry(0.8, 1);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      emissive: teamColor,
      emissiveIntensity: 0.7,
      roughness: 0.05,
      metalness: 0.85,
      transparent: true,
      opacity: 0.85,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.castShadow = true;
    crystal.position.y = 2.0;
    crystal.name = 'crystal';
    group.add(crystal);

    const shellGeo = new THREE.IcosahedronGeometry(1.2, 1);
    const shellMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
      emissive: teamColor,
      emissiveIntensity: 0.2,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = 2.0;
    shell.name = 'shell';
    group.add(shell);

    const light = new THREE.PointLight(teamColor.getHex(), 2.0, 18);
    light.position.y = 2.0;
    group.add(light);

    const shadow = this.createShadowDecal(1.5);
    group.add(shadow);

    const { bar, bg } = this.createHealthBar(2.0);
    const hpGroup = new THREE.Group();
    hpGroup.add(bg);
    hpGroup.add(bar);
    hpGroup.position.y = 3.8;
    group.add(hpGroup);

    const entity3D: Entity3D = { group, healthBar: bar, healthBg: bg };
    this.scene.add(group);
    this.nexusMeshes.set(nexus.id, entity3D);
    return entity3D;
  }

  private updateHealthBar(entity3D: Entity3D, hp: number, maxHp: number, teamColor: string, mp?: number, maxMp?: number) {
    if (!entity3D.healthBar || !entity3D.healthBg) return;
    const ratio = Math.max(0, hp / maxHp);
    entity3D.healthBar.scale.x = Math.max(0.01, ratio);
    entity3D.healthBar.position.x = -(1 - ratio) * 0.6;

    const mat = entity3D.healthBar.material as THREE.MeshBasicMaterial;
    if (ratio > 0.6) mat.color.setHex(0x22cc22);
    else if (ratio > 0.3) mat.color.setHex(0xddcc22);
    else mat.color.setHex(0xcc2222);

    if (entity3D.manaBar && mp !== undefined && maxMp !== undefined && maxMp > 0) {
      const manaRatio = Math.max(0, mp / maxMp);
      entity3D.manaBar.scale.x = Math.max(0.01, manaRatio);
      entity3D.manaBar.position.x = -(1 - manaRatio) * 0.6;
    }

    const hpGroup = entity3D.healthBar.parent;
    if (hpGroup) {
      hpGroup.lookAt(this.camera.position);
    }
  }

  private spawnProjectile3D(proj: Projectile) {
    if (this.projectileMeshes.has(proj.id)) return;

    const projGroup = new THREE.Group();
    const color = new THREE.Color(proj.color);

    const coreGeo = new THREE.SphereGeometry(proj.size * 0.025, 10, 10);
    const coreMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.3,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    projGroup.add(core);

    const glowGeo = new THREE.SphereGeometry(proj.size * 0.04, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    projGroup.add(glow);

    const trailGeo = new THREE.CylinderGeometry(proj.size * 0.008, proj.size * 0.02, proj.size * 0.15, 6);
    const trailMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const trail = new THREE.Mesh(trailGeo, trailMat.clone());
      trail.position.z = -(i + 1) * proj.size * 0.03;
      (trail.material as THREE.MeshBasicMaterial).opacity = 0.25 - i * 0.05;
      trail.name = `trail_${i}`;
      projGroup.add(trail);
    }

    const light = new THREE.PointLight(color.getHex(), 0.5, 3);
    projGroup.add(light);

    this.scene.add(projGroup);
    this.projectileMeshes.set(proj.id, projGroup);
  }

  private spawnSpellProjectile3D(sp: SpellProjectile) {
    if (this.spellProjectileMeshes.has(sp.id)) return;

    const spGroup = new THREE.Group();
    const color = new THREE.Color(sp.color);
    const trailColor = new THREE.Color(sp.trailColor);

    const size = sp.radius * 0.03;
    const coreGeo = new THREE.SphereGeometry(size, 12, 12);
    const coreMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.5,
      roughness: 0.05,
      metalness: 0.4,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    spGroup.add(core);

    const glowGeo = new THREE.SphereGeometry(size * 2, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: trailColor,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'spellGlow';
    spGroup.add(glow);

    const ringGeo = new THREE.RingGeometry(size * 1.2, size * 1.8, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: trailColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.name = 'spellRing';
    spGroup.add(ring);

    const light = new THREE.PointLight(color.getHex(), 1.0, 6);
    spGroup.add(light);

    this.scene.add(spGroup);
    this.spellProjectileMeshes.set(sp.id, spGroup);
  }

  private createSpellVFX(effect: SpellEffect) {
    const group = new THREE.Group();
    const wx = (effect.x - MAP_SIZE / 2) * WORLD_SCALE;
    const wz = (effect.y - MAP_SIZE / 2) * WORLD_SCALE;
    group.position.set(wx, 0.05, wz);

    let updateFn = (_dt: number, _life: number) => {};
    const color = new THREE.Color(effect.color);

    switch (effect.type) {
      case 'fire_ring': {
        const ringGeo = new THREE.RingGeometry(0.1, effect.radius * WORLD_SCALE, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff4400,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        const light = new THREE.PointLight(0xff4400, 2, 8);
        light.position.y = 0.5;
        group.add(light);

        updateFn = (_dt, life) => {
          const p = 1 - life / effect.maxLife;
          ring.scale.setScalar(0.3 + p * 1.5);
          ringMat.opacity = (1 - p) * 0.8;
          light.intensity = (1 - p) * 2;
        };
        break;
      }
      case 'frost_ring': {
        const ringGeo = new THREE.RingGeometry(0.1, effect.radius * WORLD_SCALE, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x44ccff,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        const light = new THREE.PointLight(0x44ccff, 1.5, 6);
        light.position.y = 0.3;
        group.add(light);

        updateFn = (_dt, life) => {
          const p = 1 - life / effect.maxLife;
          ring.scale.setScalar(0.3 + p * 1.5);
          ringMat.opacity = (1 - p) * 0.7;
          light.intensity = (1 - p) * 1.5;
        };
        break;
      }
      case 'meteor_shadow': {
        const circleGeo = new THREE.CircleGeometry(effect.radius * WORLD_SCALE, 24);
        const circleMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        });
        const circle = new THREE.Mesh(circleGeo, circleMat);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = 0.01;
        group.add(circle);

        const warnGeo = new THREE.RingGeometry(0.05, effect.radius * WORLD_SCALE, 32);
        const warnMat = new THREE.MeshBasicMaterial({
          color: 0xff2200,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const warn = new THREE.Mesh(warnGeo, warnMat);
        warn.rotation.x = -Math.PI / 2;
        warn.position.y = 0.02;
        group.add(warn);

        updateFn = (_dt, life) => {
          const p = 1 - life / effect.maxLife;
          circle.scale.setScalar(0.5 + p * 0.8);
          circleMat.opacity = 0.2 + p * 0.4;
          warnMat.opacity = 0.3 + Math.sin(p * 20) * 0.3;
        };
        break;
      }
      case 'meteor_impact': {
        const explosionGeo = new THREE.SphereGeometry(effect.radius * WORLD_SCALE * 0.8, 16, 12);
        const explosionMat = new THREE.MeshBasicMaterial({
          color: 0xff6600,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const explosion = new THREE.Mesh(explosionGeo, explosionMat);
        explosion.position.y = 0.5;
        group.add(explosion);

        const coreGeo = new THREE.SphereGeometry(effect.radius * WORLD_SCALE * 0.3, 12, 8);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 0.5;
        group.add(core);

        const light = new THREE.PointLight(0xff6600, 5, 15);
        light.position.y = 1;
        group.add(light);

        updateFn = (_dt, life) => {
          const p = 1 - life / effect.maxLife;
          explosion.scale.setScalar(0.5 + p * 2);
          explosionMat.opacity = (1 - p) * 0.9;
          coreMat.opacity = Math.max(0, 1 - p * 2);
          light.intensity = (1 - p) * 5;
        };
        break;
      }
      case 'arrow_rain': {
        const areaGeo = new THREE.CircleGeometry(effect.radius * WORLD_SCALE, 24);
        const areaMat = new THREE.MeshBasicMaterial({
          color: 0x22aa44,
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        });
        const area = new THREE.Mesh(areaGeo, areaMat);
        area.rotation.x = -Math.PI / 2;
        area.position.y = 0.02;
        group.add(area);

        for (let i = 0; i < 8; i++) {
          const arrowGeo = new THREE.ConeGeometry(0.02, 0.15, 4);
          const arrowMat = new THREE.MeshStandardMaterial({ color: 0x22aa44, metalness: 0.3 });
          const arrow = new THREE.Mesh(arrowGeo, arrowMat);
          arrow.name = `arrow_${i}`;
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * effect.radius * WORLD_SCALE;
          arrow.position.set(Math.cos(angle) * dist, 3 + Math.random() * 2, Math.sin(angle) * dist);
          arrow.rotation.x = Math.PI;
          group.add(arrow);
        }

        updateFn = (dt, life) => {
          group.children.forEach(child => {
            if (child.name.startsWith('arrow_')) {
              child.position.y -= dt * 4;
              if (child.position.y < 0.1) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * effect.radius * WORLD_SCALE;
                child.position.set(Math.cos(angle) * dist, 3 + Math.random(), Math.sin(angle) * dist);
              }
            }
          });
          areaMat.opacity = Math.min(0.15, life / effect.maxLife * 0.15);
        };
        break;
      }
      case 'whirlwind_slash': {
        const arcLen = Math.PI * 1.2;
        const arcGeo = new THREE.RingGeometry(0.3, effect.radius * WORLD_SCALE, 16, 1, 0, arcLen);
        const arcMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const arc = new THREE.Mesh(arcGeo, arcMat);
        arc.rotation.x = -Math.PI / 2;
        arc.position.y = 0.5;
        group.add(arc);

        updateFn = (dt, life) => {
          arc.rotation.z += dt * 12;
          arcMat.opacity = (life / effect.maxLife) * 0.7;
        };
        break;
      }
      case 'ground_scorch': {
        const scorchGeo = new THREE.CircleGeometry(effect.radius * WORLD_SCALE, 16);
        const scorchMat = new THREE.MeshBasicMaterial({
          color: 0x221100,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        const scorch = new THREE.Mesh(scorchGeo, scorchMat);
        scorch.rotation.x = -Math.PI / 2;
        scorch.position.y = 0.008;
        group.add(scorch);

        updateFn = (_dt, life) => {
          scorchMat.opacity = (life / effect.maxLife) * 0.5;
        };
        break;
      }
      case 'ground_frost': {
        const frostGeo = new THREE.CircleGeometry(effect.radius * WORLD_SCALE, 16);
        const frostMat = new THREE.MeshBasicMaterial({
          color: 0x88ccff,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        const frost = new THREE.Mesh(frostGeo, frostMat);
        frost.rotation.x = -Math.PI / 2;
        frost.position.y = 0.008;
        group.add(frost);

        updateFn = (_dt, life) => {
          frostMat.opacity = (life / effect.maxLife) * 0.35;
        };
        break;
      }
      case 'combo_burst': {
        for (let i = 0; i < 8; i++) {
          const rayAngle = (i / 8) * Math.PI * 2;
          const rayGeo = new THREE.PlaneGeometry(0.04, effect.radius * WORLD_SCALE);
          const rayMat = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const ray = new THREE.Mesh(rayGeo, rayMat);
          ray.rotation.z = rayAngle;
          ray.position.y = 0.5;
          ray.name = `ray_${i}`;
          group.add(ray);
        }

        const light = new THREE.PointLight(0xffd700, 3, 8);
        light.position.y = 0.5;
        group.add(light);

        updateFn = (_dt, life) => {
          const p = 1 - life / effect.maxLife;
          group.children.forEach(child => {
            if (child.name.startsWith('ray_') && (child as THREE.Mesh).material) {
              ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8;
              child.scale.setScalar(0.5 + p * 1.5);
            }
          });
        };
        break;
      }
      case 'cast_circle':
      case 'telegraph_circle': {
        const circGeo = new THREE.RingGeometry(0.05, effect.radius * WORLD_SCALE, 32);
        const circMat = new THREE.MeshBasicMaterial({
          color: effect.type === 'telegraph_circle' ? 0xff4444 : color,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const circ = new THREE.Mesh(circGeo, circMat);
        circ.rotation.x = -Math.PI / 2;
        circ.position.y = 0.02;
        group.add(circ);

        updateFn = (_dt, life) => {
          const p = 1 - life / effect.maxLife;
          if (effect.type === 'telegraph_circle') {
            circMat.opacity = 0.3 + Math.sin(p * 15) * 0.2;
          } else {
            circ.scale.setScalar(0.3 + p);
            circMat.opacity = (1 - p) * 0.5;
          }
        };
        break;
      }
      default: {
        const defaultGeo = new THREE.RingGeometry(0.1, effect.radius * WORLD_SCALE * 0.5, 16);
        const defaultMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const def = new THREE.Mesh(defaultGeo, defaultMat);
        def.rotation.x = -Math.PI / 2;
        group.add(def);

        updateFn = (_dt, life) => {
          defaultMat.opacity = (life / effect.maxLife) * 0.5;
        };
        break;
      }
    }

    this.scene.add(group);
    this.spellVFX.push({
      group,
      life: effect.life,
      maxLife: effect.maxLife,
      type: effect.type,
      update: updateFn,
    });
  }

  private createAreaZone3D(zone: AreaDamageZoneState) {
    if (this.areaZoneMeshes.has(zone.id)) return;

    const zoneGroup = new THREE.Group();
    const wx = (zone.x - MAP_SIZE / 2) * WORLD_SCALE;
    const wz = (zone.y - MAP_SIZE / 2) * WORLD_SCALE;
    zoneGroup.position.set(wx, 0.03, wz);

    const zoneType = (zone as any).damageType || 'fire';
    const zoneColors: Record<string, number> = {
      fire: 0xff4400, frost: 0x44ccff, poison: 0x44cc44,
      lightning: 0xffdd44, holy: 0xffffff, shadow: 0x8844ff,
    };
    const zoneColor = zoneColors[zoneType] || 0xff4400;

    const areaGeo = new THREE.CircleGeometry(zone.radius * WORLD_SCALE, 32);
    const areaMat = new THREE.MeshBasicMaterial({
      color: zoneColor,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const area = new THREE.Mesh(areaGeo, areaMat);
    area.rotation.x = -Math.PI / 2;
    area.name = 'zoneArea';
    zoneGroup.add(area);

    const borderGeo = new THREE.RingGeometry(zone.radius * WORLD_SCALE * 0.95, zone.radius * WORLD_SCALE, 32);
    const borderMat = new THREE.MeshBasicMaterial({
      color: zoneColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.01;
    border.name = 'zoneBorder';
    zoneGroup.add(border);

    const light = new THREE.PointLight(zoneColor, 0.5, zone.radius * WORLD_SCALE * 2);
    light.position.y = 0.5;
    zoneGroup.add(light);

    this.scene.add(zoneGroup);
    this.areaZoneMeshes.set(zone.id, zoneGroup);
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
        const envPrefab = ENV_PREFABS[deco.type];
        const loadedModel = envPrefab ? this.loadedModels.get(envPrefab.modelPath) : null;
        if (envPrefab && loadedModel) {
          const clone = loadedModel.scene.clone();
          clone.scale.setScalar(envPrefab.scale * (0.8 + Math.random() * 0.4));
          clone.rotation.y = Math.random() * Math.PI * 2;
          clone.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
          group.add(clone);
        } else if (deco.type === 'tree') {
          const trunkGeo = new THREE.CylinderGeometry(0.08, 0.13, 0.9, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.castShadow = true;
          trunk.position.y = 0.45;
          group.add(trunk);

          const crownGeo = new THREE.IcosahedronGeometry(0.5, 1);
          const green = 0x1a6633 + Math.floor(Math.random() * 0x112211);
          const crownMat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.85 });
          const crown = new THREE.Mesh(crownGeo, crownMat);
          crown.castShadow = true;
          crown.position.y = 1.2;
          crown.scale.set(1, 0.7 + Math.random() * 0.3, 1);
          group.add(crown);
        } else if (deco.type === 'rock') {
          const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.15, 0);
          const rockMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.95, metalness: 0.05 });
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.castShadow = true;
          rock.position.y = 0.15;
          rock.rotation.set(Math.random(), Math.random(), Math.random());
          group.add(rock);
        } else {
          const structColors: Record<string, number> = {
            coliseum: 0x8b7355, barracks: 0x5c3d1e, forge: 0x4a3728, crypt: 0x2d2d3d,
            necropolis_walls: 0x1f1f2e, arch: 0x9ca3af, tree_house: 0x3d5c1e,
            hellhouse: 0x3d1f1f, cabin_shed: 0x6b4423, storage_house: 0x5c4a32,
            camp_fire_glb: 0xef4444, gravestone: 0x6b7280, tree_lava: 0x7f1d1d,
          };
          const col = structColors[deco.type] || 0x888888;
          const sz = deco.type === 'coliseum' ? 1.5 : deco.type === 'camp_fire_glb' ? 0.3 : 0.6;
          const geo = new THREE.BoxGeometry(sz, sz * 0.8, sz);
          const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, metalness: 0.05 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.y = sz * 0.4;
          group.add(mesh);

          if (deco.type === 'camp_fire_glb') {
            const fireLight = new THREE.PointLight(0xff6622, 1.2, 5);
            fireLight.position.y = 0.5;
            group.add(fireLight);
          }
        }
      }

      group.position.copy(gameToWorld(wx, wy));
      this.scene.add(group);
      this.envObjects.push(group);
    }
  }

  private updateParticleSystem(state: MobaState) {
    this.activeParticleCount = 0;
    const maxToShow = Math.min(state.particles.length, this.maxParticles);

    for (let i = 0; i < maxToShow; i++) {
      const p = state.particles[i];
      if (p.life <= 0) continue;

      const idx = this.activeParticleCount;
      const wx = (p.x - MAP_SIZE / 2) * WORLD_SCALE;
      const wz = (p.y - MAP_SIZE / 2) * WORLD_SCALE;
      const wy = 0.5 + p.vy * 0.002;

      this.particlePositions[idx * 3] = wx;
      this.particlePositions[idx * 3 + 1] = wy;
      this.particlePositions[idx * 3 + 2] = wz;

      _tempColor.set(p.color);
      const alpha = Math.max(0, p.life / p.maxLife);
      this.particleColors[idx * 3] = _tempColor.r * alpha;
      this.particleColors[idx * 3 + 1] = _tempColor.g * alpha;
      this.particleColors[idx * 3 + 2] = _tempColor.b * alpha;

      this.particleSizes[idx] = p.size * 0.03 * alpha;
      this.activeParticleCount++;
    }

    for (let i = this.activeParticleCount; i < this.maxParticles; i++) {
      this.particlePositions[i * 3] = 0;
      this.particlePositions[i * 3 + 1] = -100;
      this.particlePositions[i * 3 + 2] = 0;
      this.particleSizes[i] = 0;
    }

    const geo = this.particleSystem.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  render(state: MobaState) {
    if (!this.initialized) return;

    const dt = this.clock.getDelta();
    this.elapsedTime += dt;
    const time = this.elapsedTime;

    if (!this.loadingComplete) {
      this.loadModels(state);
    }

    if (this.envObjects.length === 0 && state.decorations.length > 0) {
      this.placeDecorations(state);
    }

    this.physicsWorld.step(PHYSICS_STEP, dt, 3);

    if (this.waterMesh) {
      const wMat = this.waterMesh.material as THREE.ShaderMaterial;
      wMat.uniforms.time.value = time;
    }

    const player = state.heroes[state.playerHeroIndex];
    if (player) {
      const targetX = (player.x - MAP_SIZE / 2) * WORLD_SCALE;
      const targetZ = (player.y - MAP_SIZE / 2) * WORLD_SCALE;
      const camDist = 22 / state.camera.zoom;
      const camHeight = 16 / state.camera.zoom;

      this.cameraTarget.set(targetX, 0, targetZ);
      this.cameraSmooth.lerp(this.cameraTarget, 0.06);

      this.cameraShake.set(0, 0, 0);
      if (state.screenShake > 0) {
        const shakeIntensity = state.screenShake * 0.3;
        this.cameraShake.set(
          (Math.random() - 0.5) * shakeIntensity,
          (Math.random() - 0.5) * shakeIntensity * 0.5,
          (Math.random() - 0.5) * shakeIntensity
        );
      }

      const camX = this.cameraSmooth.x - camDist * 0.3 + this.cameraShake.x;
      const camY = camHeight + this.cameraShake.y;
      const camZ = this.cameraSmooth.z + camDist + this.cameraShake.z;

      this.camera.position.x += (camX - this.camera.position.x) * 0.1;
      this.camera.position.y += (camY - this.camera.position.y) * 0.1;
      this.camera.position.z += (camZ - this.camera.position.z) * 0.1;
      this.camera.lookAt(this.cameraSmooth.x, 0, this.cameraSmooth.z);

      this.sunLight.target.position.copy(this.cameraSmooth);
      this.sunLight.position.set(
        this.cameraSmooth.x + 60,
        100,
        this.cameraSmooth.z + 40
      );
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
        const hasAnim = (name: string) => e.entity!.actions.has(name);
        const targetAnim = mapAnimState(hero.animState, hero.dead, hasAnim);
        if (e.entity.currentAction !== targetAnim) {
          playAnimation(e.entity, targetAnim, 0.15);
        }
        const isOneShot = targetAnim === 'attack' || targetAnim === 'slash' || targetAnim === 'block' || targetAnim === 'jump';
        if (isOneShot) {
          const oneShotAction = e.entity.actions.get(targetAnim);
          if (oneShotAction && !hero.dead) {
            oneShotAction.setLoop(THREE.LoopOnce, 1);
            oneShotAction.clampWhenFinished = true;
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
        this.animateCapsuleHero(e, hero, time, dt);
      }

      const playerRing = e.group.getObjectByName('playerRing');
      if (playerRing) {
        playerRing.rotation.z = time * 0.5;
        (playerRing as THREE.Mesh).material = ((playerRing as THREE.Mesh).material as THREE.MeshBasicMaterial);
        ((playerRing as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time * 3) * 0.15;
      }

      this.updateHealthBar(e, hero.hp, hero.maxHp, TEAM_COLORS[hero.team], hero.mp, hero.maxMp);

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

      const body = e.group.getObjectByName('body');
      if (body) {
        body.position.y = (minion.minionType === 'siege' ? 0.3 : 0.18) * 0.7 + Math.abs(Math.sin(time * 5 + minion.id)) * 0.015;
      }

      this.updateHealthBar(e, minion.hp, minion.maxHp, TEAM_COLORS[minion.team]);
      if (e.mixer) e.mixer.update(dt);
    }

    for (const camp of state.jungleCamps) {
      for (const mob of camp.mobs) {
        if (mob.dead) {
          const existing = this.jungleMobMeshes.get(mob.id);
          if (existing) existing.group.visible = false;
          continue;
        }
        const e = this.getOrCreateJungleMob(mob);
        e.group.visible = true;
        const wx = (mob.x - MAP_SIZE / 2) * WORLD_SCALE;
        const wz = (mob.y - MAP_SIZE / 2) * WORLD_SCALE;
        e.group.position.set(wx, 0, wz);

        const mobBody = e.group.getObjectByName('mobBody');
        if (mobBody) {
          const baseY = mob.mobType === 'buff' ? 0.5 : mob.mobType === 'medium' ? 0.35 : 0.25;
          mobBody.position.y = baseY + Math.sin(time * 3 + mob.id * 1.7) * 0.04;
          mobBody.rotation.y = time * 0.5;
        }

        this.updateHealthBar(e, mob.hp, mob.maxHp, '#22cc22');
        if (e.mixer) e.mixer.update(dt);
      }
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

      const orb = e.group.getObjectByName('towerOrb');
      if (orb) {
        orb.position.y = 4.7 + Math.sin(time * 2) * 0.05;
        const orbMat = (orb as THREE.Mesh).material as THREE.MeshStandardMaterial;
        orbMat.emissiveIntensity = 0.8 + Math.sin(time * 3) * 0.3;
      }

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
        crystal.position.y = 2.0 + Math.sin(time * 1.5) * 0.12;
      }
      const shell = e.group.getObjectByName('shell');
      if (shell) {
        shell.rotation.y -= dt * 0.3;
        shell.rotation.x += dt * 0.15;
      }

      this.updateHealthBar(e, nexus.hp, nexus.maxHp, TEAM_COLORS[nexus.team]);
    }

    const activeProjectileIds = new Set(state.projectiles.map(p => p.id));
    for (const [id, grp] of Array.from(this.projectileMeshes)) {
      if (!activeProjectileIds.has(id)) {
        this.scene.remove(grp);
        this.projectileMeshes.delete(id);
      }
    }

    for (const proj of state.projectiles) {
      this.spawnProjectile3D(proj);
      const grp = this.projectileMeshes.get(proj.id);
      if (grp) {
        const wx = (proj.x - MAP_SIZE / 2) * WORLD_SCALE;
        const wz = (proj.y - MAP_SIZE / 2) * WORLD_SCALE;
        grp.position.set(wx, 0.5, wz);
        grp.rotation.y += dt * 3;
      }
    }

    const activeSpellProjIds = new Set(state.spellProjectiles.map(sp => sp.id));
    for (const [id, grp] of Array.from(this.spellProjectileMeshes)) {
      if (!activeSpellProjIds.has(id)) {
        this.scene.remove(grp);
        this.spellProjectileMeshes.delete(id);
      }
    }

    for (const sp of state.spellProjectiles) {
      this.spawnSpellProjectile3D(sp);
      const grp = this.spellProjectileMeshes.get(sp.id);
      if (grp) {
        const wx = (sp.x - MAP_SIZE / 2) * WORLD_SCALE;
        const wz = (sp.y - MAP_SIZE / 2) * WORLD_SCALE;
        grp.position.set(wx, 0.6, wz);

        const angle = Math.atan2(sp.vy, sp.vx);
        grp.rotation.y = -angle + Math.PI / 2;

        const glow = grp.getObjectByName('spellGlow');
        if (glow) {
          glow.scale.setScalar(0.8 + Math.sin(time * 8) * 0.2);
        }
        const ring = grp.getObjectByName('spellRing');
        if (ring) {
          ring.rotation.x += dt * 5;
          ring.rotation.z += dt * 3;
        }
      }
    }

    for (const effect of state.spellEffects) {
      const key = `${effect.type}_${Math.round(effect.x)}_${Math.round(effect.y)}_${Math.round(effect.maxLife * 10)}`;
      let found = false;
      for (const vfx of this.spellVFX) {
        if ((vfx as any).key === key) {
          found = true;
          vfx.life = effect.life;
          break;
        }
      }
      if (!found && effect.life > 0.05) {
        this.createSpellVFX(effect);
        if (this.spellVFX.length > 0) {
          (this.spellVFX[this.spellVFX.length - 1] as any).key = key;
        }
      }
    }

    for (let i = this.spellVFX.length - 1; i >= 0; i--) {
      const vfx = this.spellVFX[i];
      vfx.life -= dt;
      vfx.update(dt, Math.max(0, vfx.life));
      if (vfx.life <= 0) {
        this.scene.remove(vfx.group);
        this.spellVFX.splice(i, 1);
      }
    }

    const activeZoneIds = new Set(state.areaDamageZones.map(z => z.id));
    for (const [id, grp] of Array.from(this.areaZoneMeshes)) {
      if (!activeZoneIds.has(id)) {
        this.scene.remove(grp);
        this.areaZoneMeshes.delete(id);
      }
    }
    for (const zone of state.areaDamageZones) {
      this.createAreaZone3D(zone);
      const grp = this.areaZoneMeshes.get(zone.id);
      if (grp) {
        const border = grp.getObjectByName('zoneBorder');
        if (border) {
          (border as THREE.Mesh).rotation.z = time * 0.5;
          const bMat = (border as THREE.Mesh).material as THREE.MeshBasicMaterial;
          bMat.opacity = 0.3 + Math.sin(time * 4) * 0.2;
        }
      }
    }

    this.updateParticleSystem(state);
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

    const mobIds = new Set<number>();
    for (const camp of state.jungleCamps) {
      for (const mob of camp.mobs) {
        if (!mob.dead) mobIds.add(mob.id);
      }
    }
    for (const [id, e] of Array.from(this.jungleMobMeshes)) {
      if (!mobIds.has(id)) {
        this.scene.remove(e.group);
        this.jungleMobMeshes.delete(id);
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
