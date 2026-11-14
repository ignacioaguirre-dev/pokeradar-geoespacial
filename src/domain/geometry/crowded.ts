export type ScreenPoint = readonly [x: number, y: number];

// Whether any two positions sit closer than minDistance: their markers would overlap on screen.
// Quadratic, fine for the dozen creatures a fence traces
export function crowded(points: readonly ScreenPoint[], minDistance: number): boolean {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      if (dx * dx + dy * dy < minDistance * minDistance) return true;
    }
  }
  return false;
}
