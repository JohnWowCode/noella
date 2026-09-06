/**
 * The marks, and what they mean.
 *
 * These were stickers: one per note, chosen for fun, sorting nothing. That was
 * a waste of the best scanning surface on the card. A wall of forty titles has
 * to be read; a wall of forty marks is recognised — and a mark that *means*
 * something ("bug", "money", "admin") is doing the same job a tag does, only
 * without having to be typed, spelled consistently, or read at all.
 *
 * So they are the same thing now. A note wears as many marks as apply, the
 * marks filter and group the wall exactly like folders and ranks do, and
 * "#bug" being the fourth word of a sentence stops being the only way the app
 * knows a note is about a bug.
 *
 * Naming is deliberately plain and second-person-neutral — Bug, Money, Admin —
 * because a mark you have to translate is a mark you will not use.
 */

import { isIconName, type IconName } from "@/components/Icon";

export interface MarkGroup {
  name: string;
  icons: IconName[];
}

/**
 * What a mark is called, in one word wherever one will do.
 *
 * The label is not decoration: it is the chip in the filter rail, the band
 * heading when you group by mark, the tooltip in the picker and the word the
 * MCP tools take. One name, used in all four places.
 */
export const MARK_LABEL: Record<string, string> = {
  idea: "Idea",
  write: "Writing",
  art: "Art",
  sound: "Audio",
  build: "Build",
  game: "Game",

  bug: "Bug",
  fix: "Fix",
  test: "Test",
  ship: "Ship",
  blocked: "Blocked",
  danger: "Risk",

  money: "Money",
  buy: "Buy",
  admin: "Admin",
  home: "Home",
  health: "Health",
  travel: "Travel",

  read: "Read",
  watch: "Watch",
  people: "People",
  place: "Place",
  love: "Love",
  ask: "Ask",
};

/**
 * Four rows of six, grouped by why you would reach for them.
 *
 * The old grouping was by drawing — "Making", "Weather" — which is a taxonomy
 * of shapes, not of reasons, and left you hunting for the one that meant
 * "bill". These are the four things a wall is actually full of.
 *
 * This list is also the order everything else uses: the picker, the filter
 * rail, and the bands when you group by mark. The rest of the marks Icon.tsx
 * can draw — the star, the tick, the chevron — are chrome and deliberately
 * absent, because they are things the app says, not things you mean.
 */
export const MARK_GROUPS: MarkGroup[] = [
  { name: "Making", icons: ["idea", "write", "art", "sound", "build", "game"] },
  {
    name: "Fixing",
    icons: ["bug", "fix", "test", "ship", "blocked", "danger"],
  },
  {
    name: "Life",
    icons: ["money", "buy", "admin", "home", "health", "travel"],
  },
  {
    name: "People & places",
    icons: ["read", "watch", "people", "place", "love", "ask"],
  },
];

export const ALL_MARKS: IconName[] = MARK_GROUPS.flatMap((g) => g.icons);

export function markLabel(name: string): string {
  return MARK_LABEL[name] ?? name;
}

/**
 * What the old stickers become.
 *
 * Two generations to read across: notes filed when a sticker was an emoji
 * codepoint, and notes filed when it was one abstract shape. Both are mapped
 * to the nearest mark that means something, so nothing has to be re-tagged by
 * hand; anything unrecognised is simply dropped rather than shown as a shape
 * with an invented meaning.
 */
const LEGACY: Record<string, IconName> = {
  // The emoji era.
  "🎮": "game",
  "🕹️": "game",
  "🕹": "game",
  "🧩": "game",
  "🎬": "watch",
  "📷": "art",
  "🎨": "art",
  "🎵": "sound",
  "✏️": "write",
  "✏": "write",
  "🛠️": "fix",
  "🛠": "fix",
  "⚙️": "fix",
  "⚙": "fix",
  "🐛": "bug",
  "🔥": "danger",
  "💥": "danger",
  "🧨": "danger",
  "⚠️": "danger",
  "⚠": "danger",
  "🚧": "blocked",
  "🩹": "fix",
  "❓": "ask",
  "💸": "money",
  "🏠": "home",
  "📦": "buy",
  "🎁": "buy",
  "🍜": "health",
  "🩺": "health",
  "🚗": "travel",
  "✈️": "travel",
  "✈": "travel",
  "⭐": "love",
  "💡": "idea",
  "🚀": "ship",
  "🌱": "idea",
  "🧠": "idea",
  "❤️": "love",
  "❤": "love",
  "☕": "health",
  "🌙": "home",
  "🎯": "test",
  "🏁": "ship",
  "📖": "read",
  "📚": "read",

  // The one-abstract-shape era, which lasted two commits.
  cube: "build",
  frame: "art",
  film: "watch",
  wave: "sound",
  pen: "write",
  sliders: "fix",
  bolt: "bug",
  burst: "danger",
  warn: "danger",
  cross: "blocked",
  eye: "watch",
  shield: "health",
  coin: "money",
  house: "home",
  box: "buy",
  heart: "love",
  clock: "travel",
  key: "admin",
  target: "test",
  seed: "idea",
  moon: "home",
  ring: "idea",
};

/** One stored value read into a mark this build can draw, or null. */
export function markOf(stored: string | null | undefined): IconName | null {
  if (!stored) return null;
  if (isIconName(stored) && stored !== "ring") return stored;
  return LEGACY[stored] ?? null;
}

/**
 * Every mark on a note, in the order they were put there.
 *
 * Reads the array a note carries now and the single `icon` a note carried
 * before it, so an old wall opens with its stickers intact and picks up a
 * second mark the moment you add one.
 */
export function marksOf(note: {
  icons?: string[] | null;
  icon?: string | null;
}): IconName[] {
  const raw =
    note.icons && note.icons.length > 0
      ? note.icons
      : note.icon
        ? [note.icon]
        : [];
  const out: IconName[] = [];
  for (const value of raw) {
    const mark = markOf(value);
    if (mark && !out.includes(mark)) out.push(mark);
  }
  return out;
}

/**
 * How many a note may wear.
 *
 * Mixing marks is the point — a bug in a game you have to ship is three of
 * them — but a card carrying nine is a card you scan slower than its text,
 * which is the exact failure this is meant to fix.
 */
export const MAX_MARKS = 4;

/** Toggle one mark on a set, respecting the cap. Returns a new array. */
export function toggleMark(current: string[], mark: IconName): IconName[] {
  const marks = marksOf({ icons: current });
  if (marks.includes(mark)) return marks.filter((m) => m !== mark);
  return [...marks, mark].slice(-MAX_MARKS);
}
