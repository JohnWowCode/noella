import type { Color } from "./types";

/**
 * A coloured card, as a tint rather than a slab.
 *
 * Every card used to be filled with its folder's colour at full saturation, so
 * a wall of eight notes was eight fully saturated rectangles and the colour
 * shouted louder than anything written on it. The hue is a hint now: the
 * surface is that colour mixed into the paper, the text stays the ordinary
 * ink, and the pure hue is kept for the places where a small mark does the
 * identifying — the edge, the marker, the folder rail.
 *
 * The strengths are variables rather than constants because dark needs more of
 * the hue to read at all: 13% of blue over near-white paper is a visible tint,
 * and 13% over a near-black canvas is nothing.
 */
export function surfaceStyle(color: Color): React.CSSProperties {
  return {
    ["--accent" as string]: color.hex,
    backgroundColor: `color-mix(in srgb, ${color.hex} var(--tint), var(--paper))`,
    borderColor: `color-mix(in srgb, ${color.hex} var(--tint-edge), var(--rule))`,
    /*
     * Controls on a tinted card are ordinary ink on ordinary paper, because
     * the card is now near enough to paper that anything else would be wrong.
     * The names stay so the call sites do not all have to change; what they
     * mean has simply stopped being per-colour.
     */
    ["--on" as string]: "var(--ink)",
    ["--on-inv" as string]: "var(--paper)",
  };
}

/** A control on a coloured card. Same ink as everywhere else, now. */
export const ON_COLOR_BUTTON =
  "border-current/35 hover:bg-[var(--on)] hover:text-[var(--on-inv)]";

/** The same control, already active. */
export const ON_COLOR_ACTIVE = "bg-[var(--on)] text-[var(--on-inv)]";
