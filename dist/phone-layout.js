import { transitionPose } from './money-transition.js';
// Camera-space crop only: no mesh simplification, lower DPR or texture resizing.
export function sceneLayout(width, height, compact, halfSize, moneyHalfSize = halfSize) {
  const scale = Math.max(width / 1672, height / 941);
  const startX = (width - 1672 * scale) / 2 + 840 * scale + (compact ? 0 : width * .185);
  const startY = (height - 941 * scale) / 2 + 285 * scale;
  const startHeight = Math.min(330 * scale, height * .43, width * .82);
  const endHeight = compact
    ? width <= 700 ? Math.min(height * .4, width * 1.05) : Math.min(height * .46, width * .55)
    : Math.min(height * (height <= 700 ? .70 : .78), width * .58);
  const endY = compact ? height * (width <= 700 ? .285 : .35) : height * .53;
  const focal = height / (2 * Math.tan(32 * Math.PI / 360));
  // Conservative bounds for every Y rotation and the complete X/Z tilt range.
  // Euler XYZ applies Z, then Y, then X to each point.
  const zX = halfSize.x + halfSize.y * Math.sin(.09);
  const zY = halfSize.y + halfSize.x * Math.sin(.09);
  const sweepX = Math.hypot(zX, halfSize.z);
  const sweepY = zY + sweepX * Math.sin(.035) + .008;
  const sweepZ = sweepX + zY * Math.sin(.035);
  let left = width, right = 0, top = height, bottom = 0;
  // Projected edges are ratios of affine functions of approach progress, so
  // endpoint extrema contain the entire trajectory, not just sampled poses.
  for (const [cx, cy, pixels] of [[startX, startY, startHeight], [width / 2, endY, endHeight]]) {
    for (const dx of [-sweepX, sweepX]) for (const dy of [-sweepY, sweepY]) for (const dz of [-sweepZ, sweepZ]) {
      const denominator = 1 - dz * pixels / focal;
      if (denominator <= 0) return { startX, startY, startHeight, endHeight, endY, focal, crop: { x: 0, y: 0, width, height } };
      const x = width / 2 + (cx - width / 2 + dx * pixels) / denominator;
      const y = height / 2 + (cy - height / 2 + dy * pixels) / denominator;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  // Cash rotates in all three axes. Its enclosing sphere bounds every pose
  // until the exchange finishes, without enlarging the final phone crop.
  const radius = Math.hypot(moneyHalfSize.x, moneyHalfSize.y, moneyHalfSize.z);
  const cashEnd = transitionPose(.358).approach;
  for (const p of [0, cashEnd]) {
    const cx = startX + (width / 2 - startX) * p;
    const cy = startY + (endY - startY) * p;
    const pixels = startHeight + (endHeight - startHeight) * p;
    for (const dx of [-radius, radius]) for (const dy of [-radius - .008, radius + .008]) for (const dz of [-radius, radius]) {
      const denominator = 1 - dz * pixels / focal;
      const x = width / 2 + (cx - width / 2 + dx * pixels) / denominator;
      const y = height / 2 + (cy - height / 2 + dy * pixels) / denominator;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  left = Math.max(0, Math.floor(left - 16)); top = Math.max(0, Math.floor(top - 16));
  right = Math.min(width, Math.ceil(right + 16)); bottom = Math.min(height, Math.ceil(bottom + 16));
  return { startX, startY, startHeight, endHeight, endY, focal, crop: { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) } };
}
