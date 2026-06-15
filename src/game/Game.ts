import * as THREE from "three";
import { Input } from "./Input";
import { CubeArena } from "./CubeArena";
import { Player } from "./Player";
import { CameraController } from "./CameraController";
import { HazardManager } from "./Hazards";
import { AudioManager } from "./Audio";
import { UI } from "./UI";
import { COLORS, FALL_DEATH_Y } from "./config";

type State = "menu" | "how" | "countdown" | "playing" | "paused" | "gameover";

const DIFFICULTY_RAMP = 75; // seconds to reach max difficulty

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private input: Input;
  private arena = new CubeArena();
  private player: Player;
  private camCtrl: CameraController;
  private hazards: HazardManager;
  private audio = new AudioManager();
  private ui: UI;

  private state: State = "menu";

  // run stats
  private elapsed = 0;
  private rotationsSurvived = 0;
  private nearMisses = 0;
  private hazardsDodged = 0;

  // countdown
  private cdValue = 0;
  private cdTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060814, 1);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 10, 14);

    this.input = new Input(canvas);
    this.player = new Player(this.scene);
    this.camCtrl = new CameraController(this.camera);
    this.hazards = new HazardManager(this.scene);

    this.scene.add(this.arena.group);
    this.buildEnvironment();
    this.wireCallbacks();

    this.ui = new UI({
      onPlay: () => this.startRun(),
      onHow: () => {
        this.state = "how";
        this.ui.showHow();
      },
      onHowBack: () => {
        this.state = "menu";
        this.ui.showMenu();
      },
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onQuit: () => this.toMenu(),
      onPause: () => this.togglePause(),
    });

    this.ui.showMenu();
    window.addEventListener("resize", () => this.onResize());
    this.onResize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private buildEnvironment() {
    this.scene.fog = new THREE.FogExp2(0x060814, 0.012);
    this.scene.add(new THREE.AmbientLight(0x4455aa, 0.6));

    const key = new THREE.PointLight(COLORS.cyan, 1.2, 80);
    key.position.set(10, 18, 10);
    this.scene.add(key);
    const fill = new THREE.PointLight(COLORS.pink, 0.9, 80);
    fill.position.set(-12, 10, -8);
    this.scene.add(fill);
    const top = new THREE.DirectionalLight(0xffffff, 0.4);
    top.position.set(0, 20, 0);
    this.scene.add(top);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const count = 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 60 + Math.random() * 60;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9fb6ff, size: 0.5, sizeAttenuation: true })
    );
    this.scene.add(stars);
  }

  private wireCallbacks() {
    this.arena.onWarn = () => {
      this.audio.warn();
      this.ui.showWarning(true);
    };
    this.arena.onRotate = () => this.audio.rotate();
    this.arena.onRotateComplete = () => {
      this.ui.showWarning(false);
      if (!this.player.beingCarried) this.rotationsSurvived++;
    };

    this.hazards.onFire = () => this.audio.shoot();
    this.hazards.onHit = () => {
      this.audio.hit();
      this.camCtrl.addShake(1.0);
    };
    this.hazards.onNearMiss = () => {
      this.nearMisses++;
      this.audio.countBeep();
    };
    this.hazards.onDodge = () => this.hazardsDodged++;
  }

  // ---------- State transitions ----------

  private startRun() {
    this.audio.resume();
    this.elapsed = 0;
    this.rotationsSurvived = 0;
    this.nearMisses = 0;
    this.hazardsDodged = 0;
    this.player.reset();
    this.arena.reset();
    this.hazards.reset();
    this.camCtrl.reset();
    this.ui.showHud();
    this.ui.showWarning(false);
    this.cdValue = 3;
    this.cdTimer = 0.9;
    this.ui.showCountdown("3");
    this.audio.countBeep();
    this.state = "countdown";
  }

  private toMenu() {
    this.state = "menu";
    this.input.unlock();
    this.hazards.clearProjectiles();
    this.ui.showMenu();
  }

  private togglePause() {
    if (this.state === "playing") this.pause();
    else if (this.state === "paused") this.resume();
  }
  private pause() {
    this.state = "paused";
    this.input.unlock();
    this.ui.showPause();
  }
  private resume() {
    this.ui.hidePause();
    this.state = "playing";
  }

  private gameOver() {
    this.audio.fall();
    setTimeout(() => this.audio.gameOver(), 300);
    this.state = "gameover";
    this.input.unlock();
    const score = this.score();
    const newBest = this.ui.showGameOver(this.elapsed, score);
    if (newBest) setTimeout(() => this.audio.highScore(), 600);
  }

  private score(): number {
    return Math.floor(
      this.elapsed * 100 + this.hazardsDodged * 25 + this.nearMisses * 50 + this.rotationsSurvived * 75
    );
  }

  // ---------- Main loop ----------

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Global hotkeys
    if (this.input.pressed("Escape") || this.input.pressed("KeyP")) {
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
    }
    if (this.input.pressed("KeyR") && (this.state === "playing" || this.state === "gameover" || this.state === "paused")) {
      this.startRun();
    }

    switch (this.state) {
      case "countdown":
        this.updateCountdown(dt);
        this.idleSpin(dt);
        break;
      case "playing":
        this.updatePlaying(dt);
        break;
      case "menu":
      case "how":
      case "paused":
      case "gameover":
        this.idleSpin(dt);
        break;
    }

    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  private idleSpin(dt: number) {
    // Gentle camera drift for non-gameplay screens.
    this.camCtrl.yaw += dt * 0.15;
    this.camCtrl.update(dt, this.player.position);
  }

  private updateCountdown(dt: number) {
    this.cdTimer -= dt;
    this.camCtrl.update(dt, this.player.position);
    if (this.cdTimer <= 0) {
      this.cdValue--;
      if (this.cdValue > 0) {
        this.ui.showCountdown(String(this.cdValue));
        this.audio.countBeep();
        this.cdTimer = 0.9;
      } else if (this.cdValue === 0) {
        this.ui.showCountdown("GO!");
        this.audio.go();
        this.cdTimer = 0.6;
      } else {
        this.ui.hideCountdown();
        this.state = "playing";
      }
    }
  }

  private updatePlaying(dt: number) {
    this.elapsed += dt;
    const level = Math.min(this.elapsed / DIFFICULTY_RAMP, 1);
    this.arena.setDifficulty(level);
    this.hazards.setDifficulty(level);

    // Camera look
    if (this.input.locked) this.camCtrl.handleMouse(this.input.mouseDX, this.input.mouseDY);

    // Movement direction relative to camera yaw
    const axis = this.input.moveAxis();
    const yaw = this.camCtrl.yaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const moveDir = new THREE.Vector3()
      .addScaledVector(forward, -axis.y)
      .addScaledVector(right, axis.x);
    if (moveDir.lengthSq() > 1) moveDir.normalize();

    const wantJump = this.input.pressed("Space");
    const wantDash = this.input.pressed("ShiftLeft") || this.input.pressed("ShiftRight");

    // Cube shifting
    this.arena.update(dt);
    if (this.arena.isRotating && this.arena.frameDelta > 0) {
      if (!this.player.beingCarried && this.player.onGround &&
          this.arena.isAffectedAt(this.player.position.x, this.player.position.z)) {
        this.player.beingCarried = true;
      }
      if (this.player.beingCarried) {
        this.player.carry(this.arena.axisVector(), this.arena.frameDelta);
        this.player.onGround = false;
      }
    } else {
      this.player.beingCarried = false;
    }

    // Player physics
    const ev = this.player.update(dt, moveDir, wantJump, wantDash);
    if (ev.jumped) this.audio.jump();
    if (ev.dashed) this.audio.dash();

    // Hazards
    const knockback = this.hazards.update(dt, this.player.position, true);
    if (knockback) this.player.applyKnockback(knockback, 13);

    // Camera
    this.camCtrl.setZoomedOut(this.arena.isRotating);
    this.camCtrl.update(dt, this.player.position);

    // Fall check
    if (this.player.position.y < FALL_DEATH_Y) {
      this.gameOver();
      return;
    }

    // HUD
    this.ui.updateHud(this.elapsed, this.score(), this.player.dashCooldownFraction, this.player.dashReady);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
