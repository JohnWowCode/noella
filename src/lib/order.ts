/**
 * Manual priority.
 *
 * Everything else in the app sorts itself — by date, by status, by urgency.
 * That is fine for a feed and useless for deciding what to do first, because
 * only you know that. So projects and steps carry a hand-set position, and
 * position 1 among the active projects *is* today's move. Re-ranking and
 * choosing what to work on are the same gesture rather than two settings that
 * can disagree.
 */

import type { Note } from "./types";

/** Sort by hand-set position, falling back to the given tiebreak. */
export function byOrder(
  notes: Note[],
  tiebreak: (a: Note, b: Note) => number,
): Note[] {
  return [...notes].sort((a, b) => a.order - b.order || tiebreak(a, b));
}

export interface OrderPatch {
  id: string;
  order: number;
}

/**
 * Move one item up or down within its list.
 *
 * Positions are renumbered from the list's current order every time rather
 * than trusting whatever is stored: a wall that predates ranking has every
 * position at zero, and this makes the first drag do the right thing anyway.
 */
export function reorder(
  sorted: Note[],
  id: string,
  delta: -1 | 1,
): OrderPatch[] {
  const from = sorted.findIndex((n) => n.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= sorted.length) return [];

  const next = [...sorted];
  [next[from], next[to]] = [next[to], next[from]];

  // Only the rows whose number actually changes get written.
  return next
    .map((n, i) => ({ id: n.id, order: i }))
    .filter((p, i) => sorted[i].id !== p.id || sorted[i].order !== p.order);
}
