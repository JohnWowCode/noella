/**
 * Three buckets, never a number.
 *
 * A 1–10 priority field is a decision you can spend an afternoon on, which is
 * exactly the trap: ranking feels like progress and produces none. Now / Next
 * / Later is coarse enough to answer in a second and still sorts a wall.
 *
 * Nothing is required to have one. Most notes never will, and a screen where
 * every row shouts a priority is a screen with no priorities.
 */

export const PRIORITIES = ["now", "next", "later"] as const;
export type Priority = (typeof PRIORITIES)[number];

interface Look {
  label: string;
  /** Said plainly on the picker, so the three do not blur together. */
  hint: string;
  /** Hot to cool. Read before the text is read, which is the whole point. */
  hex: string;
}

export const PRIORITY: Record<Priority, Look> = {
  now: { label: "Now", hint: "today, or it slips", hex: "#E85D5D" },
  next: { label: "Next", hint: "once now is clear", hex: "#F2A33C" },
  later: { label: "Later", hint: "real, not urgent", hex: "#6FA8F0" },
};

/** Lower sorts first. Unset sits after everything explicitly ranked. */
export function rankOf(priority: Priority | null): number {
  return priority === null ? PRIORITIES.length : PRIORITIES.indexOf(priority);
}

export function byPriority<T extends { priority: Priority | null }>(
  a: T,
  b: T,
): number {
  return rankOf(a.priority) - rankOf(b.priority);
}
