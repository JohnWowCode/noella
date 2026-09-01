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
import { isProject, stepsOf } from "./projects";
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

/** The last day anything actually happened on this project. */
export function lastMovedKey(notes: Note[], project: Note): string {
  const stamps = [project.updatedAt];
  for (const step of stepsOf(notes, project.id)) {
    stamps.push(step.createdAt);
    if (step.doneAt) stamps.push(step.doneAt);
  }
  return dateKey(
    new Date(stamps.reduce((a, b) => (a > b ? a : b), project.createdAt)),
  );
}

export function quietDays(
  notes: Note[],
  project: Note,
  todayKey: string,
): number {
  return daysBetween(lastMovedKey(notes, project), todayKey);
}

/**
 * Projects that have gone quiet. Surfacing these is the point: an open loop
 * you have silently stopped working on costs more than one you have killed.
 */
export function drifting(notes: Note[], todayKey: string): Note[] {
  return notes
    .filter(
      (n) =>
        isProject(n) &&
        n.archivedAt === null &&
        n.projectStatus !== "done" &&
        // Deferred on purpose: "not now" is a legitimate answer, and the list
        // is only useful if it is answerable rather than permanent.
        (n.snoozedUntil === null || n.snoozedUntil <= todayKey) &&
        quietDays(notes, n, todayKey) >= DRIFT_DAYS,
    )
    .sort((a, b) => quietDays(notes, b, todayKey) - quietDays(notes, a, todayKey));
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
      (sum, n) => sum + (n.actualMinutes as number) / (n.estimateMinutes as number),
      0,
    ) / scored.length;
  return { samples: scored.length, factor };
}

/** Projects finished, newest first. The evidence that any of this works. */
export function shipped(notes: Note[]): Note[] {
  return notes
    .filter((n) => isProject(n) && n.projectStatus === "done")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
