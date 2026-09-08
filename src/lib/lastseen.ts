/**
 * The last thing you were actually working on.
 *
 * Coming back is the hard part. You close the laptop mid-thought on Tuesday,
 * open it on Thursday, and what greets you is a wall of two hundred notes
 * with no memory of which one you had your hands on — so you read the whole
 * wall, feel the weight of it, and start nothing. The app watched you open
 * that note and then threw the fact away.
 *
 * It is kept on the device rather than on the note, because it is a fact about
 * this screen in front of you and not about the note: the same note opened on
 * a phone should not tell a desk where its hands were.
 */

const KEY = "noella.last";

export interface LastSeen {
  id: string;
  /** Epoch milliseconds. */
  at: number;
}

export function readLast(): LastSeen | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as LastSeen).id === "string" &&
      typeof (parsed as LastSeen).at === "number"
    ) {
      return parsed as LastSeen;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLast(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    // A private window with storage off. Losing the marker is survivable.
  }
}

export function clearLast(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}

/** Long enough to have lost the thread. Below this you have not left. */
export const GAP_MS = 2 * 60 * 60 * 1000;

/**
 * How long ago, said the way you would say it out loud.
 *
 * Never a number of hours past a day — "47 hours ago" is arithmetic, and the
 * point of this line is that it reads like a person reminding you.
 */
export function agoWords(from: number, now: number): string {
  const ms = Math.max(0, now - from);
  const hours = ms / 3_600_000;
  if (hours < 5) return "Earlier today";
  if (hours < 20) return "Earlier on";
  const days = Math.round(hours / 24);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return "A while back";
}
