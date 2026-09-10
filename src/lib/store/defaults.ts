/**
 * A palette organised the way a person names colours.
 *
 * It was twelve hues in three shades each, generated — which is tidy and does
 * not match how anybody thinks. You do not want "deep orchid", you want a red,
 * and there are four reds because four is how many different reds are worth
 * telling apart. So the families are the ones people actually say, each family
 * runs dark to light, and the sizes are the sizes each family earns: six blues
 * and six greens because those are where a wall really spreads out, three
 * browns because three is plenty.
 *
 * Every one of the original twelve hexes is still in here, byte for byte, at
 * the place in its family where it belongs. That is not sentiment: worlds are
 * matched by hex, so dropping one would orphan every note filed under it.
 */

interface Family {
  name: string;
  /** Dark to light. What "three of each" means. */
  hexes: readonly string[];
  /** Said before the shade: "deep red", "pale blue". */
  bands: readonly string[];
}

const DEEP3 = ["deep ", "", "pale "] as const;

/*
 * Legacy hexes, marked where they sit. Never edit one of these.
 *   #E85D5D red     #6FA8F0 blue    #6FD8E8 cyan   #5FC9A8 teal
 *   #7ED97E green   #A8C64F lime    #F29441 orange #F0B92E amber
 *   #A98BE0 violet  #CE8BE8 orchid  #E87FB4 pink   #F2E14C yellow
 */
const FAMILIES: readonly Family[] = [
  {
    name: "red",
    hexes: ["#8E2F2F", "#C43C3C", "#E85D5D", "#F2A0A0"],
    bands: ["deepest ", "deep ", "", "pale "],
  },
  {
    name: "blue",
    hexes: ["#1F4F8F", "#2E6FC4", "#6FA8F0", "#A6CBF7", "#2FA3BF", "#6FD8E8"],
    bands: ["deepest ", "deep ", "", "pale ", "steel ", "cyan "],
  },
  {
    name: "green",
    hexes: ["#1B6B3A", "#2E9B54", "#7ED97E", "#B7E8AC", "#5FC9A8", "#A8C64F"],
    bands: ["deepest ", "deep ", "", "pale ", "teal ", "lime "],
  },
  {
    /* Four, not three: amber is a legacy hex and dropping it would orphan
      every note ever filed under it. */
    name: "orange",
    hexes: ["#B85C10", "#F29441", "#F0B92E", "#F7C089"],
    bands: ["deep ", "", "amber", "pale "],
  },
  {
    name: "yellow",
    hexes: ["#B8961F", "#F2E14C", "#F7EFA0"],
    bands: DEEP3,
  },
  {
    name: "purple",
    hexes: ["#4B2E83", "#7A4FC4", "#CE8BE8"],
    bands: DEEP3,
  },
  {
    name: "violet",
    hexes: ["#5A3FA8", "#A98BE0", "#CFC0F2"],
    bands: DEEP3,
  },
  {
    name: "pink",
    hexes: ["#B8446E", "#E87FB4", "#F5BAD5"],
    bands: DEEP3,
  },
  {
    name: "brown",
    hexes: ["#4A3323", "#7A5233", "#A8794F"],
    bands: DEEP3,
  },
  {
    name: "tan",
    hexes: ["#C9A47A", "#DCC29B", "#EFE0C4"],
    bands: DEEP3,
  },
  {
    name: "grey",
    hexes: ["#1B1917", "#5A554E", "#9A948A", "#D8D4CC", "#FFFFFF"],
    bands: ["black", "dark ", "", "light ", "white"],
  },
  {
    /*
     * The loud ones, kept together and kept last. A neon beside its ordinary
     * cousin looks like a mistake; a row of them together looks like a choice.
     */
    name: "neon",
    hexes: [
      "#FF2D2D",
      "#FF8A1F",
      "#F0FF2D",
      "#2DFF6A",
      "#2D8CFF",
      "#B02DFF",
      "#FF2DA8",
    ],
    bands: [
      "neon red",
      "neon orange",
      "neon yellow",
      "neon green",
      "neon blue",
      "neon purple",
      "neon pink",
    ],
  },
];

/**
 * Every swatch, family by family, dark to light.
 *
 * Appending is the only safe edit: the index is a keyboard shortcut and, on an
 * existing wall, a filing decision somebody already made.
 */
export const DEFAULT_SWATCHES: readonly string[] = FAMILIES.flatMap(
  (f) => f.hexes,
);

const SWATCH_NAMES: readonly string[] = FAMILIES.flatMap((f) =>
  f.hexes.map((_, i) => {
    const band = f.bands[i] ?? "";
    // A band that already names the colour ("black", "neon red") stands alone.
    return band.endsWith(" ") || band === "" ? `${band}${f.name}` : band;
  }),
);

/** What a world is called before you name it yourself. */
export function swatchName(index: number): string {
  return SWATCH_NAMES[index] ?? `world ${index + 1}`;
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
  const lum = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // Contrast against white is 1.05 / (lum + 0.05); against #111 it is
  // (lum + 0.05) / 0.0556. Setting those equal gives (lum + 0.05)^2 = 0.0584,
  // so they cross at lum ≈ 0.1917 — below that white wins, above it #111 does.
  return lum > 0.1917 ? "#111111" : "#FFFFFF";
}
