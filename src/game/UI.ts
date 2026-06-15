const BEST_KEY = "shiftcube_best_v1";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export interface UICallbacks {
  onPlay: () => void;
  onHow: () => void;
  onHowBack: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onPause: () => void;
}

export class UI {
  private menu = $("menu");
  private how = $("how");
  private pause = $("pause");
  private gameover = $("gameover");
  private hud = $("hud");

  private hudTime = $("hud-time");
  private hudScore = $("hud-score");
  private hudBest = $("hud-best");
  private dashFill = $("dash-fill");
  private warning = $("warning-banner");
  private countdown = $("countdown");

  bestScore = 0;

  constructor(cb: UICallbacks) {
    this.bestScore = Number(localStorage.getItem(BEST_KEY) || 0);
    $("menu-best").textContent = String(this.bestScore);
    this.hudBest.textContent = String(this.bestScore);

    $("play-btn").addEventListener("click", cb.onPlay);
    $("again-btn").addEventListener("click", cb.onRestart);
    $("how-btn").addEventListener("click", cb.onHow);
    $("how-back").addEventListener("click", cb.onHowBack);
    $("resume-btn").addEventListener("click", cb.onResume);
    $("restart-btn").addEventListener("click", cb.onRestart);
    $("quit-btn").addEventListener("click", cb.onQuit);
    $("menu-btn").addEventListener("click", cb.onQuit);
    $("pause-btn").addEventListener("click", cb.onPause);
  }

  private hideAll() {
    this.menu.classList.add("hidden");
    this.how.classList.add("hidden");
    this.pause.classList.add("hidden");
    this.gameover.classList.add("hidden");
  }

  showMenu() {
    this.hideAll();
    this.hud.classList.add("hidden");
    this.menu.classList.remove("hidden");
    $("menu-best").textContent = String(this.bestScore);
  }
  showHow() {
    this.hideAll();
    this.how.classList.remove("hidden");
  }
  showPause() {
    this.pause.classList.remove("hidden");
  }
  hidePause() {
    this.pause.classList.add("hidden");
  }
  showHud() {
    this.hideAll();
    this.hud.classList.remove("hidden");
  }

  showCountdown(text: string) {
    this.countdown.textContent = text;
    this.countdown.classList.remove("hidden");
    // restart the pop animation
    this.countdown.style.animation = "none";
    void this.countdown.offsetWidth;
    this.countdown.style.animation = "";
  }
  hideCountdown() {
    this.countdown.classList.add("hidden");
  }

  showWarning(show: boolean) {
    this.warning.classList.toggle("hidden", !show);
  }

  updateHud(time: number, score: number, dashFraction: number, dashReady: boolean) {
    this.hudTime.textContent = time.toFixed(1);
    this.hudScore.textContent = String(score);
    this.dashFill.style.width = `${Math.round(dashFraction * 100)}%`;
    this.dashFill.classList.toggle("charging", !dashReady);
  }

  showGameOver(time: number, score: number) {
    let isNewBest = false;
    if (score > this.bestScore) {
      this.bestScore = score;
      localStorage.setItem(BEST_KEY, String(score));
      isNewBest = true;
    }
    $("go-time").textContent = `${time.toFixed(1)}s`;
    $("go-score").textContent = String(score);
    $("go-best").textContent = String(this.bestScore);
    this.hudBest.textContent = String(this.bestScore);
    $("newbest").classList.toggle("hidden", !isNewBest);
    this.gameover.classList.remove("hidden");
    return isNewBest;
  }
}
