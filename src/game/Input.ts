// Keyboard + pointer-lock mouse input. Reads are pull-based from the game loop.

export class Input {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  public mouseDX = 0;
  public mouseDY = 0;
  public locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.requestLock);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.code;
    if (!this.keys.has(k)) this.justPressed.add(k);
    this.keys.add(k);
    // Stop space/arrows from scrolling the page.
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private requestLock = () => {
    if (!this.locked) this.canvas.requestPointerLock();
  };

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  down(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the key went down. Consumes the event. */
  pressed(code: string): boolean {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  /** Movement axis from WASD, range -1..1 each. */
  moveAxis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.down("KeyW")) y -= 1;
    if (this.down("KeyS")) y += 1;
    if (this.down("KeyA")) x -= 1;
    if (this.down("KeyD")) x += 1;
    return { x, y };
  }

  /** Call once per frame after reading mouse deltas. */
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.justPressed.clear();
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }
}
