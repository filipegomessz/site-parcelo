// One reversible timeline, shared by the models and the camera crop.
export const HANDOFF_AT = .34;
export const DOCK_AT = .82;
export const clamp = value => Math.max(0, Math.min(1, value));
export const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
function turnSegment(t, from, to, startSpeed, endSpeed, duration) {
  t = clamp(t);
  return (2*t*t*t - 3*t*t + 1)*from + (t*t*t - 2*t*t + t)*startSpeed*duration
    + (-2*t*t*t + 3*t*t)*to + (t*t*t - t*t)*endSpeed*duration;
}

// Blend only the small seam neighborhood; preserve the approved turn elsewhere.
function originalTurn(raw) {
  return raw <= HANDOFF_AT
    ? turnSegment(raw / HANDOFF_AT, .12, -Math.PI / 2, 0, -3, HANDOFF_AT)
    : turnSegment((raw - HANDOFF_AT) / (DOCK_AT - HANDOFF_AT), -Math.PI / 2, -Math.PI, -3, 0, DOCK_AT - HANDOFF_AT);
}
const seamStart = .30, seamEnd = .38, seamSpan = seamEnd - seamStart;
const derivativeStep = .00001;
function turnBoundary(raw) {
  const center = originalTurn(raw), left = originalTurn(raw - derivativeStep), right = originalTurn(raw + derivativeStep);
  return [center, (right - left) / (2 * derivativeStep) * seamSpan,
    (right - 2 * center + left) / (derivativeStep * derivativeStep) * seamSpan * seamSpan];
}
const [a0, a1, startAcceleration] = turnBoundary(seamStart);
const [endAngle, endSpeed, endAcceleration] = turnBoundary(seamEnd);
const a2 = startAcceleration / 2;
const b0 = endAngle - a0 - a1 - a2, b1 = endSpeed - a1 - 2 * a2, b2 = endAcceleration - 2 * a2;
const a3 = 10 * b0 - 4 * b1 + b2 / 2, a4 = -15 * b0 + 7 * b1 - b2, a5 = 6 * b0 - 3 * b1 + b2 / 2;
function continuousTurn(raw) {
  if (raw <= seamStart || raw >= seamEnd) return originalTurn(raw);
  const t = (raw - seamStart) / seamSpan;
  return a0 + t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
}

export function transitionPose(raw, reduced = false) {
  const before = ease(raw / HANDOFF_AT);
  const after = ease((raw - HANDOFF_AT) / (DOCK_AT - HANDOFF_AT));
  const approach = ease((raw - .10) / (DOCK_AT - .10));
  const exchange = ease((raw - .322) / .036);
  if (reduced) return { approach: raw < HANDOFF_AT ? 0 : 1, yaw: raw < HANDOFF_AT ? 0 : -Math.PI, pitch: 0, roll: raw < HANDOFF_AT ? -Math.PI / 2 : 0, exchange: raw < HANDOFF_AT ? 0 : 1, compress: 1, edge: 0 };
  return {
    approach,
    // Match angular velocity through the seam, so the turn never pauses
    // to exchange the models. Only the opening and arrival ease to rest.
    yaw: continuousTurn(raw),
    pitch: .58 * (1 - before),
    roll: -1.18 * (1 - before),
    exchange,
    compress: 1 - .26 * ease((raw - .18) / .142),
    edge: raw <= HANDOFF_AT ? before : 1 - after,
  };
}
