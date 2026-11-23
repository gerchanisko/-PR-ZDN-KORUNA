// Klávesnice + gamepad. Akce: up, down, left, right, act, run, turn, inv, back
const MAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyE: 'act', Enter: 'act', Space: 'act', ShiftLeft: 'run', ShiftRight: 'run', KeyQ: 'turn', KeyX: 'turn',
  Tab: 'inv', KeyI: 'inv', Escape: 'back', Backspace: 'back', KeyM: 'mute', KeyV: 'view',
};
class Input {
  constructor() {
    this.held = {}; this.hits = {}; this.pending = {}; this.virtual = {}; this.virtualHits = {}; this.vpending = {};
    this.anyKey = false; this.anyPending = false;
    this.codes = {}; this.pad = {}; this.mouseX = 0; this.mouseY = 0;
    addEventListener('mousemove', e => { if (document.pointerLockElement) { this.mouseX += e.movementX; this.mouseY += e.movementY; } });
    addEventListener('keydown', e => {
      const a = MAP[e.code];
      this.codes[e.code] = true;
      if (a) { e.preventDefault(); if (!e.repeat) this.pending[a] = true; this.held[a] = true; }
      if (!e.repeat) this.anyPending = true;
    });
    addEventListener('keyup', e => { this.codes[e.code] = false; const a = MAP[e.code]; if (a) this.held[a] = false; });
    addEventListener('blur', () => { this.held = {}; this.codes = {}; });
    this.padPrev = {};
  }
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(Boolean);
    if (!p) return;
    const b = i => p.buttons[i] && p.buttons[i].pressed;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const st = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, act: b(0), run: b(2) || b(7), turn: b(1), inv: b(9) || b(3), back: b(8) };
    for (const [k, v] of Object.entries(st)) {
      if (v && !this.padPrev[k]) { this.hits[k] = true; this.anyKey = true; }
      if (v !== this.padPrev[k]) this.held[k] = v;
    }
    this.padPrev = st; this.pad = st;
  }
  down(a) { return !!(this.held[a] || this.virtual[a]); }
  hit(a) { return !!(this.hits[a] || this.virtualHits[a]); }
  consume(a) { this.hits[a] = false; this.virtualHits[a] = false; }
  /** Pohyb myši od posledního čtení (pointer lock). */
  mouse() { const m = [this.mouseX, this.mouseY]; this.mouseX = this.mouseY = 0; return m; }
  /** Simulovaný stisk (automatický playtest). */
  press(a) { this.vpending[a] = true; this.anyPending = true; }
  /** Volá se na začátku snímku – stisky platí celý snímek včetně async pokračování po něm. */
  beginFrame() {
    this.hits = this.pending; this.pending = {};
    this.virtualHits = this.vpending; this.vpending = {};
    this.anyKey = this.anyPending; this.anyPending = false;
  }
}
export const input = new Input();
