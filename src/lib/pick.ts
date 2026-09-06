/**
 * The jester's hat: everything open, and how much each one wants picking.
 *
 * A priority list you wrote yourself is a list you can argue with, and the
 * argument is usually how an afternoon disappears. Weighted chance takes the
 * decision away without taking the ranking away — HPrio comes up six times as
 * often as LPrio, but not always, so the thing sitting at the bottom for a
 * fortnight still gets its turn.
 */

import { contentsOf, titleOf } from "./rooms";
import { isSettled } from "./recurrence";
import type { Note } from "./types";

export interface Candidate {
  note: Note;
  /** Where it came from, in words, so the pick can explain itself. */
  from: string;
  weight: number;
}

/**
 * How much each open thing wants to be chosen.
 *
 * Weight used to be read off a project's status — first step of the top active
 * project, then other active ones, then parked ones — which meant the hat only
 * ever contained things you had gone to the trouble of promoting. There are no
 * projects any more, so it is read off the two things every note has: how much
 * it matters, and whether anything is waiting behind it.
 */
const WEIGHTS = {
  high: 12,
  mid: 6,
  low: 2,
  /** Unranked. Middling on purpose: never triaged is not the same as unimportant. */
  unranked: 4,
} as const;

/** The first unfinished thing in a room wants doing more than the fifth. */
const FIRST_IN_ROOM = 1.6;

export function candidates(notes: Note[], today: Date): Candidate[] {
  const out: Candidate[] = [];
  const live = notes.filter((n) => n.archivedAt === null);
  const byId = new Map(live.map((n) => [n.id, n]));
  const seenRoom = new Set<string>();

  for (const note of live) {
    if (note.doneAt !== null) continue;
    // A room is a place, not a job: what you do is the thing inside it.
    if (contentsOf(notes, note.id).length > 0) continue;

    const room = note.parentId ? byId.get(note.parentId) : null;
    if (room && isSettled(note, room.repeats, today)) continue;

    let weight = note.priority
      ? WEIGHTS[note.priority]
      : note.isTask
        ? WEIGHTS.unranked
        : WEIGHTS.low;

    if (room && !seenRoom.has(room.id)) {
      seenRoom.add(room.id);
      weight *= FIRST_IN_ROOM;
    }

    out.push({
      note,
      from: room ? titleOf(room) : "",
      weight,
    });
  }

  return out;
}

/**
 * One candidate, chosen by weight.
 *
 * `roll` is passed in rather than taken from Math.random so this stays a pure
 * function — the component calls it from a click handler with a fresh roll,
 * and a test can hand it a fixed one.
 */
export function pick(pool: Candidate[], roll: number): Candidate | null {
  if (pool.length === 0) return null;
  const total = pool.reduce((n, c) => n + c.weight, 0);
  let cursor = roll * total;
  for (const c of pool) {
    cursor -= c.weight;
    if (cursor <= 0) return c;
  }
  return pool[pool.length - 1];
}
