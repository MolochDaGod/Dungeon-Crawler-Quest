/**
 * Lightweight combat VFX for DCQ 3D modes (sandbox / arena / dungeon).
 * Pool-based particles + slash arcs — no heavy GLBs, bloom-friendly additives.
 */

import * as THREE from "three";

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  ttl: number;
  active: boolean;
}

interface SlashArc {
  mesh: THREE.Mesh;
  life: number;
  ttl: number;
  active: boolean;
}

const POOL = 64;
const SLASH_POOL = 12;

export class ModeVfx {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private slashes: SlashArc[] = [];
  private geo: THREE.SphereGeometry;
  private slashGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geo = new THREE.SphereGeometry(0.06, 6, 6);
    this.slashGeo = new THREE.RingGeometry(0.35, 0.85, 16, 1, 0, Math.PI * 1.1);

    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6622,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        ttl: 0,
        active: false,
      });
    }

    for (let i = 0; i < SLASH_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe08a,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.slashGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.slashes.push({ mesh, life: 0, ttl: 0, active: false });
    }
  }

  /** Burst of sparks at a world point. */
  emit(
    pos: THREE.Vector3,
    color = 0xff4422,
    count = 10,
    speed = 3,
  ): void {
    let made = 0;
    for (const p of this.particles) {
      if (p.active || made >= count) continue;
      p.active = true;
      p.life = 0;
      p.ttl = 0.25 + Math.random() * 0.4;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
      p.vel.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed,
        (Math.random() - 0.5) * speed,
      );
      made++;
    }
  }

  /** Melee slash arc in front of character facing. */
  slash(
    origin: THREE.Vector3,
    facingY: number,
    color = 0xffe08a,
    heavy = false,
  ): void {
    for (const s of this.slashes) {
      if (s.active) continue;
      s.active = true;
      s.life = 0;
      s.ttl = heavy ? 0.28 : 0.18;
      s.mesh.visible = true;
      s.mesh.position.set(origin.x, origin.y + 1.0, origin.z);
      s.mesh.rotation.set(Math.PI / 2, facingY, 0);
      s.mesh.scale.setScalar(heavy ? 1.6 : 1.1);
      (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
      return;
    }
  }

  /** Cast ring under feet / staff. */
  castRing(pos: THREE.Vector3, color = 0x88aaff): void {
    this.emit(pos.clone().setY(pos.y + 0.2), color, 14, 2.2);
    this.slash(pos, 0, color, false);
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.ttl) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const f = 1 - p.life / p.ttl;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = f;
      p.mesh.scale.setScalar(0.4 + f * 0.6);
    }
    for (const s of this.slashes) {
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.ttl) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      const t = s.life / s.ttl;
      s.mesh.scale.multiplyScalar(1 + dt * 1.8);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    for (const s of this.slashes) {
      this.scene.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.geo.dispose();
    this.slashGeo.dispose();
  }
}
