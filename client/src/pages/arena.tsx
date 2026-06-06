import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildVoxel3DCharacter } from '@/game/voxel3d';
import { ArenaFighter, ArenaParticles, resolveCombat, updateCPU, type FighterStats } from '@/game/arena-fighter';

const RACES = ['Human', 'Barbarian', 'Dwarf', 'Elf', 'Orc', 'Undead'];
const CLASSES = ['Warrior', 'Mage', 'Ranger', 'Worg'];

export default function ArenaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [p1Hp, setP1Hp] = useState(100);
  const [p2Hp, setP2Hp] = useState(100);
  const [timer, setTimer] = useState(60);
  const [winner, setWinner] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'fighting' | 'gameover'>('fighting');

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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x220033);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.5, 6);

    // Lighting
    scene.add(new THREE.AmbientLight(0x404040, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Grid floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(30, 30, 0x00ffcc, 0x333355));

    // Particles
    const particles = new ArenaParticles(scene);

    // Player character from Grudge data
    const pRace = localStorage.getItem('grudge_hero_race') || 'Human';
    const pClass = localStorage.getItem('grudge_hero_class') || 'Warrior';
    const p1Rig = buildVoxel3DCharacter(pRace, pClass);
    scene.add(p1Rig.group);
    const p1Stats: FighterStats = { speed: 1.0, power: 1.0, reach: 1.0 };
    const p1 = new ArenaFighter(p1Rig, p1Stats, true, -2);

    // CPU opponent — random race/class
    const cpuRace = RACES[Math.floor(Math.random() * RACES.length)];
    const cpuClass = CLASSES[Math.floor(Math.random() * CLASSES.length)];
    const p2Rig = buildVoxel3DCharacter(cpuRace, cpuClass);
    scene.add(p2Rig.group);
    const p2Stats: FighterStats = { speed: 0.9, power: 1.1, reach: 1.0 };
    const p2 = new ArenaFighter(p2Rig, p2Stats, false, 2);

    // Camera shake
    let shakeIntensity = 0;

    // Input
    const keys: Record<string, boolean> = {};
    canvas.oncontextmenu = (e) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) keys['Mouse0'] = true;
      if (e.button === 2) keys['Mouse2'] = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) keys['Mouse0'] = false;
      if (e.button === 2) keys['Mouse2'] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);

    // Timer
    let timeLeft = 60;
    const timerInterval = setInterval(() => {
      if (gameState !== 'fighting') return;
      timeLeft--;
      setTimer(timeLeft);
      if (timeLeft <= 0) endGame();
    }, 1000);

    let ended = false;
    function endGame() {
      if (ended) return;
      ended = true;
      let msg = 'DRAW';
      if (p1.hp > p2.hp) msg = 'YOU WIN!';
      else if (p2.hp > p1.hp) msg = 'CPU WINS!';
      setWinner(msg);
      setGameState('gameover');
    }

    // Game loop
    const clock = new THREE.Clock();
    let animId = 0;
    let disposed = false;

    const loop = () => {
      if (disposed) return;
      animId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);

      if (!ended) {
        // Player input
        if (p1.action === 'idle' || p1.action === 'walk') {
          let moveInput = 0;
          if (keys['a'] || keys['arrowleft']) moveInput = -1;
          if (keys['d'] || keys['arrowright']) moveInput = 1;

          if (moveInput !== 0) {
            p1.setAction('walk');
            p1.velocity.x = moveInput * 6 * p1.stats.speed;
          } else {
            p1.setAction('idle');
            p1.velocity.x = 0;
          }

          if (keys['Mouse0']) { p1.setAction('punch'); p1.velocity.x = 0; }
          else if (keys['Mouse2']) { p1.setAction('kick'); p1.velocity.x = 0; }
          else if (keys['c']) { p1.setAction('grab'); p1.velocity.x = 0; }
          else if (keys['e']) { p1.setAction('headbutt'); p1.velocity.x = 0; }
          else if (keys['r']) { p1.setAction('dropkick'); p1.velocity.x = 0; }
          else if (keys[' ']) { p1.setAction('block'); p1.velocity.x = 0; }
        } else if (p1.action === 'block' && !keys[' ']) {
          p1.setAction('idle');
        }

        // CPU AI
        updateCPU(p2, p1, dt);

        // Update fighters
        p1.update(dt, p2);
        p2.update(dt, p1);

        // Resolve combat
        const r1 = resolveCombat(p1, p2);
        const r2 = resolveCombat(p2, p1);

        if (r1.hit && !r1.blocked) {
          particles.emit(p2.rig.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff0000, 10, 3);
          shakeIntensity = 0.3;
        }
        if (r1.hit && r1.blocked) {
          particles.emit(p2.rig.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0x00ffff, 6, 2);
        }
        if (r2.hit && !r2.blocked) {
          particles.emit(p1.rig.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff0000, 10, 3);
          shakeIntensity = 0.3;
        }

        if (r1.ko || r2.ko) endGame();

        setP1Hp(Math.max(0, p1.hp));
        setP2Hp(Math.max(0, p2.hp));
      }

      particles.update(dt);

      // Camera follow midpoint
      const midX = (p1.rig.group.position.x + p2.rig.group.position.x) / 2;
      const dist = Math.abs(p1.rig.group.position.x - p2.rig.group.position.x);
      camera.position.x += (midX - camera.position.x) * 0.1;
      camera.position.z += (4 + dist * 0.5 - camera.position.z) * 0.1;

      if (shakeIntensity > 0) {
        camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        camera.position.y = 1.5 + (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity -= dt * 2;
      }

      camera.lookAt(midX, 0.5, 0);
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
      clearInterval(timerInterval);
      particles.dispose();
      renderer.dispose();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      {/* HUD — HP bars + timer */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, pointerEvents: 'none', fontFamily: "'Oxanium',monospace", zIndex: 10 }}>
        {/* P1 HP */}
        <div style={{ width: '35%' }}>
          <div style={{ color: '#00eaff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>PLAYER</div>
          <div style={{ height: 24, border: '2px solid #fff', background: '#333', borderRadius: 2, overflow: 'hidden', transform: 'skewX(-15deg)' }}>
            <div style={{ width: `${p1Hp}%`, height: '100%', background: 'linear-gradient(90deg,#ffcc00,#ff0000)', transition: 'width 0.2s' }} />
          </div>
        </div>
        {/* Timer */}
        <div style={{ color: '#fff', fontSize: 36, fontWeight: 'bold', textShadow: '2px 2px #000' }}>{timer}</div>
        {/* P2 HP */}
        <div style={{ width: '35%', textAlign: 'right' }}>
          <div style={{ color: '#ff4444', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>CPU</div>
          <div style={{ height: 24, border: '2px solid #fff', background: '#333', borderRadius: 2, overflow: 'hidden', transform: 'skewX(-15deg)' }}>
            <div style={{ width: `${p2Hp}%`, height: '100%', background: 'linear-gradient(90deg,#ff0000,#ffcc00)', float: 'right', transition: 'width 0.2s' }} />
          </div>
        </div>
      </div>

      {/* Controls hint */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: "'Oxanium',monospace", textAlign: 'right', pointerEvents: 'none' }}>
        A/D Move · LMB Punch · RMB Kick · C Grab · E Headbutt · R Dropkick · SPACE Block
      </div>

      {/* Game Over */}
      {winner && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', zIndex: 20 }}>
          <div style={{ textAlign: 'center', fontFamily: "'Oxanium',monospace" }}>
            <div style={{ fontSize: 48, color: '#ff0055', fontWeight: 'bold', textShadow: '4px 4px #fff', transform: 'skewX(-10deg)' }}>{winner}</div>
            <button onClick={() => window.location.reload()} style={{ marginTop: 20, background: 'transparent', border: '2px solid #fff', color: '#fff', padding: '12px 32px', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>REMATCH</button>
          </div>
        </div>
      )}
    </div>
  );
}
