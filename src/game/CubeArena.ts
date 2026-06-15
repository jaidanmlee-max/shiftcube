import * as THREE from "three";
import { CUBELET, GRID, HALF, TOP_Y, COLORS, TileState } from "./config";

type AxisName = "x" | "z";

interface RotationEvent {
  axis: AxisName;
  value: number; // slice center coordinate (-2 | 0 | 2)
  cubelets: THREE.Object3D[];
  pivot: THREE.Group;
  angle: number; // accumulated radians
  target: number; // PI/2
}

const TILE_COLOR: Record<TileState, number> = {
  [TileState.Safe]: COLORS.green,
  [TileState.Warn]: COLORS.yellow,
  [TileState.Danger]: COLORS.red,
};

/**
 * The cube arena: a cosmetic 3x3x3 neon Rubik's cube that scrambles, plus a
 * persistent 3x3 grid of "danger tiles" on the top face that telegraph rotations.
 */
export class CubeArena {
  group = new THREE.Group();
  private cubelets: THREE.Mesh[] = [];
  private tiles = new Map<string, THREE.Mesh>(); // "ix,iz" -> plate
  private tileState = new Map<string, TileState>();

  private state: "idle" | "warn" | "danger" | "rotating" = "idle";
  private timer = 0;
  private rotation: RotationEvent | null = null;
  private affected = new Set<string>();

  // Per-frame rotation applied to the cube this frame (for carrying the player).
  frameDelta = 0;
  frameAxis: AxisName = "x";

  // Timing (seconds) — tightened over time by difficulty.
  warnTime = 1.5;
  dangerTime = 0.5;
  rotateTime = 0.55;
  nextEventMin = 4.5;
  nextEventMax = 7;

  // Callbacks
  onWarn: () => void = () => {};
  onRotate: () => void = () => {};
  onRotateComplete: () => void = () => {};

  constructor() {
    this.buildCubelets();
    this.buildTiles();
    this.scheduleNext();
  }

