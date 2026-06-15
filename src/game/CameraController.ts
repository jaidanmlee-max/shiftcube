import * as THREE from "three";
import { TOP_Y } from "./config";

export class CameraController {
  yaw = 0;
  pitch = 0.62;
  private distance = 11;
  private targetDistance = 11;
  private shake = 0;
  private sens = 0.0024;

  constructor(public camera: THREE.PerspectiveCamera) {}

  handleMouse(dx: number, dy: number) {
    this.yaw -= dx * this.sens;
    this.pitch += dy * this.sens;
    this.pitch = clamp(this.pitch, 0.2, 1.25);
  }

  addShake(amount: number) {
    this.shake = Math.min(this.shake + amount, 1.2);
  }

  setZoomedOut(zoom: boolean) {
    this.targetDistance = zoom ? 14.5 : 11;
  }

  update(dt: number, target: THREE.Vector3) {
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 4);
    this.shake = Math.max(0, this.shake - dt * 2.5);

    const focus = new THREE.Vector3(target.x, target.y + 1.2, target.z);
    const cosP = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosP,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosP
    ).multiplyScalar(this.distance);

    const desired = focus.clone().add(offset);
    if (desired.y < TOP_Y + 1.5) desired.y = TOP_Y + 1.5; // don't dip into the cube

    if (this.shake > 0) {
      const s = this.shake * 0.5;
      desired.x += (Math.random() - 0.5) * s;
      desired.y += (Math.random() - 0.5) * s;
      desired.z += (Math.random() - 0.5) * s;
    }

    // Smooth follow.
    this.camera.position.lerp(desired, Math.min(1, dt * 9));
    this.camera.lookAt(focus);
  }

  reset() {
    this.yaw = 0;
    this.pitch = 0.62;
    this.distance = 11;
    this.targetDistance = 11;
    this.shake = 0;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
