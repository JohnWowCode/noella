/**
 * One swatch per colour, however many devices made one.
 *
 * Every device seeds its own palette with fresh random ids, so device A's
 * yellow and device B's yellow are the same colour wearing two different ids.
 * The merge keyed on id, unioned them, and handed back two of everything —
 * three devices, three palettes, a rail nobody could read.
 *
 * A colour *is* its hex. That is already how a stored wall is matched against
 * the defaults on load, and it is the only identity that means anything across
 * two machines that have never spoken. So duplicates are collapsed by hex and
 * the notes filed under the losers are moved to the winner, because a swatch
 * that quietly disappears takes a folder's worth of notes with it.
 */

import type { Color, Note } from "../types";

const key = (hex: string) => hex.trim().toUpperCase();

/**
 * Which of two copies survives.
 *
 * Named beats unnamed — somebody typed that. Beyond that it has to be a rule
 * both devices reach independently from the same set, or they would each keep
 * their own and undo each other forever: the smallest id wins, which is
 * arbitrary and, far more importantly, the same everywhere.
 */
function better(a: Color, b: Color): Color {
  const named = (c: Color) => (c.name !== null || c.emoji !== null ? 1 : 0);
  if (named(a) !== named(b)) return named(a) > named(b) ? a : b;
  return a.id <= b.id ? a : b;
}

export interface Deduped {
  colors: Color[];
  notes: Note[];
  /** How many swatches were folded away. Zero on a wall that never synced. */
  merged: number;
}

export function dedupeColors(colors: Color[], notes: Note[]): Deduped {
  const winners = new Map<string, Color>();
  for (const c of colors) {
    const at = key(c.hex);
    const held = winners.get(at);
    winners.set(at, held ? better(held, c) : c);
  }
  if (winners.size === colors.length) {
    return { colors, notes, merged: 0 };
  }

  const moves = new Map<string, string>();
  for (const c of colors) {
    const winner = winners.get(key(c.hex));
    if (winner && winner.id !== c.id) moves.set(c.id, winner.id);
  }

  /*
   * Positions are renumbered from the order the survivors were already in.
   * Keeping the stored numbers would leave gaps, and the position is what the
   * rail sorts by and what the keyboard shortcut counts.
   */
  const kept = [...winners.values()]
    .sort((a, b) => a.position - b.position)
    .map((c, i) => ({ ...c, position: i }));

  return {
    colors: kept,
    notes: notes.map((n) =>
      n.colorId && moves.has(n.colorId)
        ? { ...n, colorId: moves.get(n.colorId) as string }
        : n,
    ),
    merged: colors.length - kept.length,
  };
}

/**
 * Takes the withdrawn swatches off a wall, and only the ones it can.
 *
 * A wall stores its own copy of every default it has ever been seeded with,
 * so shortening the list of defaults does nothing to a device that already
 * ran — the palette only ever grows. Trimming it therefore has to be an
 * active removal, and an active removal of something a person is using would
 * be far worse than the crowding it is meant to fix.
 *
 * So two things protect a swatch, and either is enough: something is filed
 * under it, or somebody gave it a name or an emoji. A colour is a folder
 * here. Tidying away a folder with things in it, because the palette changed
 * its mind about which colours are too alike, is not tidying.
 */
export function retireColors(
  colors: Color[],
  notes: Note[],
  retired: readonly string[],
): { colors: Color[]; removed: number } {
  const going = new Set(retired.map(key));
  if (going.size === 0) return { colors, removed: 0 };

  const used = new Set(
    notes.map((n) => n.colorId).filter((id): id is string => id !== null),
  );

  const kept = colors.filter((c) => {
    if (!going.has(key(c.hex))) return true;
    if (c.name !== null || c.emoji !== null) return true;
    return used.has(c.id);
  });

  if (kept.length === colors.length) return { colors, removed: 0 };
  return {
    colors: kept.map((c, position) => ({ ...c, position })),
    removed: colors.length - kept.length,
  };
}
