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

/**
 * Swatches this palette used to offer and no longer does.
 *
 * Fifty colours drawn four rows deep is not a palette, it is a screenful of
 * twenty-pixel squares, and the ones doing the damage were the ones nobody
 * could tell apart anyway. Measured as perceptual distance rather than picked
 * by eye: every pair below is under a delta-E of eighteen from something else
 * still in the list, which is close enough to read as the same colour at the
 * size these are drawn. Nine went; what is left has no avoidable clash in it.
 *
 * They are listed rather than simply deleted because a wall already holds its
 * own copy of every default it was ever seeded with, so removing one from the
 * list above would take it off new devices and leave it on this one for ever.
 * A retired swatch is withdrawn from a wall on load — but only if nothing is
 * filed under it and nobody has named it. A colour is a folder here, and a
 * folder with things in it does not get tidied away because the palette
 * changed its mind.
 */
export const RETIRED_SWATCHES: readonly string[] = [
  "#C43C3C", // deep red, 12.2 from red
  "#1F4F8F", // deepest blue, 16.8 from deep blue
  "#F7C089", // pale orange, 15.2 from tan
  "#5A3FA8", // deep violet, 10.6 from mid purple
  "#CFC0F2", // pale violet, 17.2 from pale blue
  "#7A5233", // mid brown, 16.9 from light brown
  "#C9A47A", // deep tan, 11.6 from tan
  "#EFE0C4", // pale tan, 12.1 from light grey
  "#FF8A1F", // neon orange, 15.8 from orange
];

/*
 * Legacy hexes, marked where they sit. Never edit one of these.
 *   #E85D5D red     #6FA8F0 blue    #6FD8E8 cyan   #5FC9A8 teal
 *   #7ED97E green   #A8C64F lime    #F29441 orange #F0B92E amber
 *   #A98BE0 violet  #CE8BE8 orchid  #E87FB4 pink   #F2E14C yellow
 */
const FAMILIES: readonly Family[] = [
  {
    name: "red",
    hexes: ["#8E2F2F", "#E85D5D", "#F2A0A0"],
    bands: ["deep ", "", "pale "],
  },
  {
    name: "blue",
    hexes: ["#2E6FC4", "#6FA8F0", "#A6CBF7", "#2FA3BF", "#6FD8E8"],
    bands: ["deep ", "", "pale ", "steel ", "cyan "],
  },
  {
    name: "green",
    hexes: ["#1B6B3A", "#2E9B54", "#7ED97E", "#B7E8AC", "#5FC9A8", "#A8C64F"],
    bands: ["deepest ", "deep ", "", "pale ", "teal ", "lime "],
  },
  {
    /* Three, and amber is one of them: it is a legacy hex and dropping it
      would orphan every note ever filed under it. */
    name: "orange",
    hexes: ["#B85C10", "#F29441", "#F0B92E"],
    bands: ["deep ", "", "amber"],
  },
  {
    name: "yellow",
    hexes: ["#B8961F", "#F2E14C", "#F7EFA0"],
    bands: DEEP3,
  },
  {
    /*
     * Purple and violet were two families, and measured against each other
     * three of their six swatches were closer than a person can tell apart at
     * the size a swatch is drawn — the deep violet sat between the two deep
     * purples. They are one family running dark to light. Both of the middle
     * pair are legacy hexes, which is the only reason two colours this close
     * are still here; side by side in one ramp they at least read as a range
     * rather than as the same colour offered twice.
     */
    name: "purple",
    hexes: ["#4B2E83", "#7A4FC4", "#A98BE0", "#CE8BE8"],
    bands: ["deep ", "", "violet ", "pale "],
  },
  {
    name: "pink",
    hexes: ["#B8446E", "#E87FB4", "#F5BAD5"],
    bands: DEEP3,
  },
  {
    name: "brown",
    hexes: ["#4A3323", "#A8794F"],
    bands: ["deep ", ""],
  },
  {
    /*
     * One tan. There were three, and they were the closest cluster in the
     * whole palette — every pair of them under a delta-E of thirteen, and the
     * palest was nearer to light grey than to the other two.
     */
    name: "tan",
    hexes: ["#DCC29B"],
    bands: [""],
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
    hexes: ["#FF2D2D", "#F0FF2D", "#2DFF6A", "#2D8CFF", "#B02DFF", "#FF2DA8"],
    bands: [
      "neon red",
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
/**
 * The families, for anything that wants to draw the palette as a palette.
 *
 * The picker laid its swatches out as one grid and worked out the number of
 * columns as the number of colours over three — which was right when the
 * palette was twelve hues in three shades each and became nonsense the moment
 * families had their own sizes: fifty colours over three is seventeen columns,
 * which on any real screen is a seventeen-wide wall of twenty-pixel squares.
 * A family is a row. That is the shape the data has had since it stopped
 * being generated, and it is how a person looks for a colour — they want the
 * greens, then a green.
 */
export const SWATCH_FAMILIES: readonly {
  name: string;
  hexes: readonly string[];
}[] = FAMILIES.map((f) => ({ name: f.name, hexes: f.hexes }));

/** The widest family, which is how many columns the palette needs. */
export const WIDEST_FAMILY: number = FAMILIES.reduce(
  (n, f) => Math.max(n, f.hexes.length),
  1,
);

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
