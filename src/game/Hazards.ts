import * as THREE from "three";
import { COLORS, PLAYER_RADIUS } from "./config";

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  hit: boolean;
  nearMissed: boolean;
  trail: { mesh: THREE.Mesh; life: number }[];
}

const BALL_RADIUS = 0.32;
const HIT_DIST = PLAYER_RADIUS + BALL_RADIUS + 0.15;
const NEAR_DIST = 1.4;

export class HazardManager {
  group = new THREE.Group();
  private cannons: THREE.Mesh[] = [];
  private cannonAngle = 0;
  private projectiles: Projectile[] = [];
  private fireTimer = 2;
  private scene: THREE.Scene;

  // difficulty-scaled
  private fireInterval = 2.2;
  private ballSpeed = 11;

  onFire: () => void = () => {};
  onHit: () => void = () => {};
  onNearMiss: () => void = () => {};
  onDodge: () => void = () => {};

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this.group);
    const geo = new THREE.ConeGeometry(0.6, 1.6, 8);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0x0a0e1c,
          emissive: COLORS.pink,
          emissiveIntensity: 0.6,
          metalness: 0.4,
          roughness: 0.5,
        })
      );
      this.cannons.push(m);
      this.group.add(m);
    }
  }

  private positionCannons(dt: number) {
    this.cannonAngle += dt * 0.25;
    const r = 9.5;
    const y = 6.5;
    this.cannons.forEach((c, i) => {
      const a = this.cannonAngle + (i * Math.PI) / 2;
      c.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    });
  }

  private fire(playerPos: THREE.Vector3) {
    // Pick the cannon that currently has the clearest shot (nearest).
    let best = this.cannons[0];
    let bestD = Infinity;
    for (const c of this.cannons) {
      const d = c.position.distanceToSquared(playerPos);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x0a0e1c,
        emissive: COLORS.orange,
        emissiveIntensity: 1.1,
      })
    );
    ball.position.copy(best.position);
    const dir = playerPos.clone().sub(best.position).normalize();
    this.scene.add(ball);
    this.projectiles.push({
      mesh: ball,
      vel: dir.multiplyScalar(this.ballSpeed),
      life: 4,
      hit: false,
      nearMissed: false,
      trail: [],
    });
    this.onFire();

    // Point the cannon at the shot.
    best.lookAt(playerPos);
    best.rotateX(Math.PI / 2);
  }

  update(dt: number, playerPos: THREE.Vector3, active: boolean): THREE.Vector3 | null {
    this.positionCannons(dt);
    let knockbackDir: THREE.Vector3 | null = null;

    if (active) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fire(playerPos);
        this.fireTimer = this.fireInterval * (0.7 + Math.random() * 0.6);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      // trail
      if (Math.random() < 0.6) {
        const t = new THREE.Mesh(
          p.mesh.geometry,
          new THREE.MeshBasicMaterial({ color: COLORS.yellow, transparent: true, opacity: 0.5 })
        );
        t.position.copy(p.mesh.position);
        t.scale.setScalar(0.7);
        this.scene.add(t);
        p.trail.push({ mesh: t, life: 0.25 });
      }
      for (let j = p.trail.length - 1; j >= 0; j--) {
        const tr = p.trail[j];
        tr.life -= dt;
        (tr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, tr.life / 0.25) * 0.5;
        if (tr.life <= 0) {
          this.scene.remove(tr.mesh);
          p.trail.splice(j, 1);
        }
      }

      const dist = p.mesh.position.distanceTo(playerPos);
      if (active && !p.hit) {
        if (dist < HIT_DIST) {
          p.hit = true;
          knockbackDir = p.vel.clone().setY(0).normalize();
          this.onHit();
          this.removeProjectile(i);
          continue;
        } else if (dist < NEAR_DIST && !p.nearMissed) {
          p.nearMissed = true;
          this.onNearMiss();
        }
      }

      // Expired or far away -> counts as dodged.
      if (p.life <= 0 || p.mesh.position.length() > 40) {
        if (!p.hit && active) this.onDodge();
        this.removeProjectile(i);
      }
    }

    return knockbackDir;
  }

  private removeProjectile(i: number) {
    const p = this.projectiles[i];
    this.scene.remove(p.mesh);
    for (const t of p.trail) this.scene.remove(t.mesh);
    this.projectiles.splice(i, 1);
  }

  setDifficulty(level: number) {
    const t = Math.min(level, 1);
    this.fireInterval = 2.2 - 1.5 * t;
    this.ballSpeed = 11 + 9 * t;
  }

  clearProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) this.removeProjectile(i);
  }

  reset() {
    this.clearProjectiles();
    this.fireTimer = 2;
    this.fireInterval = 2.2;
    this.ballSpeed = 11;
  }
}
