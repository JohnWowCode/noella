/**
 * Twelve worlds, unnamed. Every hex is chosen so #111 type clears 4.5:1 on it
 * (the darkest, #E85D5D, sits at 6.2:1) — contrast never flips, so cards stay
 * consistent and the palette stays honest.
 *
 * The first eight are the original set and stay in their original positions:
 * an existing wall already has worlds bound to those slots, and reordering
 * would move somebody's army world out from under its keyboard shortcut. The
 * four additions fill the real gaps in the wheel — amber between yellow and
 * orange, orchid between pink and violet, cyan between blue and teal, and a
 * true green, which the first eight never had.
 */
export const DEFAULT_SWATCHES = [
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
