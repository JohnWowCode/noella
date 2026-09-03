import { readableInk } from "./store/defaults";
import type { Color } from "./types";

/**
 * The two CSS variables every coloured surface exposes.
 *
 * Cards used to hardcode `color: #111` and buttons on them used
 * `hover:bg-[#111] hover:text-white`. That worked only because every swatch was
 * a mid-tone. With deep violet and deep red in the palette, black type on the
 * card is unreadable and a black hover fill is invisible — so the pair is
 * computed once, here, and everything on the card refers to it.
 *
 * `--on` is the legible ink for this colour; `--on-inv` is the colour itself,
 * which is what an inverted control fills its text with.
 */
export function surfaceStyle(color: Color): React.CSSProperties {
  const ink = readableInk(color.hex);
  return {
    backgroundColor: color.hex,
    color: ink,
    ["--on" as string]: ink,
    ["--on-inv" as string]: color.hex,
  };
}

/** A control on a coloured card: outlined, inverting to solid ink on hover. */
export const ON_COLOR_BUTTON =
  "border-current hover:bg-[var(--on)] hover:text-[var(--on-inv)]";

/** The same control, already active. */
export const ON_COLOR_ACTIVE = "bg-[var(--on)] text-[var(--on-inv)]";
