import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLocation } from "wouter";
import { SandboxWorld, SandboxTool, PROP_CATALOG } from "@/game/sandbox-physics";
import { VoxelController } from "@/game/voxel-controller";
import {
  loadExplorerAvatar,
  driveExplorerLocomotion,
  syncHeroFromStorage,
  type ExplorerAvatar,
} from "@/game/explorer-avatar";
import { ModeVfx } from "@/game/mode-vfx";
import {
  createModeSkills,
  tickModeSkills,
  tryCastSkill,
  type ModeSkillState,
} from "@/game/mode-skills";
import { startSession } from "@/lib/grudge-uuid";
import {
  ALL_NEUTRAL_CREEPS,
  loadCreepMesh,
  rollCreepLoot,
  pushFarmLoot,
  formatLootLine,
  type LoadedCreepMesh,
  type NeutralCreepDef,
} from "@/game/neutral-creeps";
import { setActiveMode } from "@/game/game-flow";

interface SandboxCreep {
  loaded: LoadedCreepMesh;
  def: NeutralCreepDef;
  hp: number;
  alive: boolean;
}

export default function SandboxPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const [tool, setTool] = useState(SandboxTool.Hand);
  const [objCount, setObjCount] = useState(0);
  const [showSpawnMenu, setShowSpawnMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading explorer…");
  const [skillLabels, setSkillLabels] = useState<string[]>([]);
  const [cds, setCds] = useState<number[]>([]);
  const [mp, setMp] = useState(100);
  const [creepCount, setCreepCount] = useState(0);
  const [farmGold, setFarmGold] = useState(0);
  const [lootLine, setLootLine] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    startSession();
    setActiveMode("sandbox");

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;outline:none;";
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88ccff);
    scene.fog = new THREE.FogExp2(0x88ccff, 0.003);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    camera.position.set(0, 5, 10);

    scene.add(new THREE.AmbientLight(0x404040, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(50, 80, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3a6a2a,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const sandbox = new SandboxWorld(scene);
    for (let i = 0; i < 8; i++) {
      sandbox.createBox(
        1,
        1,
        1,
        (Math.random() - 0.5) * 30,
        0.5,
        (Math.random() - 0.5) * 30,
        10,
        0x885533,
      );
    }
    for (let i = 0; i < 4; i++) {
      sandbox.createSphere(
        0.5,
        (Math.random() - 0.5) * 20,
        2,
        (Math.random() - 0.5) * 20,
        5,
        0xff4444,
        true,
      );
    }

    const vfx = new ModeVfx(scene);
    const hero = syncHeroFromStorage();
    let avatar: ExplorerAvatar | null = null;
    let skills: ModeSkillState = createModeSkills(hero.race, hero.heroClass);
    setSkillLabels(skills.abilities.map((a) => `${a.key} ${a.name}`));

    let controller: VoxelController | null = null;
    let disposed = false;
    let animId = 0;
    let time = 0;
    const clock = new THREE.Clock();
    /** WC3 neutrals for farm testing */
    const creeps: SandboxCreep[] = [];

    const spawnCreepCamp = async (near: THREE.Vector3) => {
      const def =
        ALL_NEUTRAL_CREEPS[
          Math.floor(Math.random() * ALL_NEUTRAL_CREEPS.length)
        ]!;
      try {
        setStatus(`Spawning ${def.label}…`);
        const loaded = await loadCreepMesh(def);
        if (disposed) {
          loaded.dispose();
          return;
        }
        const ox = near.x + (Math.random() - 0.5) * 6;
        const oz = near.z + (Math.random() - 0.5) * 6;
        loaded.group.position.set(ox, 0, oz);
        scene.add(loaded.group);
        creeps.push({
          loaded,
          def,
          hp: def.hp,
          alive: true,
        });
        setCreepCount(creeps.filter((c) => c.alive).length);
        setStatus(`Creep camp: ${def.label} (${creeps.filter((c) => c.alive).length} live)`);
        vfx.castRing(loaded.group.position, def.color);
      } catch (e) {
        console.warn("[sandbox] creep spawn failed", e);
        setStatus("Creep load failed (CDN/network)");
      }
    };

    const hitCreeps = (origin: THREE.Vector3, range: number, dmg: number) => {
      for (const c of creeps) {
        if (!c.alive) continue;
        if (c.loaded.group.position.distanceTo(origin) > range) continue;
        c.hp -= dmg;
        vfx.emit(
          c.loaded.group.position.clone().add(new THREE.Vector3(0, 1, 0)),
          0xff4422,
          8,
          3,
        );
        if (c.hp <= 0) {
          c.alive = false;
          scene.remove(c.loaded.group);
          c.loaded.dispose();
          const drops = rollCreepLoot(c.def);
          pushFarmLoot(drops);
          const gold = drops.find((d) => d.kind === "gold");
          if (gold) setFarmGold((g) => g + gold.qty);
          const line = formatLootLine(drops);
          setLootLine(line);
          setStatus(`Farm: ${c.def.label} · ${line}`);
          setCreepCount(creeps.filter((x) => x.alive).length);
          vfx.castRing(c.loaded.group.position, 0xfbbf24);
        }
      }
    };

    const boot = async () => {
      setStatus("Loading TVS explorer avatar…");
      avatar = await loadExplorerAvatar({
        race: hero.race,
        heroClass: hero.heroClass,
      });
      if (disposed) {
        avatar.dispose();
        return;
      }
      avatar.group.position.set(0, 0, 0);
      scene.add(avatar.group);
      setStatus(
        `Explorer ready (${avatar.source}) · N = spawn creep camp`,
      );
      setLoading(false);

      // Seed one farm camp for game flow
      void spawnCreepCamp(new THREE.Vector3(4, 0, -6));

      controller = new VoxelController(
        camera,
        avatar.group,
        canvas,
        ground,
        {
          onToolChange: (t) => setTool(t),
          onAttack: (type) => {
            const origin = avatar!.group.position.clone();
            vfx.slash(
              origin,
              avatar!.group.rotation.y,
              type === "lmb" ? 0xffe08a : 0xff6622,
              type === "rmb",
            );
            // Farm creeps first (game flow), then sandbox props
            hitCreeps(origin, type === "lmb" ? 2.4 : 3.0, type === "lmb" ? 18 : 28);
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const pos = camera.position.clone().add(dir.multiplyScalar(5));
            pos.y = Math.max(1, pos.y);
            if (type === "lmb") {
              sandbox.createBox(
                1,
                1,
                1,
                pos.x,
                pos.y,
                pos.z,
                5,
                Math.random() * 0xffffff,
              );
            }
            if (type === "rmb") {
              sandbox.createSphere(
                0.5,
                pos.x,
                pos.y,
                pos.z,
                5,
                Math.random() * 0xffffff,
                true,
              );
              vfx.emit(pos, 0xff6622, 12, 4);
            }
            avatar?.play("attack");
          },
          onAbility: (slot) => {
            const r = tryCastSkill(skills, slot);
            if (!r.ok || !r.ability) return;
            const origin = avatar!.group.position.clone();
            if (r.ability.type === "aoe" || r.ability.castType === "self_cast") {
              vfx.castRing(origin, 0x88aaff);
            } else {
              vfx.slash(origin, avatar!.group.rotation.y, 0x66ccff, true);
              vfx.emit(
                origin.clone().add(new THREE.Vector3(0, 1, 0)),
                0x66ccff,
                16,
                3,
              );
            }
            avatar?.play(
              r.ability.castType === "self_cast" || r.ability.type === "buff"
                ? "cast"
                : "attack",
            );
          },
        },
      );
    };
    void boot();

    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "`" || e.key.toLowerCase() === "m") && e.type === "keydown") {
        setShowSpawnMenu((v) => !v);
      }
      if (e.type === "keydown" && e.key.toLowerCase() === "n" && avatar) {
        void spawnCreepCamp(avatar.group.position.clone());
      }
      if (e.type === "keydown" && e.key === "Escape") setLocation("/");
    };
    window.addEventListener("keydown", onKey);

    const onSpawn = (e: Event) => {
      const type = (e as CustomEvent).detail as string;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const pos = camera.position.clone().add(dir.multiplyScalar(5));
      pos.y = Math.max(0.5, pos.y);
      sandbox.spawnProp(type, pos);
      vfx.emit(pos, 0xaaff88, 8, 2);
    };
    window.addEventListener("sandbox-spawn", onSpawn);

    const loop = () => {
      if (disposed) return;
      animId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      time += dt;

      sandbox.step(dt);
      controller?.update(dt);
      vfx.update(dt);
      tickModeSkills(skills, dt);
      setCds([...skills.cds]);
      setMp(Math.round(skills.mp));

      if (avatar && controller) {
        const moving = controller.isMoving();
        const attacking =
          controller.state.lmbDown || controller.state.rmbDown;
        const sprint = controller.state.keys.has("shift");
        driveExplorerLocomotion(avatar, moving, attacking, time, sprint);
        avatar.update(dt);
      }
      for (const c of creeps) {
        if (c.alive) c.loaded.update(dt);
      }

      renderer.render(scene, camera);
      setObjCount(sandbox.objects.length);
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
      controller?.dispose();
      sandbox.dispose();
      vfx.dispose();
      avatar?.dispose();
      creeps.forEach((c) => c.loaded.dispose());
      renderer.dispose();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sandbox-spawn", onSpawn);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
  }, [setLocation]);

  const spawnProp = (type: string) => {
    window.dispatchEvent(new CustomEvent("sandbox-spawn", { detail: type }));
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#111",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            color: "#00ffcc",
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
          left: 12,
          color: "#fff",
          fontFamily: "'Oxanium',monospace",
          fontSize: 12,
          background: "rgba(0,0,0,0.65)",
          padding: "8px 12px",
          borderRadius: 8,
          pointerEvents: "none",
          maxWidth: 360,
        }}
      >
        <div
          style={{
            color: "#00ffcc",
            fontWeight: "bold",
            fontSize: 16,
            marginBottom: 4,
          }}
        >
          VOXEL SANDBOX
        </div>
        <div style={{ color: "#aaa", fontSize: 11 }}>{status}</div>
        <div>Objects: {objCount} · Creeps: {creepCount}</div>
        <div>
          Tool: {SandboxTool[tool]} · MP {mp} ·{" "}
          <span style={{ color: "#fbbf24" }}>Gold {farmGold}</span>
        </div>
        {lootLine && (
          <div style={{ color: "#c5a059", fontSize: 10 }}>Loot: {lootLine}</div>
        )}
        <div style={{ color: "#888", marginTop: 4 }}>
          WASD · LMB hit creeps / box · N creep camp · M props · 1-4 skills · Esc
        </div>
      </div>

      {/* Skill bar */}
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
              minWidth: 72,
              padding: "6px 8px",
              background: "rgba(10,15,20,0.85)",
              border: "1px solid #00ffcc55",
              borderRadius: 6,
              color: cds[i] > 0 ? "#666" : "#e8e8e8",
              fontFamily: "'Oxanium',monospace",
              fontSize: 10,
              textAlign: "center",
            }}
          >
            <div style={{ color: "#00ffcc" }}>{i + 1}</div>
            <div>{label}</div>
            {cds[i] > 0 && (
              <div style={{ color: "#f59e0b" }}>{cds[i].toFixed(1)}s</div>
            )}
          </div>
        ))}
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
          border: "1px solid #c5a05955",
          color: "#c5a059",
          padding: "6px 12px",
          borderRadius: 6,
          fontFamily: "'Oxanium',monospace",
          cursor: "pointer",
        }}
      >
        ← Home
      </button>

      {showSpawnMenu && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "rgba(10,15,20,0.95)",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 20,
            color: "#fff",
            fontFamily: "'Oxanium',monospace",
            zIndex: 100,
            minWidth: 400,
          }}
        >
          <div
            style={{
              color: "#00ffcc",
              fontWeight: "bold",
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            SPAWN MENU
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 8,
            }}
          >
            {Object.entries(PROP_CATALOG).map(([key, def]) => (
              <div
                key={key}
                onClick={() => spawnProp(key)}
                style={{
                  background: "#333",
                  borderRadius: 4,
                  padding: 8,
                  textAlign: "center",
                  cursor: "pointer",
                  border: "1px solid #555",
                  fontSize: 11,
                }}
              >
                {def.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 4,
          height: 4,
          background: "#00ffcc",
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: "0 0 8px #00ffcc",
        }}
      />
    </div>
  );
}
