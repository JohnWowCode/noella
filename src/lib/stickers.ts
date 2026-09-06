/**
 * A sticker on a note.
 *
 * Reading forty card titles to find the one about audio is work; spotting the
 * one mark among forty shapes is not, and that difference is most of why this
 * exists — a wall you can scan by shape stays usable at a size where a wall of
 * text has already become a wall.
 *
 * They were emoji until now. Emoji are somebody else's drawings in somebody
 * else's palette, render differently on every platform, and vanish entirely
 * where no emoji font is installed. These are drawn — see Icon.tsx — so a
 * sticker is one geometry with the rest of the app and takes the ink of
 * whatever card it lands on.
 */

import { STICKER_NAMES, isIconName, type IconName } from "@/components/Icon";

export interface StickerGroup {
  name: string;
  icons: IconName[];
}

/** Four rows of six. Grouped so the picker is scanned rather than read. */
export const STICKERS: StickerGroup[] = [
  { name: "Making", icons: STICKER_NAMES.slice(0, 6) },
  { name: "Going wrong", icons: STICKER_NAMES.slice(6, 12) },
  { name: "Life", icons: STICKER_NAMES.slice(12, 18) },
  { name: "Weather", icons: STICKER_NAMES.slice(18, 24) },
];

export const ALL_STICKERS = STICKER_NAMES;

/**
 * What the emoji stickers become.
 *
 * Anything filed before this is a codepoint, not a name. Rather than leaving
 * those notes with a glyph the app can no longer draw, each is read across to
 * the nearest mark; anything unlisted falls back to a plain ring, which says
 * "this had a sticker" without inventing a meaning for it.
 */
const LEGACY: Record<string, IconName> = {
  "🎮": "cube", "🕹️": "cube", "🕹": "cube", "🧩": "cube",
  "🎬": "film", "📷": "frame", "🎨": "frame", "🎵": "wave",
  "✏️": "pen", "✏": "pen", "🛠️": "sliders", "🛠": "sliders", "⚙️": "sliders", "⚙": "sliders",
  "🐛": "bolt", "🔥": "bolt", "💥": "burst", "🧨": "burst",
  "⚠️": "warn", "⚠": "warn", "🚧": "warn", "🩹": "shield", "❓": "eye",
  "💸": "coin", "🏠": "house", "📦": "box", "🎁": "box",
  "🍜": "heart", "🩺": "shield", "🚗": "clock", "✈️": "clock", "✈": "clock",
  "⭐": "spark", "💡": "spark", "🚀": "bolt", "🌱": "seed",
  "🧠": "eye", "❤️": "heart", "❤": "heart", "☕": "clock",
  "🌙": "moon", "🎯": "target", "🏁": "flag",
};

/**
 * Reads whatever is stored on a note into a mark this build can draw.
 * Returns null when the field is empty, so a note without one stays without.
 */
export function stickerOf(stored: string | null): IconName | null {
  if (!stored) return null;
  if (isIconName(stored)) return stored;
  return LEGACY[stored] ?? "ring";
}
