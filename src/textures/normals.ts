/** Physical derivatives keep relief independent of the requested map resolution. DOM-free so it runs in workers. */
export function sobelNormals(heights: Float32Array, width: number, height: number, lengthMm: number, widthMm: number): Uint8ClampedArray {
  if (heights.length !== width * height) throw new Error('Height field dimensions do not match.');
  const normals = new Uint8ClampedArray(width * height * 4);
  const mmPerX = lengthMm / (width - 1);
  const mmPerY = widthMm / (height - 1);
  for (let y = 0; y < height; y++) {
    const up = Math.max(0, y - 1) * width;
    const middle = y * width;
    const down = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - 1);
      const right = Math.min(width - 1, x + 1);
      const tl = heights[up + left];
      const tr = heights[up + right];
      const bl = heights[down + left];
      const br = heights[down + right];
      const dx = (tr + 2 * heights[middle + right] + br - tl - 2 * heights[middle + left] - bl) / (8 * mmPerX);
      const dy = (bl + 2 * heights[down + x] + br - tl - 2 * heights[up + x] - tr) / (8 * mmPerY);
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (middle + x) * 4;
      normals[i] = (0.5 - dx * inverseLength * 0.5) * 255;
      // Canvas Y is downward; texture V is upward after Three's default flipY.
      normals[i + 1] = (0.5 + dy * inverseLength * 0.5) * 255;
      normals[i + 2] = (0.5 + inverseLength * 0.5) * 255;
      normals[i + 3] = 255;
    }
  }
  return normals;
}

/** Expands a single-channel roughness field to RGBA bytes. */
export function roughnessToRgba(roughness: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(roughness.length * 4);
  for (let i = 0; i < roughness.length; i++) {
    out[i * 4] = roughness[i];
    out[i * 4 + 1] = roughness[i];
    out[i * 4 + 2] = roughness[i];
    out[i * 4 + 3] = 255;
  }
  return out;
}
