// Shared teardrop pin shape used by CampsitePin and AmenityPin, plus the colour
// helper used to tint each pin's own selection glow (matches its fill/border colour
// rather than a fixed accent — see issue #142 follow-up).
export const PIN_PATH_D =
  "M13 1.5C7.2 1.5 2.5 6.2 2.5 12C2.5 18.5 9 24 13 26C17 24 23.5 18.5 23.5 12C23.5 6.2 18.8 1.5 13 1.5Z";

// Converts a "#rrggbb" token colour to an rgba() string with the given alpha.
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
