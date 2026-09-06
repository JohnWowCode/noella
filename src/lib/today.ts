/**
 * Today: the part of the wall you have actually promised.
 *
 * Everything before this was capture and organisation, and Noella was good at
 * both — which is the trap. A wall that grows forever punishes you for using
 * it well: every note you add makes the screen worse, nothing on it says what
 * to do, and the only surface with an end to it is the one you never reach.
 *
 * So this is deliberately the one small, closed, finishable list in the app.
 * It is not a filter over everything, it is a promise about a day. It can be
 * emptied, which is the whole point: a screen you can finish is the only thing
 * that makes tomorrow's screen worth opening.
 *
 * It reuses `now` rather than inventing a seventh way to label a note. The
 * picker has always said "today, or it slips" — that *is* today, and there are
 * already enough dimensions (colour, marks, rank, favourite, task, container)
 * without a "Today" flag sitting beside a "Now" rank meaning the same thing.
 */

import { daysBetween } from "./clock";
import type { Note } from "./types";

export interface Today {
  /** Promised today and still open. The list you are working from. */
  open: Note[];
  /** Promised today and finished. Kept visible: a pile you can see growing. */
  done: Note[];
  /** Said "now" on an earlier day and never finished. */
  carried: Note[];
  /** Everything ticked today, wherever it came from. The honest number. */
  finished: Note[];
}

/**
 * Past this, a day is not a plan.
 *
 * Not enforced — refusing to accept a seventh thing would be the app telling
 * you what your day is. It only changes what the header says, because the
 * useful moment is being told, not being stopped.
 */
export const TOO_MANY = 5;

export function todayOf(notes: Note[], key: string): Today {
  const open: Note[] = [];
  const done: Note[] = [];
  const carried: Note[] = [];
  const finished: Note[] = [];

  for (const n of notes) {
    if (n.archivedAt !== null) continue;
    if (n.doneAt !== null && n.doneAt.slice(0, 10) === key) finished.push(n);
    if (n.priority !== "now") continue;
    // A note ranked before the date existed reads as today's rather than
    // as infinitely old, which would open the app with a false accusation.
    const on = n.rankedOn ?? key;
    if (n.doneAt !== null) {
      if (on === key) done.push(n);
    } else if (on === key) {
      open.push(n);
    } else {
      carried.push(n);
    }
  }

  const oldestFirst = (a: Note, b: Note) =>
    (a.rankedOn ?? "").localeCompare(b.rankedOn ?? "");
  carried.sort(oldestFirst);
  return { open, done, carried, finished };
}

/** How long something has been sitting on today. Zero when it is today's. */
export function ageOf(note: Note, key: string): number {
  if (!note.rankedOn) return 0;
  return Math.max(0, daysBetween(note.rankedOn, key));
}
