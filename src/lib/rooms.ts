/**
 * Rooms.
 *
 * There used to be four kinds of thing: a note, a to-do, a project and a list.
 * They were one record with four flags on it, and the flags did nothing a note
 * could not already do — a project was a note with a status, a list was a note
 * with a cadence, and both were "a note with things inside it". You reached
 * them by writing a note and then finding "Make a project" in a menu, which is
 * a promotion ceremony for a thing you had already made.
 *
 * There is one kind of thing now. Put something inside a note and it is a
 * room. Take everything out and it is a note again. Nothing is promoted,
 * nothing is converted, and there is no wrong drawer to have put it in.
 *
 * What the kinds actually carried is kept, but as properties of any note
 * rather than as a species:
 *   - a checkbox, which was the to-do            -> isTask
 *   - repeating, which was the recurring list    -> repeats
 *   - progress, which was the project            -> counted from what is inside
 */

import { childrenOf, progressOf } from "./tree";
import type { Note } from "./types";

/** A note with anything inside it. The only kind of container there is. */
export function isRoom(notes: Note[], note: Note): boolean {
  return childrenOf(notes, note.id).length > 0;
}

/** What is directly inside, in hand-set order. */
export const contentsOf = childrenOf;

export { progressOf };

/** First line of the body, which is all anything needs for a name. */
export function titleOf(note: Note): string {
  const line = note.body.split("\n", 1)[0]?.trim() ?? "";
  return line || (note.images.length > 0 ? "A picture" : `Note ${note.seq}`);
}

/**
 * Anything jotted and not yet put anywhere: no folder colour, nothing above
 * it, nothing inside it. This is what makes dumping a thought safe.
 */
export function loose(notes: Note[]): Note[] {
  return notes.filter(
    (n) =>
      n.archivedAt === null &&
      n.colorId === null &&
      n.parentId === null &&
      childrenOf(notes, n.id).length === 0,
  );
}
