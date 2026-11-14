function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Invalid color, expected #RRGGBB: ${hex}`);
  }
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    // sRGB linearization per WCAG 2.x
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// What the screen shows when a color is painted at an opacity over a ground: browsers and MapLibre
// blend the gamma-encoded channels, so the mix is done on them and not on linear light.
export function composite(color: string, ground: string, opacity: number): string {
  if (opacity < 0 || opacity > 1) throw new RangeError(`Opacity must be within 0–1: ${opacity}`);
  luminance(color);
  luminance(ground);
  const [top, bottom] = [channels(color), channels(ground)];
  return `#${top
    .map((value, i) => Math.round(value * opacity + bottom[i] * (1 - opacity)).toString(16).padStart(2, "0"))
    .join("")}`;
}
