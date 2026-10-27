export type FloorPattern = 'straight' | 'herringbone';

/** A true 90-degree herringbone tessellation, including negative floor coordinates. */
export function herringboneTile(x: number, y: number, width: number, length: number) {
  const count = Math.max(2, Math.round(length / width));
  const gx = x / width, gy = y / width;
  const cx = Math.floor(gx), cy = Math.floor(gy);
  const phase = ((cx + cy) % (2 * count) + 2 * count) % (2 * count);
  const horizontal = phase < count;
  const originX = horizontal ? cx - phase : cx;
  const originY = horizontal ? cy : cy - (phase - count);
  return {
    u: horizontal ? (gx - originX) / count : (gy - originY) / count,
    v: horizontal ? gy - cy : 1 - (gx - cx),
    idX: originX,
    idY: originY + (horizontal ? 0 : 97),
    length: count * width,
    horizontal,
  };
}
