/**
 * The jester's hat: everything open, and how much each one wants picking.
 *
 * A priority list you wrote yourself is a list you can argue with, and the
 * argument is usually how an afternoon disappears. Weighted chance takes the
 * decision away without taking the ranking away — the top of your list comes
 * up most, but not always, so the thing sitting at rank nine for a fortnight
 * still gets its turn.
 */

import { isList, isProject, projectTitle, stepsOf } from "./projects";
import { isSettled } from "./recurrence";
import type { Note } from "./types";

export interface Candidate {
  note: Note;
  /** Where it came from, in words, so the pick can explain itself. */
  from: string;
  weight: number;
}

/** How much each kind of open thing wants to be chosen. */
const WEIGHTS = {
  /** The next step of the project you ranked first. */
  todaysStep: 12,
  /** The next step of any other active project. */
  activeStep: 7,
  /** A later step of an active project. */
  laterStep: 2,
  /** A loose to-do with no project behind it. */
  looseTask: 5,
  /** An item on a recurring list that has not come round yet this period. */
  recurring: 4,
  /** A step of a project you have parked or only had an idea about. */
  quietStep: 1,
} as const;

export function candidates(notes: Note[], today: Date): Candidate[] {
  const out: Candidate[] = [];
  const live = notes.filter((n) => n.archivedAt === null);

  const active = live
    .filter((n) => n.projectStatus === "active")
    .sort((a, b) => a.order - b.order);

  for (const project of live.filter(isProject)) {
    const steps = stepsOf(notes, project.id).filter((s) => s.doneAt === null);
    const rank = active.indexOf(project);
    steps.forEach((step, i) => {
      const weight =
        rank === -1
          ? WEIGHTS.quietStep
          : i > 0
            ? WEIGHTS.laterStep
            : rank === 0
              ? WEIGHTS.todaysStep
              : WEIGHTS.activeStep;
      out.push({ note: step, from: projectTitle(project), weight });
    });
  }

  for (const list of live.filter(isList)) {
    const items = live.filter((n) => n.parentId === list.id);
    for (const item of items) {
      if (isSettled(item, list.listCadence, today)) continue;
      // A plain list is storage, not a demand; only a recurring one is asking.
      if (list.listCadence === null) continue;
      out.push({
        note: item,
        from: projectTitle(list),
        weight: WEIGHTS.recurring,
      });
    }
  }

  for (const note of live) {
    if (!note.isTask || note.doneAt !== null) continue;
    if (note.parentId !== null || isProject(note) || isList(note)) continue;
    out.push({ note, from: "on its own", weight: WEIGHTS.looseTask });
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
