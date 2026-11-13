export type MapColors = {
  sea: string;
  land: string;
  coast: string;
  border: string;
  province: string;
  label: string;
  city: string;
};

// The style needs literal colors; reading the tokens keeps globals.css the only source
export function readMapColors(): MapColors {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
  return {
    sea: token("map-sea"),
    land: token("map-land"),
    coast: token("map-coast"),
    border: token("map-border"),
    province: token("map-province"),
    label: token("muted"),
    city: token("foreground"),
  };
}
