import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildVoxel3DCharacter, idlePose, walkPose } from '@/game/voxel3d';
import { SandboxWorld, SandboxTool, PROP_CATALOG } from '@/game/sandbox-physics';
import { VoxelController } from '@/game/voxel-controller';
import { startSession, getSessionId } from '@/lib/grudge-uuid';

export default function SandboxPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState(SandboxTool.Hand);
  const [objCount, setObjCount] = useState(0);
  const [showSpawnMenu, setShowSpawnMenu] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sessionId = startSession();
    console.log(`[Sandbox] Session: ${sessionId}`);

    // ── Renderer ──────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;outline:none;';
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // ── Scene ─────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88ccff);
    scene.fog = new THREE.FogExp2(0x88ccff, 0.003);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(0, 5, 10);

    // Lighting
    scene.add(new THREE.AmbientLight(0x404040, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(50, 80, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    scene.add(sun);

    // Ground (visual only — physics ground is in SandboxWorld)
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ── Sandbox physics world ─────────────────────────────
    const sandbox = new SandboxWorld(scene);

    // Scatter some initial props
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;
      sandbox.createBox(1, 1, 1, x, 0.5, z, 10, 0x885533);
    }
    for (let i = 0; i < 4; i++) {
      sandbox.createSphere(0.5, (Math.random() - 0.5) * 20, 2, (Math.random() - 0.5) * 20, 5, 0xff4444, true);
    }

    // ── Player voxel character (sync race/class from saved hero) ──
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
    rig.group.position.set(0, 0, 0);
    scene.add(rig.group);

    // ── Controller ────────────────────────────────────────
    const controller = new VoxelController(camera, rig.group, canvas, ground, {
      onToolChange: (t) => setTool(t),
      onAttack: (type) => {
        // Spawn object at crosshair position for sandbox
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const pos = camera.position.clone().add(dir.multiplyScalar(5));
        pos.y = Math.max(1, pos.y);
        if (type === 'lmb') sandbox.createBox(1, 1, 1, pos.x, pos.y, pos.z, 5, Math.random() * 0xffffff);
        if (type === 'rmb') sandbox.createSphere(0.5, pos.x, pos.y, pos.z, 5, Math.random() * 0xffffff, true);
      },
    });

    // Q key spawn menu
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'q') setShowSpawnMenu(e.type === 'keydown');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    // Listen for spawn events from the spawn menu UI
    const onSpawn = (e: Event) => {
      const type = (e as CustomEvent).detail as string;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const pos = camera.position.clone().add(dir.multiplyScalar(5));
      pos.y = Math.max(0.5, pos.y);
      sandbox.spawnProp(type, pos);
    };
    window.addEventListener('sandbox-spawn', onSpawn);

    // ── Render loop ───────────────────────────────────────
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
      const pose = controller.isMoving() ? walkPose(time) : idlePose(time);
      rig.setPose(pose);
      rig.update(dt);

      renderer.render(scene, camera);
      setObjCount(sandbox.objects.length);
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
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('sandbox-spawn', onSpawn);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
  }, []);

  const spawnProp = (type: string) => {
    // Dispatch custom event for sandbox to handle
    window.dispatchEvent(new CustomEvent('sandbox-spawn', { detail: type }));
  };

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'relative', background: '#111' }}>
      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 12, color: '#fff', fontFamily: "'Oxanium',monospace", fontSize: 12, background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: 8, pointerEvents: 'none' }}>
        <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>VOXEL SANDBOX</div>
        <div>Objects: {objCount}</div>
        <div>Tool: {SandboxTool[tool]}</div>
        <div style={{ color: '#888', marginTop: 4 }}>WASD Move · LMB Box · RMB Ball · Q Spawn</div>
      </div>

      {/* Spawn Menu */}
      {showSpawnMenu && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(10,15,20,0.95)', border: '1px solid #444', borderRadius: 8, padding: 20, color: '#fff', fontFamily: "'Oxanium',monospace", zIndex: 100, minWidth: 400 }}>
          <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>SPAWN MENU</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {Object.entries(PROP_CATALOG).map(([key, def]) => (
              <div key={key} onClick={() => spawnProp(key)} style={{ background: '#333', borderRadius: 4, padding: 8, textAlign: 'center', cursor: 'pointer', border: '1px solid #555', fontSize: 11 }}>
                {def.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crosshair */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 4, height: 4, background: '#00ffcc', borderRadius: '50%', pointerEvents: 'none', boxShadow: '0 0 8px #00ffcc' }} />
    </div>
  );
}
