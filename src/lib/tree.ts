/**
 * Anything can hold anything.
 *
 * The old model allowed exactly one level: a project held steps, and a step
 * held nothing. That is fine for "buy milk" and hopeless for real work —
 * WowCool.World holds Cave Sniper holds a bug with three screenshots is three
 * levels, and there was no way to say it. So `parentId` is a real tree now,
 * and "project" and "list" are flavours a container can have rather than the
 * only things allowed to contain.
 *
 * Everything here is a plain function over the flat note array. There is no
 * separate tree structure to keep in step with the notes, because the moment
 * there are two representations one of them is wrong.
 */

import { byOrder } from "./order";
import type { Note } from "./types";

/** Direct children, in the order you put them in. Archived ones stay hidden. */
export function childrenOf(notes: Note[], parentId: string): Note[] {
  return byOrder(
    notes.filter((n) => n.parentId === parentId && n.archivedAt === null),
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  );
}

/** Everything underneath, at any depth. Archived included: deletion needs them. */
export function descendantsOf(notes: Note[], id: string): Note[] {
  const byParent = new Map<string, Note[]>();
  for (const n of notes) {
    if (n.parentId === null) continue;
    const list = byParent.get(n.parentId);
    if (list) list.push(n);
    else byParent.set(n.parentId, [n]);
  }

  const out: Note[] = [];
  const queue = [id];
  const seen = new Set<string>([id]);
  while (queue.length > 0) {
    for (const child of byParent.get(queue.shift() as string) ?? []) {
      // A cycle would spin here forever; a bad import is enough to make one.
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

/**
 * The chain from the top down to this note, not including the note itself.
 * This is the breadcrumb: [WowCool.World, Cave Sniper] for a bug inside both.
 */
export function pathTo(notes: Note[], id: string): Note[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const chain: Note[] = [];
  const seen = new Set<string>();
  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) break;
    chain.unshift(parent);
    current = parent.parentId;
  }
  return chain;
}

/** How many live things are inside, at any depth. What a card reports. */
export function countInside(notes: Note[], id: string): number {
  return descendantsOf(notes, id).filter((n) => n.archivedAt === null).length;
}

/** Direct children only, which is what "3 inside" should mean on a card. */
export function countChildren(notes: Note[], id: string): number {
  return notes.filter((n) => n.parentId === id && n.archivedAt === null).length;
}

/**
 * Whether moving `id` under `target` would make a loop.
 *
 * Filing a folder inside its own descendant detaches that whole branch from
 * the wall — it still exists, but nothing reaches it and every walk over it
 * spins. Cheaper to refuse.
 */
export function wouldCycle(notes: Note[], id: string, target: string): boolean {
  if (id === target) return true;
  return descendantsOf(notes, id).some((n) => n.id === target);
}

/**
 * Anywhere a note could be filed: every live note except itself and its own
 * descendants. Deliberately not restricted to projects — the whole point is
 * that a plain note can hold things the moment you need it to.
 */
export function placesFor(notes: Note[], id: string): Note[] {
  const banned = new Set([id, ...descendantsOf(notes, id).map((n) => n.id)]);
  return notes.filter((n) => n.archivedAt === null && !banned.has(n.id));
}

/** Ticked children over total, at one level. What a progress bar reads from. */
export function progressOf(children: Note[]): { done: number; total: number } {
  const countable = children.filter((c) => c.isTask);
  return {
    done: countable.filter((c) => c.doneAt !== null).length,
    total: countable.length,
  };
}
