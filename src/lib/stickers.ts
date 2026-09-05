/**
 * A sticker on a note.
 *
 * Reading forty card titles to find the one about audio is work; spotting the
 * speaker among forty glyphs is not. That difference is most of why this
 * exists — a wall you can scan by shape stays usable at a size where a wall of
 * text has already become a wall.
 *
 * The set is curated rather than a full emoji keyboard on purpose. Two
 * thousand choices is a browsing session; forty is a decision. Anything else
 * can still be pasted in by hand.
 */

export interface StickerGroup {
  name: string;
  icons: string[];
}

export const STICKERS: StickerGroup[] = [
  {
    name: "Making",
    icons: ["🎮", "🕹️", "🎬", "🎨", "🎵", "📷", "✏️", "🧩", "🛠️", "⚙️"],
  },
  {
    name: "Going wrong",
    icons: ["🐛", "🔥", "💥", "⚠️", "🧨", "🩹", "🚧", "❓"],
  },
  {
    name: "Life",
    icons: ["💸", "🏠", "🍜", "🩺", "📦", "🚗", "✈️", "🎁"],
  },
  {
    name: "Weather",
    icons: ["⭐", "💡", "🚀", "🌱", "🧠", "❤️", "☕", "🌙", "🎯", "🏁"],
  },
];

export const ALL_STICKERS = STICKERS.flatMap((g) => g.icons);

/**
 * Whether a string is small enough to sit in a sticker slot.
 *
 * Not a real emoji test — that is a losing fight against skin tones, joiners
 * and flags. The only thing that actually matters is that it is short, because
 * anything long breaks the layout it is pasted into.
 */
export function isSticker(value: string): boolean {
  return value.length > 0 && [...value].length <= 3;
}
