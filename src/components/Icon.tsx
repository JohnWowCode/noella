/**
 * Every mark in the app, drawn.
 *
 * Noella was paper, monospaced chrome and colour emoji: three visual languages
 * borrowed from three places, and the emoji were the only part not under the
 * app's control. They render differently on every platform, arrive in someone
 * else's palette, and turn into a tofu box wherever no emoji font is installed
 * — which is exactly what happened to the attach button.
 *
 * These are one geometry: a 24-unit grid, two-unit strokes, square caps and
 * mitred joins, in `currentColor`. They sit on a coloured card in that card's
 * ink, scale to any size, and look like they were made by the same hand as
 * the rest of it.
 */

interface Mark {
  /** Stroked outline. The default. */
  d?: string;
  /** Solid, for marks that read better as a shape than an outline. */
  fill?: string;
}

const MARKS: Record<string, Mark> = {
  // ---------------------------------------------------------------- making
  cube: { d: "M12 3 21 8v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9" },
  frame: { d: "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6" },
  film: { d: "M3 4h18v16H3zM7 4v16M17 4v16M3 12h4M17 12h4" },
  wave: { d: "M3 14v-4M8 19V5M13 17V7M18 15v-6M22 13v-2" },
  pen: { d: "M3 21l1-5L16 4l4 4L8 20zM15 5l4 4" },
  sliders: { d: "M3 7h18M3 17h18M9 4v6M16 14v6" },

  // --------------------------------------------------------------- trouble
  bolt: { fill: "M13 2 4 14h6l-1 8 9-12h-6z" },
  burst: { d: "M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" },
  warn: { d: "M12 3 22 21H2zM12 10v5M12 18v1" },
  cross: { d: "M5 5l14 14M19 5 5 19" },
  eye: { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z" },
  shield: { d: "M12 2 21 6v7c0 5-4 8-9 9-5-1-9-4-9-9V6z" },

  // ------------------------------------------------------------------ life
  coin: { d: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9 10h6M9 14h6" },
  house: { d: "M3 11 12 3l9 8v10H3zM10 21v-6h4v6" },
  box: { d: "M3 7h18v14H3zM3 7l3-4h12l3 4M10 12h4" },
  heart: { fill: "M12 21S3 14.5 3 8.8A4.8 4.8 0 0112 6a4.8 4.8 0 019 2.8C21 14.5 12 21 12 21z" },
  clock: { d: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l4 3" },
  key: { d: "M9 9a4 4 0 100 8 4 4 0 000-8zM13 13h8M18 13v4M21 13v3" },

  // --------------------------------------------------------------- weather
  spark: { fill: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" },
  target: { d: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11v2" },
  seed: { d: "M12 21v-8M12 13C12 8 8 5 3 5c0 5 4 8 9 8zM12 13c0-4 3-7 8-7 0 4-3 7-8 7z" },
  moon: { d: "M20 14A9 9 0 1110 4a7 7 0 0010 10z" },
  flag: { d: "M5 21V3M5 4h13l-3 4 3 4H5" },
  ring: { d: "M12 3a9 9 0 100 18 9 9 0 000-18z" },

  // ------------------------------------------------------------------ chrome
  star: { d: "M12 3l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.3 6.2 20.8l1.6-6.6L2.6 9.8l6.8-.5z" },
  starFilled: {
    fill: "M12 3l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.3 6.2 20.8l1.6-6.6L2.6 9.8l6.8-.5z",
  },
  check: { d: "M4 12.5 9.5 18 20 6" },
  plus: { d: "M12 4v16M4 12h16" },
  more: { d: "M5 12h.01M12 12h.01M19 12h.01" },
  grid: { d: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
  play: { fill: "M6 3l14 9-14 9z" },
  chevron: { d: "M9 4l8 8-8 8" },
};

export type IconName = keyof typeof MARKS;

/** The names offered as stickers, in the order the picker lays them out. */
export const STICKER_NAMES: IconName[] = [
  "cube", "frame", "film", "wave", "pen", "sliders",
  "bolt", "burst", "warn", "cross", "eye", "shield",
  "coin", "house", "box", "heart", "clock", "key",
  "spark", "target", "seed", "moon", "flag", "ring",
];

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(MARKS, value);
}

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const mark = MARKS[name];
  if (!mark) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={className}
      // Scaled so a 16px mark and a 34px one carry the same visual weight.
      strokeWidth={mark.d ? (size < 18 ? 2.4 : 2) : 0}
      stroke={mark.d ? "currentColor" : "none"}
      fill={mark.fill ? "currentColor" : "none"}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d={mark.d ?? mark.fill} />
    </svg>
  );
}
