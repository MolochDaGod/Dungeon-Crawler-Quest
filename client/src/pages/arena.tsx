import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLocation } from "wouter";
import {
  ArenaFighter,
  resolveCombat,
  updateCPU,
  type FighterStats,
} from "@/game/arena-fighter";
import {
  loadExplorerAvatar,
  syncHeroFromStorage,
  type ExplorerAvatar,
} from "@/game/explorer-avatar";
import {
  loadCreepMesh,
  pickCreep,
  type LoadedCreepMesh,
} from "@/game/neutral-creeps";
import { ModeVfx } from "@/game/mode-vfx";
import {
  createModeSkills,
  tickModeSkills,
  tryCastSkill,
  skillIndexFromKey,
} from "@/game/mode-skills";
import type { FighterRig } from "@/game/arena-fighter";

const RACES = ["Human", "Barbarian", "Dwarf", "Elf", "Orc", "Undead"];
const CLASSES = ["Warrior", "Mage", "Ranger", "Worg"];

export default function ArenaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const [p1Hp, setP1Hp] = useState(100);
  const [p2Hp, setP2Hp] = useState(100);
  const [timer, setTimer] = useState(60);
  const [winner, setWinner] = useState<string | null>(null);
  const [gameState, setGameState] = useState<"loading" | "fighting" | "gameover">(
    "loading",
  );
  const [status, setStatus] = useState("Loading explorers…");
  const [skillLabels, setSkillLabels] = useState<string[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;";
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x220033);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 1.5, 6);

    scene.add(new THREE.AmbientLight(0x404040, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a0033,
      roughness: 0.8,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(30, 30, 0x00ffcc, 0x333355));

    const vfx = new ModeVfx(scene);
    let p1: ArenaFighter | null = null;
    let p2: ArenaFighter | null = null;
    let avatars: ExplorerAvatar[] = [];
    let creepP2: LoadedCreepMesh | null = null;
    let skills = createModeSkills("Human", "Warrior");
    let shakeIntensity = 0;
    let ended = false;
    let timeLeft = 60;
    let disposed = false;
    let animId = 0;
    const clock = new THREE.Clock();
    const keys: Record<string, boolean> = {};

    const endGame = () => {
      if (ended || !p1 || !p2) return;
      ended = true;
      let msg = "DRAW";
      if (p1.hp > p2.hp) msg = "YOU WIN!";
      else if (p2.hp > p1.hp) msg = "CPU WINS!";
      setWinner(msg);
      setGameState("gameover");
    };

    const boot = async () => {
      const hero = syncHeroFromStorage();
      skills = createModeSkills(hero.race, hero.heroClass);
      setSkillLabels(skills.abilities.map((a) => `${a.key} ${a.name}`));

      setStatus("Loading player explorer…");
      const p1Avatar = await loadExplorerAvatar({
        race: hero.race,
        heroClass: hero.heroClass,
      });
      if (disposed) {
        p1Avatar.dispose();
        return;
      }
      scene.add(p1Avatar.group);
      avatars.push(p1Avatar);

      // ~60% chance: WC3 neutral creep from R2 as rival (else explorer CPU)
      const useCreep = Math.random() < 0.6;
      const p1Stats: FighterStats = { speed: 1.0, power: 1.0, reach: 1.0 };
      p1 = new ArenaFighter(p1Avatar, p1Stats, true, -2);

      if (useCreep) {
        const def = pickCreep();
        setStatus(`Loading neutral creep (${def.label})…`);
        try {
          creepP2 = await loadCreepMesh(def);
          if (disposed) {
            creepP2.dispose();
            return;
          }
          scene.add(creepP2.group);
          const creepRig: FighterRig = {
            group: creepP2.group,
            setPose: () => {},
            update: (dt) => creepP2?.update(dt),
            play: () => {},
          };
          const p2Stats: FighterStats = {
            speed: Math.min(1.4, def.speed / 2.2),
            power: Math.min(1.5, def.damage / 10),
            reach: 1.0,
          };
          p2 = new ArenaFighter(creepRig, p2Stats, false, 2);
          p2.maxHp = def.hp;
          p2.hp = def.hp;
          setStatus(
            `Arena ready · You: ${hero.race} ${hero.heroClass} vs ${def.label} (R2 creep)`,
          );
        } catch (e) {
          console.warn("[arena] creep load failed, explorer fallback", e);
        }
      }

      if (!p2) {
        const cpuRace = RACES[Math.floor(Math.random() * RACES.length)]!;
        const cpuClass = CLASSES[Math.floor(Math.random() * CLASSES.length)]!;
        setStatus(`Loading rival explorer (${cpuRace} ${cpuClass})…`);
        const p2Avatar = await loadExplorerAvatar({
          race: cpuRace,
          heroClass: cpuClass,
          teamTint: 0xff2244,
        });
        if (disposed) {
          p2Avatar.dispose();
          return;
        }
        scene.add(p2Avatar.group);
        avatars.push(p2Avatar);
        const p2Stats: FighterStats = { speed: 0.9, power: 1.1, reach: 1.0 };
        p2 = new ArenaFighter(p2Avatar, p2Stats, false, 2);
        setStatus(
          `Arena ready · You: ${hero.race} ${hero.heroClass} (${p1Avatar.source}) vs ${cpuRace} ${cpuClass}`,
        );
      }
      setGameState("fighting");
    };
    void boot();

    canvas.oncontextmenu = (e) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === "Escape") setLocation("/");
      if (gameState === "fighting" || !ended) {
        const idx = skillIndexFromKey(e.key);
        if (idx >= 0 && p1 && p2) {
          const r = tryCastSkill(skills, idx);
          if (r.ok && r.ability) {
            p1.setAction(
              r.ability.type === "dash"
                ? "dropkick"
                : r.ability.slot === "defensive"
                  ? "block"
                  : "punch",
            );
            vfx.slash(
              p1.rig.group.position,
              p1.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
              0x88aaff,
              true,
            );
            vfx.emit(
              p1.rig.group.position.clone().add(new THREE.Vector3(0, 1, 0)),
              0x66aaff,
              14,
              3,
            );
            // Skill damage pulse if close
            const dist = p1.rig.group.position.distanceTo(p2.rig.group.position);
            if (dist < 3.5 && r.ability.damage > 0) {
              p2.takeDamage(r.ability.damage * 0.35);
              vfx.emit(
                p2.rig.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
                0xff4400,
                12,
                3,
              );
              shakeIntensity = 0.25;
            }
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) keys["Mouse0"] = true;
      if (e.button === 2) keys["Mouse2"] = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) keys["Mouse0"] = false;
      if (e.button === 2) keys["Mouse2"] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);

    const timerInterval = setInterval(() => {
      if (ended || !p1) return;
      timeLeft--;
      setTimer(timeLeft);
      if (timeLeft <= 0) endGame();
    }, 1000);

    const loop = () => {
      if (disposed) return;
      animId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      tickModeSkills(skills, dt);

      if (!ended && p1 && p2) {
        if (p1.action === "idle" || p1.action === "walk") {
          let moveInput = 0;
          if (keys["a"] || keys["arrowleft"]) moveInput = -1;
          if (keys["d"] || keys["arrowright"]) moveInput = 1;

          if (moveInput !== 0) {
            p1.setAction("walk");
            p1.velocity.x = moveInput * 6 * p1.stats.speed;
          } else {
            p1.setAction("idle");
            p1.velocity.x = 0;
          }

          if (keys["Mouse0"]) {
            p1.setAction("punch");
            p1.velocity.x = 0;
            vfx.slash(
              p1.rig.group.position,
              p1.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
              0xffe08a,
            );
          } else if (keys["Mouse2"]) {
            p1.setAction("kick");
            p1.velocity.x = 0;
            vfx.slash(
              p1.rig.group.position,
              p1.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
              0xff8866,
              true,
            );
          } else if (keys["c"]) {
            p1.setAction("grab");
            p1.velocity.x = 0;
          } else if (keys[" "]) {
            p1.setAction("block");
            p1.velocity.x = 0;
          }
        } else if (p1.action === "block" && !keys[" "]) {
          p1.setAction("idle");
        }

        updateCPU(p2, p1, dt);
        p1.update(dt, p2);
        p2.update(dt, p1);

        const r1 = resolveCombat(p1, p2);
        const r2 = resolveCombat(p2, p1);

        if (r1.hit && !r1.blocked) {
          vfx.emit(
            p2.rig.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
            0xff2200,
            12,
            3.5,
          );
          shakeIntensity = 0.3;
        }
        if (r1.hit && r1.blocked) {
          vfx.emit(
            p2.rig.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
            0x00ffff,
            6,
            2,
          );
        }
        if (r2.hit && !r2.blocked) {
          vfx.emit(
            p1.rig.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
            0xff2200,
            12,
            3.5,
          );
          shakeIntensity = 0.3;
        }

        if (r1.ko || r2.ko) endGame();
        setP1Hp(Math.max(0, p1.hp));
        setP2Hp(Math.max(0, p2.hp));
      }

      vfx.update(dt);

      if (p1 && p2) {
        const midX =
          (p1.rig.group.position.x + p2.rig.group.position.x) / 2;
        const dist = Math.abs(
          p1.rig.group.position.x - p2.rig.group.position.x,
        );
        camera.position.x += (midX - camera.position.x) * 0.1;
        camera.position.z += (4 + dist * 0.5 - camera.position.z) * 0.1;

        if (shakeIntensity > 0) {
          camera.position.x += (Math.random() - 0.5) * shakeIntensity;
          camera.position.y = 1.5 + (Math.random() - 0.5) * shakeIntensity;
          shakeIntensity -= dt * 2;
        }
        camera.lookAt(midX, 0.8, 0);
      }

      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      clearInterval(timerInterval);
      vfx.dispose();
      avatars.forEach((a) => a.dispose());
      creepP2?.dispose();
      renderer.dispose();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
  }, [setLocation]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#110022",
      }}
    >
      {gameState === "loading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            color: "#ff0055",
            fontFamily: "'Oxanium',monospace",
            zIndex: 20,
          }}
        >
          {status}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 24,
          alignItems: "center",
          background: "rgba(0,0,0,0.7)",
          padding: "8px 20px",
          borderRadius: 8,
          border: "1px solid #ff005555",
          fontFamily: "'Oxanium',monospace",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ color: "#4ade80", minWidth: 80 }}>YOU {Math.round(p1Hp)}</div>
        <div style={{ color: "#ff0055", fontWeight: "bold", fontSize: 20 }}>
          {timer}
        </div>
        <div style={{ color: "#f87171", minWidth: 80, textAlign: "right" }}>
          CPU {Math.round(p2Hp)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 52,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#888",
          fontSize: 11,
          fontFamily: "'Oxanium',monospace",
          pointerEvents: "none",
        }}
      >
        {status}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          zIndex: 10,
        }}
      >
        {skillLabels.map((label, i) => (
          <div
            key={label}
            style={{
              minWidth: 70,
              padding: "6px 8px",
              background: "rgba(20,0,10,0.85)",
              border: "1px solid #ff005555",
              borderRadius: 6,
              color: "#eee",
              fontFamily: "'Oxanium',monospace",
              fontSize: 10,
              textAlign: "center",
            }}
          >
            <div style={{ color: "#ff0055" }}>{i + 1}</div>
            {label}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          color: "rgba(255,255,255,0.4)",
          fontSize: 10,
          fontFamily: "'Oxanium',monospace",
          pointerEvents: "none",
        }}
      >
        A/D move · LMB punch · RMB kick · Space block · 1-4 skills · Esc home
      </div>

      <button
        type="button"
        onClick={() => setLocation("/")}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          background: "rgba(0,0,0,0.7)",
          border: "1px solid #ff005555",
          color: "#ff0055",
          padding: "6px 12px",
          borderRadius: 6,
          fontFamily: "'Oxanium',monospace",
          cursor: "pointer",
        }}
      >
        ← Home
      </button>

      {gameState === "gameover" && winner && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            zIndex: 30,
            fontFamily: "'Oxanium',monospace",
          }}
        >
          <div style={{ color: "#ff0055", fontSize: 36, fontWeight: "bold" }}>
            {winner}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "10px 24px",
              background: "#ff0055",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              fontFamily: "'Oxanium',monospace",
            }}
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={() => setLocation("/")}
            style={{
              marginTop: 10,
              padding: "8px 20px",
              background: "transparent",
              border: "1px solid #c5a059",
              borderRadius: 8,
              color: "#c5a059",
              cursor: "pointer",
              fontFamily: "'Oxanium',monospace",
            }}
          >
            Home
          </button>
        </div>
      )}
    </div>
  );
}
