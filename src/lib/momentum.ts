/**
 * Momentum.
 *
 * The wall answers "what did I think?". Nothing in the app answered "am I
 * moving?", which is the question that actually decides whether a creative
 * with twelve open projects ships anything. These are the measures for it.
 *
 * A *move* is a finished step or task. Deliberately not "a note captured":
 * capture is easy and would make the number flattering and useless.
 */

import { dateKey, daysBetween, fromKey } from "./clock";
import { contentsOf } from "./rooms";
import type { Note } from "./types";

/** Days a project can sit untouched before it counts as drifting. */
export const DRIFT_DAYS = 14;

/** How many things you can seriously move at once. Not a guess — a stance. */
export const ACTIVE_LIMIT = 3;

export interface DayCell {
  key: string;
  moves: number;
}

/** One cell per day, oldest first, ending today. */
export function ledger(notes: Note[], todayKey: string, days = 56): DayCell[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    if (!n.doneAt) continue;
    const key = dateKey(new Date(n.doneAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const end = fromKey(todayKey);
  const cells: DayCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    cells.push({ key, moves: counts.get(key) ?? 0 });
  }
  return cells;
}

/**
 * The longest run in the window. Shown instead of a current streak that reads
 * zero: a counter that resets to nothing after one missed day punishes the
 * exact failure mode this is meant to help with, and a broken streak is a
 * common reason people abandon a system outright.
 */
export function bestRun(cells: DayCell[]): number {
  let best = 0;
  let run = 0;
  for (const c of cells) {
    run = c.moves > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Consecutive days with at least one move, counting back from today. */
export function streak(cells: DayCell[]): number {
  let n = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].moves === 0) {
      // Today not being done yet shouldn't read as a broken streak.
      if (i === cells.length - 1) continue;
      break;
    }
    n++;
  }
  return n;
}

export function movesThisWeek(cells: DayCell[]): number {
  return cells.slice(-7).reduce((n, c) => n + c.moves, 0);
}

/** The last day anything actually happened in this room. */
export function lastMovedKey(notes: Note[], room: Note): string {
  const stamps = [room.updatedAt];
  for (const item of contentsOf(notes, room.id)) {
    stamps.push(item.createdAt);
    if (item.doneAt) stamps.push(item.doneAt);
  }
  return dateKey(
    new Date(stamps.reduce((a, b) => (a > b ? a : b), room.createdAt)),
  );
}

export function quietDays(notes: Note[], room: Note, todayKey: string): number {
  return daysBetween(lastMovedKey(notes, room), todayKey);
}

/**
 * Rooms that have gone quiet. Surfacing these is the point: an open loop you
 * have silently stopped working on costs more than one you have killed.
 *
 * This used to ask which projects had stalled, which meant it only ever knew
 * about the handful of things you had gone to the trouble of promoting. A room
 * is anything holding unfinished work, so now it knows about all of them.
 */
export function drifting(notes: Note[], todayKey: string): Note[] {
  return notes
    .filter((n) => {
      if (n.archivedAt !== null) return false;
      // Deferred on purpose: "not now" is a legitimate answer, and the list is
      // only useful if it is answerable rather than permanent.
      if (n.snoozedUntil !== null && n.snoozedUntil > todayKey) return false;
      const items = contentsOf(notes, n.id);
      if (items.length === 0) return false;
      // A room where everything is ticked is finished, not drifting.
      if (items.every((i) => i.doneAt !== null || !i.isTask)) return false;
      return quietDays(notes, n, todayKey) >= DRIFT_DAYS;
    })
    .sort(
      (a, b) => quietDays(notes, b, todayKey) - quietDays(notes, a, todayKey),
    );
}

/**
 * How your estimates actually land.
 *
 * Duration estimates run short, reliably and by a lot, and no amount of being
 * told that fixes it. Being shown your own multiplier does: it turns "add 50%"
 * — advice for someone else — into a number you produced.
 */
export function estimateFactor(
  notes: Note[],
): { samples: number; factor: number } | null {
  const scored = notes.filter(
    (n) =>
      n.estimateMinutes !== null &&
      n.actualMinutes !== null &&
      n.estimateMinutes > 0,
  );
  if (scored.length < 3) return null;

  const factor =
    scored.reduce(
      (sum, n) =>
        sum + (n.actualMinutes as number) / (n.estimateMinutes as number),
      0,
    ) / scored.length;
  return { samples: scored.length, factor };
}

/** Rooms with nothing left open, newest first. The evidence it works. */
export function shipped(notes: Note[]): Note[] {
  return notes
    .filter((n) => {
      const items = contentsOf(notes, n.id);
      return (
        n.archivedAt === null &&
        items.length > 0 &&
        items.some((i) => i.isTask) &&
        items.every((i) => !i.isTask || i.doneAt !== null)
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
