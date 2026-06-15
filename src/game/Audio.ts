// Tiny WebAudio synth — no asset files needed for the prototype.

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture (e.g. the Play button). */
  resume() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.5, slideTo?: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  countBeep() { this.tone(440, 0.12, "square", 0.4); }
  go() { this.tone(880, 0.25, "sawtooth", 0.5, 1320); }
  jump() { this.tone(520, 0.12, "sine", 0.4, 760); }
  dash() { this.tone(700, 0.14, "sawtooth", 0.45, 240); }
  warn() { this.tone(300, 0.18, "triangle", 0.5, 200); }
  rotate() { this.tone(180, 0.4, "sawtooth", 0.45, 90); }
  shoot() { this.tone(620, 0.08, "square", 0.25, 320); }
  hit() { this.tone(140, 0.3, "square", 0.6, 60); }
  fall() { this.tone(400, 0.6, "sawtooth", 0.5, 60); }
  gameOver() { this.tone(220, 0.6, "triangle", 0.5, 110); }
  highScore() {
    [660, 880, 1100, 1320].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.18, "square", 0.45), i * 120)
    );
  }
}
