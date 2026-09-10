/**
 * The half of a life that is maintenance rather than work.
 *
 * Groceries sitting in the same queue as "vertical slice by the 20th" makes
 * both of them feel the same weight, and the usual result is that neither one
 * happens: the big thing is too big to start and the small thing is beneath
 * starting. They are not the same kind of thing and they should not share a
 * list. Nothing here is ranked, estimated or timed — you do not need to decide
 * how much the bins matter, you need to know it is Tuesday.
 *
 * No new field. The marks have had a group called Life since the day marks
 * existed — money, buy, admin, home, health, travel — and this is what it is
 * for. Being grown-up runs down the tree, so marking a Groceries room `buy`
 * once makes everything you throw into it grown-up without another thought.
 */

import { isSettled } from "./recurrence";
import { marksOf } from "./stickers";
import { pathTo } from "./tree";
import type { Note } from "./types";
import type { IconName } from "@/components/Icon";

export const LIFE_MARKS: IconName[] = [
  "money",
  "buy",
  "admin",
  "home",
  "health",
  "travel",
];

const LIFE = new Set<string>(LIFE_MARKS);

/** Whether this note itself says it is household business. */
export function marked(note: Note): boolean {
  return marksOf(note).some((m) => LIFE.has(m));
}

/** Whether it is, or lives inside something that is. */
export function grownUp(notes: Note[], note: Note): boolean {
  if (marked(note)) return true;
  return pathTo(notes, note.id).some(marked);
}

/** Everything under the house's roof, at any depth. */
export function household(notes: Note[]): Note[] {
  const roots = new Set(notes.filter(marked).map((n) => n.id));
  if (roots.size === 0) return [];
  return notes.filter(
    (n) =>
      n.archivedAt === null &&
      (roots.has(n.id) || pathTo(notes, n.id).some((p) => roots.has(p.id))),
  );
}

/**
 * A job the house wants doing.
 *
 * On a repeating list, "done" lapses when the period turns — so the milk you
 * ticked last Sunday is open again this Sunday without anything being written
 * anywhere. That is the whole trick of a grocery list, and it already existed;
 * it had nowhere to be seen.
 */
export function openIn(
  notes: Note[],
  items: Note[],
  today: Date,
): Note[] {
  return items.filter((n) => {
    if (n.archivedAt !== null) return false;
    // A room is a place, not a job. What is owed is what is inside it.
    if (notes.some((c) => c.parentId === n.id && c.archivedAt === null)) {
      return false;
    }
    const parent = n.parentId
      ? (notes.find((p) => p.id === n.parentId) ?? null)
      : null;
    return !isSettled(n, parent?.repeats ?? null, today);
  });
}
