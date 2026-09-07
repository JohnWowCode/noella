/**
 * Picking things up and putting them somewhere.
 *
 * HTML5 drag-and-drop is not an option: it does not exist on touch, and this
 * app is used on a phone at least as much as on a desk. So this is built on
 * pointer events, which are the same three events for a mouse, a thumb and a
 * stylus, and it decides between "a drag" and "a tap" the way every native
 * list does — a press that holds still for a moment is a drag, a press that
 * lets go quickly is a tap, and a press that slides straight away is a scroll.
 *
 * That last one matters more than it sounds. Grabbing on the first pixel of
 * movement makes a list impossible to scroll on a phone, which is worse than
 * having no drag at all.
 */

/** Hold this long without moving much, and you are dragging. */
export const HOLD_MS = 260;

/** Move further than this before the hold completes and it was a scroll. */
export const SLOP = 10;

export interface Grab {
  id: string;
  /** Where the pointer is now, for drawing what is being carried. */
  x: number;
  y: number;
}

/** Where a drop would put something, relative to the row under the pointer. */
export type Drop = "into" | "above" | "below";

/**
 * Which of the three a pointer at `y` means over a row.
 *
 * The middle of a row means "inside this"; the top and bottom eighths mean
 * "between these two". Only containers get the middle band — dropping into a
 * plain note would silently turn it into a folder, which is a surprising thing
 * to do to somebody by accident.
 */
export function dropAt(rect: DOMRect, y: number, canHold: boolean): Drop {
  const edge = Math.max(6, rect.height * 0.28);
  if (y < rect.top + edge) return "above";
  if (y > rect.bottom - edge) return "below";
  return canHold ? "into" : y < rect.top + rect.height / 2 ? "above" : "below";
}