  private buildCubelets() {
    const faceColors = [
      COLORS.pink, // +x
      COLORS.cyan, // -x
      COLORS.green, // +y (top)
      COLORS.purple, // -y
      COLORS.orange, // +z
      COLORS.yellow, // -z
    ];
    const gap = 0.06;
    const size = CUBELET - gap;
    const geo = new THREE.BoxGeometry(size, size, size);

    for (const x of GRID) {
      for (const y of GRID) {
        for (const z of GRID) {
          const mats = faceColors.map(
            (c) =>
              new THREE.MeshStandardMaterial({
                color: 0x0a0e1c,
                emissive: c,
                emissiveIntensity: 0.35,
                metalness: 0.3,
                roughness: 0.4,
              })
          );
          const mesh = new THREE.Mesh(geo, mats);
          mesh.position.set(x, y, z);
          // Glowing wireframe edges.
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: COLORS.cyan })
          );
          mesh.add(edges);
          this.cubelets.push(mesh);
          this.group.add(mesh);
        }
      }
    }
  }

  private buildTiles() {
    const geo = new THREE.PlaneGeometry(CUBELET * 0.92, CUBELET * 0.92);
    for (let ix = 0; ix < 3; ix++) {
      for (let iz = 0; iz < 3; iz++) {
        const mat = new THREE.MeshBasicMaterial({
          color: TILE_COLOR[TileState.Safe],
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        });
        const tile = new THREE.Mesh(geo, mat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(GRID[ix], TOP_Y + 0.03, GRID[iz]);
        const key = `${ix},${iz}`;
        this.tiles.set(key, tile);
        this.tileState.set(key, TileState.Safe);
        this.group.add(tile);
      }
    }
  }

  private setTile(key: string, state: TileState) {
    this.tileState.set(key, state);
    const tile = this.tiles.get(key)!;
    (tile.material as THREE.MeshBasicMaterial).color.setHex(TILE_COLOR[state]);
    (tile.material as THREE.MeshBasicMaterial).opacity = state === TileState.Safe ? 0.55 : 0.9;
  }

  private scheduleNext() {
    this.state = "idle";
    this.timer = this.nextEventMin + Math.random() * (this.nextEventMax - this.nextEventMin);
  }

  /** Index (0..2) of the nearest grid cell to a world coordinate. */
  static cellIndex(coord: number): number {
    if (coord < -1) return 0;
    if (coord > 1) return 2;
    return 1;
  }

  /** Is the tile under (x,z) currently part of an active/imminent rotation? */
  isAffectedAt(x: number, z: number): boolean {
    const key = `${CubeArena.cellIndex(x)},${CubeArena.cellIndex(z)}`;
    return this.affected.has(key);
  }

  axisVector(): THREE.Vector3 {
    return this.frameAxis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  }

  private beginEvent() {
    // Pick a random slice: axis + which row/column.
    const axis: AxisName = Math.random() < 0.5 ? "x" : "z";
    const value = GRID[Math.floor(Math.random() * 3)];

    this.affected.clear();
    for (let i = 0; i < 3; i++) {
      const key = axis === "x" ? `${GRID.indexOf(value)},${i}` : `${i},${GRID.indexOf(value)}`;
      this.affected.add(key);
      this.setTile(key, TileState.Warn);
    }

    this.rotation = { axis, value, cubelets: [], pivot: new THREE.Group(), angle: 0, target: Math.PI / 2 };
    this.state = "warn";
    this.timer = this.warnTime;
    this.onWarn();
  }

  private startRotating() {
    const rot = this.rotation!;
    this.group.add(rot.pivot);
    // Gather cubelets in this slice and parent them under the pivot at origin.
    for (const c of this.cubelets) {
      if (Math.abs(c.position[rot.axis] - rot.value) < 0.5) {
        rot.cubelets.push(c);
        rot.pivot.attach(c); // preserves world transform
      }
    }
    this.state = "rotating";
    this.onRotate();
  }

  private finishRotating() {
    const rot = this.rotation!;
    // Bake transforms back onto the cubelets and snap to the grid.
    for (const c of rot.cubelets) {
      this.group.attach(c);
      c.position.set(
        Math.round(c.position.x / 2) * 2,
        Math.round(c.position.y / 2) * 2,
        Math.round(c.position.z / 2) * 2
      );
      c.rotation.set(
        Math.round(c.rotation.x / (Math.PI / 2)) * (Math.PI / 2),
        Math.round(c.rotation.y / (Math.PI / 2)) * (Math.PI / 2),
        Math.round(c.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
      );
    }
    this.group.remove(rot.pivot);
    for (const key of this.affected) this.setTile(key, TileState.Safe);
    this.affected.clear();
    this.rotation = null;
    this.onRotateComplete();
    this.scheduleNext();
  }

  update(dt: number) {
    this.frameDelta = 0;
    this.timer -= dt;

    switch (this.state) {
      case "idle":
        if (this.timer <= 0) this.beginEvent();
        break;
      case "warn":
        if (this.timer <= 0) {
          for (const key of this.affected) this.setTile(key, TileState.Danger);
          this.state = "danger";
          this.timer = this.dangerTime;
        }
        break;
      case "danger":
        if (this.timer <= 0) {
          this.startRotating();
          this.timer = this.rotateTime;
        }
        break;
      case "rotating": {
        const rot = this.rotation!;
        const step = (rot.target * dt) / this.rotateTime;
        const remaining = rot.target - rot.angle;
        const delta = Math.min(step, remaining);
        rot.angle += delta;
        this.frameDelta = delta;
        this.frameAxis = rot.axis;
        rot.pivot.rotation[rot.axis] += delta;
        if (rot.angle >= rot.target - 1e-4) this.finishRotating();
        break;
      }
    }
  }

  /** Ramp difficulty: shorter warnings, faster rotations, tighter intervals. */
  setDifficulty(level: number) {
    const t = Math.min(level, 1);
    this.warnTime = 1.5 - 0.6 * t;
    this.dangerTime = 0.5 - 0.2 * t;
    this.rotateTime = 0.55 - 0.18 * t;
    this.nextEventMin = 4.5 - 2.6 * t;
    this.nextEventMax = 7 - 3.5 * t;
  }

  get isRotating(): boolean {
    return this.state === "rotating";
  }

  reset() {
    // Rebuild cubelets to a clean solved state.
    for (const c of this.cubelets) this.group.remove(c);
    this.cubelets = [];
    if (this.rotation) this.group.remove(this.rotation.pivot);
    this.rotation = null;
    this.buildCubelets();
    for (const key of this.tileState.keys()) this.setTile(key, TileState.Safe);
    this.affected.clear();
    this.warnTime = 1.5;
    this.dangerTime = 0.5;
    this.rotateTime = 0.55;
    this.nextEventMin = 4.5;
    this.nextEventMax = 7;
    this.scheduleNext();
  }
}

export { HALF };
