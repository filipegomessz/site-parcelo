// Scroll always owns the pose. There is no held band or timed jump at the seam.
export const HANDOFF_START = .30;
export const HANDOFF_END = .38;
export class HandoffMotion {
  constructor() { this.raw = this.value = 0; }
  get active() { return false; }
  sample(raw) { this.raw = this.value = raw; return raw; }
}
