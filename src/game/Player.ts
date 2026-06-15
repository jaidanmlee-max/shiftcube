import * as THREE from "three";
import {
  ACCEL,
  AIR_ACCEL,
  COLORS,
  COYOTE_TIME,
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  FRICTION,
  GRAVITY,
  GROUND_Y,
  HALF,
  JUMP_BUFFER,
  JUMP_VELOCITY,
  MOVE_SPEED,
  PLAYER_RADIUS,
} from "./config";

interface Ghost {
  mesh: THREE.Mesh;
  life: number;
}

export class Player {
  group = new THREE.Group();
  mesh: THREE.Mesh;
  position = new THREE.Vector3(0, GROUND_Y, 0);
  velocity = new THREE.Vector3();
  onGround = false;
  beingCarried = false;

  private coyote = 0;
  private jumpBuf = 0;
  private dashTimer = 0;
  private dashCd = 0;
  private dashDir = new THREE.Vector3(0, 0, -1);
  private lastDir = new THREE.Vector3(0, 0, -1);

  private ghosts: Ghost[] = [];
  private ghostTimer = 0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geo = new THREE.IcosahedronGeometry(PLAYER_RADIUS, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0e1c,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.9,
      metalness: 0.2,
      roughness: 0.3,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(PLAYER_RADIUS * 1.5, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: COLORS.pink })
    );
    ring.rotation.x = Math.PI / 2;
    this.mesh.add(ring);
    this.group.add(this.mesh);
    scene.add(this.group);
  }

  get dashCooldownFraction(): number {
    return 1 - Math.max(0, this.dashCd) / DASH_COOLDOWN;
  }
  get dashReady(): boolean {
    return this.dashCd <= 0;
  }
  get isDashing(): boolean {
    return this.dashTimer > 0;
  }

  reset() {
    this.position.set(0, GROUND_Y, 0);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
    this.beingCarried = false;
    this.dashTimer = 0;
    this.dashCd = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    for (const g of this.ghosts) this.scene.remove(g.mesh);
    this.ghosts = [];
    this.syncMesh();
  }

  applyKnockback(dir: THREE.Vector3, force: number) {
    this.velocity.x += dir.x * force;
    this.velocity.z += dir.z * force;
    this.velocity.y += force * 0.35;
    this.onGround = false;
    this.coyote = 0;
  }

  /** Rotate the player around a world axis through the origin (carried by a cube slice). */
  carry(axis: THREE.Vector3, angle: number) {
    this.position.applyAxisAngle(axis, angle);
  }

  update(
    dt: number,
    moveDir: THREE.Vector3,
    wantJump: boolean,
    wantDash: boolean
  ): { jumped: boolean; dashed: boolean } {
    const out = { jumped: false, dashed: false };

    if (wantJump) this.jumpBuf = JUMP_BUFFER;
    this.jumpBuf -= dt;
    this.dashCd -= dt;

    if (moveDir.lengthSq() > 0.001) this.lastDir.copy(moveDir).normalize();

    // --- Dash ---
    if (wantDash && this.dashReady && this.dashTimer <= 0) {
      this.dashTimer = DASH_TIME;
      this.dashCd = DASH_COOLDOWN;
      this.dashDir.copy(moveDir.lengthSq() > 0.001 ? moveDir : this.lastDir).normalize();
      out.dashed = true;
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.velocity.x = this.dashDir.x * DASH_SPEED;
      this.velocity.z = this.dashDir.z * DASH_SPEED;
      this.velocity.y = Math.max(this.velocity.y, 0); // float through the dash
      this.spawnGhosts(dt);
    } else {
      // --- Horizontal movement ---
      const accel = this.onGround ? ACCEL : AIR_ACCEL;
      const targetX = moveDir.x * MOVE_SPEED;
      const targetZ = moveDir.z * MOVE_SPEED;
      if (moveDir.lengthSq() > 0.001) {
        this.velocity.x = approach(this.velocity.x, targetX, accel * dt);
        this.velocity.z = approach(this.velocity.z, targetZ, accel * dt);
      } else if (this.onGround) {
        this.velocity.x = approach(this.velocity.x, 0, FRICTION * dt);
        this.velocity.z = approach(this.velocity.z, 0, FRICTION * dt);
      }
      // --- Gravity ---
      this.velocity.y -= GRAVITY * dt;
    }

    if (this.velocity.y < -32) this.velocity.y = -32;

    // --- Jump ---
    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0) && !this.beingCarried) {
      this.velocity.y = JUMP_VELOCITY;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      out.jumped = true;
    }

    // --- Integrate ---
    this.position.addScaledVector(this.velocity, dt);

    // --- Ground resolution (skipped while carried by a rotating slice) ---
    if (!this.beingCarried) {
      const overCube = Math.abs(this.position.x) <= HALF + 0.05 && Math.abs(this.position.z) <= HALF + 0.05;
      const inLandBand = this.position.y <= GROUND_Y && this.position.y > GROUND_Y - 1.0;
      if (overCube && inLandBand && this.velocity.y <= 0) {
        this.position.y = GROUND_Y;
        this.velocity.y = 0;
        this.onGround = true;
        this.coyote = COYOTE_TIME;
      } else {
        if (this.onGround) this.coyote = COYOTE_TIME;
        this.onGround = false;
        this.coyote -= dt;
      }
    }

    this.updateGhosts(dt);
    this.syncMesh();
    return out;
  }

  private spawnGhosts(dt: number) {
    this.ghostTimer -= dt;
    if (this.ghostTimer > 0) return;
    this.ghostTimer = 0.025;
    const mesh = new THREE.Mesh(
      this.mesh.geometry,
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.5 })
    );
    mesh.position.copy(this.position);
    this.scene.add(mesh);
    this.ghosts.push({ mesh, life: 0.3 });
  }

  private updateGhosts(dt: number) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      const m = g.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, g.life / 0.3) * 0.5;
      if (g.life <= 0) {
        this.scene.remove(g.mesh);
        this.ghosts.splice(i, 1);
      }
    }
  }

  private syncMesh() {
    this.group.position.copy(this.position);
    this.mesh.rotation.y += 0.01;
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}
