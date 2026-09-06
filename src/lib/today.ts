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
 * It is its own mark rather than a value of the priority field. Those were
 * welded together — "now" meant both "today" and "most important" — which
 * made it impossible to say "this is the most important thing I have and I am
 * not doing it today", which is true of nearly everything important.
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
    if (n.todayOn === null) continue;
    const on = n.todayOn;
    if (n.doneAt !== null) {
      if (on === key) done.push(n);
    } else if (on === key) {
      open.push(n);
    } else {
      carried.push(n);
    }
  }

  const oldestFirst = (a: Note, b: Note) =>
    (a.todayOn ?? "").localeCompare(b.todayOn ?? "");
  carried.sort(oldestFirst);
  return { open, done, carried, finished };
}

/** How long something has been sitting on today. Zero when it is today's. */
export function ageOf(note: Note, key: string): number {
  if (!note.todayOn) return 0;
  return Math.max(0, daysBetween(note.todayOn, key));
}
