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
 *
 * Most of them are not decoration. They are the *reasons* — bug, money, art,
 * admin — and a note wears as many as apply, so the marks are also the tags
 * and the filters. stickers.ts says which are reasons and what each is called;
 * this file only knows how to draw them.
 */

interface Mark {
  /** Stroked outline. The default. */
  d?: string;
  /** Solid, for marks that read better as a shape than an outline. */
  fill?: string;
}

const MARKS: Record<string, Mark> = {
  // -------------------------------------------------------------- making it
  idea: { d: "M12 3a6 6 0 00-3.5 10.9V17h7v-3.1A6 6 0 0012 3zM9.5 20h5" },
  write: { d: "M3 21l1-5L16 4l4 4L8 20zM14.5 5.5l4 4" },
  art: { d: "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M8 8v.01" },
  sound: { d: "M3 14v-4M8 19V5M13 17V7M18 15v-6M22 13.5v-3" },
  build: { d: "M12 3 21 8v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9" },
  // A d-pad, not a controller: at 15px in a card's meta row the body of a
  // controller collapses into a rounded rectangle that could be anything,
  // where a cross stays a cross all the way down.
  game: { d: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" },

  // ------------------------------------------------------------- fixing it
  bug: {
    d: "M9 8a3 3 0 016 0M7 11h10v4a5 5 0 01-10 0zM7 13H3M17 13h4M8 8 6 5M16 8l2-3M7 18l-3 3M17 18l3 3",
  },
  fix: {
    d: "M15 3a5 5 0 00-5.9 6.6L3 15.7 5.3 18l6.1-6.1A5 5 0 0018 6l-3 3-2-2z",
  },
  test: {
    d: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5v1",
  },
  ship: {
    d: "M12 2c4 3 6 7 6 12l-3 3H9l-3-3c0-5 2-9 6-12zM12 9v3M9 20l-2 2M15 20l2 2",
  },
  blocked: { d: "M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8" },
  danger: { d: "M12 3 22 21H2zM12 10v5M12 18v.01" },

  // -------------------------------------------------------------- living it
  money: { d: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 10h5M9.5 14h5" },
  buy: { d: "M5 8h14l-1 13H6zM9 8V5a3 3 0 016 0v3" },
  admin: { d: "M6 3h12v18H6zM9 3h6v3H9zM9.5 11h5M9.5 15h5" },
  home: { d: "M3 11 12 3l9 8v10H3zM10 21v-6h4v6" },
  health: { d: "M2 12h4l2-5 4 10 2-5h8" },
  travel: { d: "M2 13 22 4l-5 17-4-6-6-1z" },

  // ------------------------------------------------------- people and world
  read: {
    d: "M3 4h7a2 2 0 012 2v14a2 2 0 00-2-2H3zM21 4h-7a2 2 0 00-2 2v14a2 2 0 012-2h7z",
  },
  watch: {
    d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
  },
  people: {
    d: "M9 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2 21a7 7 0 0114 0M17 5a3 3 0 010 6M17 15a5 5 0 015 6",
  },
  place: {
    d: "M12 3a6 6 0 00-6 6c0 4.5 6 12 6 12s6-7.5 6-12a6 6 0 00-6-6zM12 7.5a2 2 0 100 4 2 2 0 000-4z",
  },
  love: { fill: "M12 21 3.9 12.9A5 5 0 0111 5.6l1 1 1-1a5 5 0 017.1 7.3z" },
  ask: {
    d: "M12 3a9 9 0 100 18 9 9 0 000-18zM9.2 9.3A3 3 0 0115 10c0 2-3 2.2-3 4M12 17.5v.01",
  },

  // ------------------------------------------------------------------ chrome
  star: {
    d: "M12 3l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.3 6.2 20.8l1.6-6.6L2.6 9.8l6.8-.5z",
  },
  starFilled: {
    fill: "M12 3l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.3 6.2 20.8l1.6-6.6L2.6 9.8l6.8-.5z",
  },
  spark: { fill: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" },
  tag: { d: "M3.5 3.5h8L21 13l-8 8-9.5-9.5zM7.5 7.5v.01" },
  flag: { d: "M6 21V4M6 4h12l-2.5 4L18 12H6" },
  check: { d: "M4 12.5 9.5 18 20 6" },
  plus: { d: "M12 4v16M4 12h16" },
  more: { d: "M5 12h.01M12 12h.01M19 12h.01" },
  grid: { d: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
  play: { fill: "M6 3l14 9-14 9z" },
  chevron: { d: "M9 4l8 8-8 8" },
  ring: { d: "M12 3a9 9 0 100 18 9 9 0 000-18z" },
  clip: {
    d: "M20 11.5 12 19.5a5 5 0 01-7-7l8-8a3.5 3.5 0 015 5l-8 8a2 2 0 01-3-3l7.5-7.5",
  },
  swatches: { d: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17.5 14v7M14 17.5h7" },
};

export type IconName = keyof typeof MARKS;

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
      /*
       * Heavier than it was.
       *
       * These sit at 15 and 16 pixels in a card's meta row, next to 12px
       * uppercase mono and 18px serif — both of which put down more ink than a
       * two-unit hairline. At that size the marks read as faint suggestions
       * rather than as the labels they now are, so the stroke goes up and
       * scales harder as the mark gets smaller.
       */
      strokeWidth={mark.d ? (size < 14 ? 3 : size < 18 ? 2.7 : 2.3) : 0}
      stroke={mark.d ? "currentColor" : "none"}
      fill={mark.fill ? "currentColor" : "none"}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d={mark.d ?? mark.fill} />
    </svg>
  );
}
