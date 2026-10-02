import { HANDOFF_AT } from './money-transition.js';

export const HANDOFF_START = .30;
export const HANDOFF_END = .38;
const DURATION = 260;
const lerp = (a, b, t) => a + (b - a) * t;

// Scroll selects the model. A short clock completes its exchange independently.
export class HandoffMotion {
  constructor() {
    this.side = undefined;
    this.raw = 0;
    this.value = 0;
    this.transition = null;
  }

  get active() { return this.transition !== null; }

  mapped(raw, side) {
    return side ? Math.max(HANDOFF_END, raw) : Math.min(HANDOFF_START, raw);
  }

  advance(raw, time) {
    const destination = this.mapped(raw, this.side);
    if (!this.transition) return destination;
    const fraction = Math.max(0, Math.min(1, (time - this.transition.start) / DURATION));
    // Ease out from the already-visible pose; don't restart when scrolling stops.
    const blend = 1 - Math.pow(1 - fraction, 3);
    const value = lerp(this.transition.from, destination, blend);
    if (fraction === 1) this.transition = null;
    return value;
  }

  sample(raw, time, { reduced = false, settle = false } = {}) {
    const side = raw >= HANDOFF_AT;
    if (this.side === undefined || reduced || settle) {
      this.side = side;
      this.transition = null;
      this.raw = raw;
      this.value = reduced ? raw : this.mapped(raw, side);
      return this.value;
    }
    if (side !== this.side) {
      const from = this.advance(this.raw, time);
      this.side = side;
      this.transition = { start: time, from };
    }
    this.raw = raw;
    this.value = this.advance(raw, time);
    return this.value;
  }
}
