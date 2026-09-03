/**
 * Thirty-six worlds: twelve hues, each in a light, a medium and a dark.
 *
 * Twelve flat mid-tones could not tell a "film" world from a "money" world
 * from a "someday" world once more than a handful of things were going, and a
 * wall you cannot read at a glance is a wall you stop opening. Three
 * intensities of one hue still read as a family — a light blue and a dark blue
 * are obviously related, which is exactly what colour-as-a-folder needs —
 * while being unmistakable side by side.
 *
 * The twelve mediums are the original hand-tuned hexes, byte for byte, in
 * their original order. This is not sentiment: `migrate()` matches stored
 * worlds by hex, so changing one would hand an existing wall a duplicate
 * palette and orphan every note filed under it. The lights and darks are
 * derived from those same hexes, so a hue's three shades can never drift apart.
 */

/** The original twelve. Never edit, never reorder — notes are filed by these. */
const MEDIUMS = [
  "#F2E14C", // yellow
  "#A8C64F", // lime
  "#5FC9A8", // teal
  "#6FA8F0", // blue
  "#A98BE0", // violet
  "#E87FB4", // pink
  "#E85D5D", // red
  "#F29441", // orange
  "#F0B92E", // amber
  "#CE8BE8", // orchid
  "#6FD8E8", // cyan
  "#7ED97E", // green
] as const;

const NAMES = ["yellow", "lime", "teal", "blue", "violet", "pink",
  "red", "orange", "amber", "orchid", "cyan", "green"] as const;

interface Hsl { h: number; s: number; l: number }

function toHsl(hex: string): Hsl {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0))
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const part = (n: number) =>
    Math.round(255 * Math.max(0, Math.min(1, f(n))))
      .toString(16)
      .padStart(2, "0");
  return `#${part(0)}${part(8)}${part(4)}`.toUpperCase();
}

/**
 * A shade of the same hue.
 *
 * Lightness is moved toward a target rather than set to it, so a hue that is
 * already pale (yellow) and one that is already deep (red) both end up
 * recognisably lighter or darker than their medium without either collapsing
 * to white or to mud. Saturation is pulled in on the darks: a fully saturated
 * dark reads as a colour cast rather than a colour.
 */
function shade(hex: string, target: number, satScale: number): string {
  const c = toHsl(hex);
  return toHex({
    h: c.h,
    s: Math.max(0.18, Math.min(0.95, c.s * satScale)),
    l: c.l + (target - c.l) * 0.78,
  });
}

/*
 * These two targets are not taste, they are the tightest pair that keeps all
 * thirty-six swatches at WCAG AA (4.5:1) against whichever ink readableInk
 * picks for them. A dark target of 0.30 leaves deep amber at 4.39; 0.27 puts
 * the worst case at 4.71.
 */
const LIGHTS = MEDIUMS.map((hex) => shade(hex, 0.87, 0.9));
const DARKS = MEDIUMS.map((hex) => shade(hex, 0.27, 0.7));

/**
 * Mediums first in their historical positions, then lights, then darks.
 * Appending is the only safe edit: the index is a keyboard shortcut and, on an
 * existing wall, a filing decision somebody already made.
 */
export const DEFAULT_SWATCHES: readonly string[] = [
  ...MEDIUMS,
  ...LIGHTS,
  ...DARKS,
];

/** What a world is called before you name it yourself. */
export function swatchName(index: number): string {
  const hue = NAMES[index % NAMES.length];
  const band = ["", "light ", "deep "][Math.floor(index / NAMES.length)] ?? "";
  return hue ? `${band}${hue}` : `world ${index + 1}`;
}

/**
 * Black or white, whichever is legible on this colour.
 *
 * With a single row of mid-tones every card could hardcode #111. A deep violet
 * cannot, so the choice is computed: WCAG relative luminance, with the
 * threshold at the point where contrast against white and against near-black
 * cross. This is what lets the palette have darks at all.
 */
export function readableInk(hex: string): string {
  const v = hex.replace("#", "");
  const channel = (i: number) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // Contrast against white is 1.05 / (lum + 0.05); against #111 it is
  // (lum + 0.05) / 0.0556. Setting those equal gives (lum + 0.05)^2 = 0.0584,
  // so they cross at lum ≈ 0.1917 — below that white wins, above it #111 does.
  return lum > 0.1917 ? "#111111" : "#FFFFFF";
}
