/**
 * The clock that is going, wherever you are.
 *
 * It lives in localStorage rather than React state so that it survives a
 * reload, a navigation and a closed tab — a clock you can lose by pressing
 * back is not a clock. Keeping it here rather than inside the timer component
 * is what lets the rest of the app know it is running.
 */

const KEY = "noella.timer";

export interface Running {
  stepId: string;
  startedAt: number;
}

export function readRunning(): Running | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Running).stepId === "string" &&
      typeof (parsed as Running).startedAt === "number"
    ) {
      return parsed as Running;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeRunning(next: Running): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The clock still runs for this session.
  }
}

export function clearRunning(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}

/** What a stretch on the clock is worth, in whole minutes. Never zero. */
export function minutesSince(startedAt: number, now: number): number {
  return Math.max(1, Math.round((now - startedAt) / 60000));
}
