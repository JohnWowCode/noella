/**
 * How much something matters. Three levels, never a number.
 *
 * This used to be Now / Next / Later, which sounds like a plan and is actually
 * a muddle: "now" meant both "today" and "important", so a thing that mattered
 * enormously but could not be done this week had nowhere to sit, and today's
 * list and the importance ranking were the same field fighting each other.
 *
 * They are two questions and they are asked separately now. This one is only
 * about weight, so it holds still for months at a time; what you are doing
 * today is a separate one-tap mark that resets with the day.
 *
 * Nothing is required to have one, and a 1-10 field is an afternoon of
 * deciding, so it stays at three.
 */

export const PRIORITIES = ["high", "mid", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

interface Look {
  /** On the card and in the picker. Short, because it is repeated everywhere. */
  label: string;
  /** Said plainly once, in the picker, so the three do not blur together. */
  hint: string;
  /** Hot to cool. Read before the text is read, which is the whole point. */
  hex: string;
}

export const PRIORITY: Record<Priority, Look> = {
  high: { label: "HPrio", hint: "matters most", hex: "#E85D5D" },
  mid: { label: "MPrio", hint: "matters", hex: "#F2A33C" },
  low: { label: "LPrio", hint: "real, but not pressing", hex: "#6FA8F0" },
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

/** What older walls stored, read across. */
export function priorityOf(stored: string | null | undefined): Priority | null {
  if (!stored) return null;
  if ((PRIORITIES as readonly string[]).includes(stored)) {
    return stored as Priority;
  }
  const legacy: Record<string, Priority> = {
    now: "high",
    next: "mid",
    later: "low",
  };
  return legacy[stored] ?? null;
}
