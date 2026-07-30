/**
 * Projects. A project is a note you promoted, and a step is a note whose
 * parentId points at it — so an idea becomes a project without being copied
 * into some other system, and steps stay searchable notes like everything else.
 */

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

export function isStep(note: Note): boolean {
  return note.parentId !== null;
}

/** Steps in the order they were added — that is the order you meant to do them. */
export function stepsOf(notes: Note[], projectId: string): Note[] {
  return notes
    .filter((n) => n.parentId === projectId && n.archivedAt === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

export function projectsOf(notes: Note[]): Note[] {
  return notes
    .filter((n) => isProject(n) && n.archivedAt === null)
    .sort(
      (a, b) =>
        STATUS_RANK[a.projectStatus as ProjectStatus] -
          STATUS_RANK[b.projectStatus as ProjectStatus] ||
        Number(b.pinned) - Number(a.pinned) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/** First line of the body, which is all a project needs for a name. */
export function projectTitle(note: Note): string {
  const line = note.body.split("\n", 1)[0]?.trim() ?? "";
  return line || `Note ${note.seq}`;
}
