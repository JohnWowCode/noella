/**
 * Projects. A project is a note you promoted, and a step is a note whose
 * parentId points at it — so an idea becomes a project without being copied
 * into some other system, and steps stay searchable notes like everything else.
 */

import { byOrder } from "./order";
import type { Note } from "./types";

export const PROJECT_STATUSES = ["idea", "active", "paused", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Order the projects screen and Today read in: what you're doing comes first. */
const STATUS_RANK: Record<ProjectStatus, number> = {
  active: 0,
  idea: 1,
  paused: 2,
  done: 3,
};

export function isProject(note: Note): boolean {
  return note.projectStatus !== null;
}

export function isList(note: Note): boolean {
  return note.isList;
}

/**
 * Lists, newest first. Deliberately not part of projectsOf: a list must never
 * reach Today, be counted against the active limit, or be asked whether you
 * still want it. Long lists overwhelm when they are presented as a demand —
 * so a list is storage, and the front door stays one thing.
 */
export function listsOf(notes: Note[]): Note[] {
  return notes
    .filter((n) => n.isList && n.archivedAt === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isStep(note: Note): boolean {
  return note.parentId !== null;
}

/** Steps in the order you put them in; added order until you rank them. */
export function stepsOf(notes: Note[], projectId: string): Note[] {
  return byOrder(
    notes.filter((n) => n.parentId === projectId && n.archivedAt === null),
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  );
}

export function progressOf(steps: Note[]): { done: number; total: number } {
  return {
    done: steps.filter((s) => s.doneAt !== null).length,
    total: steps.length,
  };
}

/**
 * The first unfinished step. This is the answer to "how do I execute this" —
 * a project list without it is a graveyard rather than a plan.
 */
export function nextActionOf(steps: Note[]): Note | null {
  return steps.find((s) => s.doneAt === null) ?? null;
}

/**
 * Projects by status, then by hand-set priority within each status. The first
 * active project is the one today is about, so this ordering is load-bearing.
 */
export function projectsOf(notes: Note[]): Note[] {
  return notes
    .filter((n) => isProject(n) && n.archivedAt === null)
    .sort(
      (a, b) =>
        STATUS_RANK[a.projectStatus as ProjectStatus] -
          STATUS_RANK[b.projectStatus as ProjectStatus] ||
        a.order - b.order ||
        Number(b.pinned) - Number(a.pinned) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/**
 * Anything jotted and not yet filed: no world, not a project, not a step, not
 * a bill. This is what makes dumping a thought safe — it lands somewhere with
 * a name instead of dissolving into the feed.
 */
export function unfiled(notes: Note[]): Note[] {
  return notes.filter(
    (n) =>
      n.archivedAt === null &&
      n.colorId === null &&
      n.projectStatus === null &&
      n.parentId === null &&
      !n.isList,
  );
}

/** First line of the body, which is all a project needs for a name. */
export function projectTitle(note: Note): string {
  const line = note.body.split("\n", 1)[0]?.trim() ?? "";
  return line || `Note ${note.seq}`;
}
