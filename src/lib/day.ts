/**
 * The day as a column of hours.
 *
 * A list says what you owe; it does not say when, and "when" is the question
 * that decides whether any of it happens. A school timetable works on people
 * who cannot hold a plan in their head precisely because the plan is not in
 * their head — it is on a wall, in rows, and the row you are in is the thing
 * you are doing.
 *
 * Blocks are minutes past midnight. Length is the estimate the note already
 * carries, because that field has meant "how long this takes" since the timer
 * was built and should not start meaning it twice.
 */

import type { Note } from "./types";

/** What a block is worth when nothing said otherwise. Half an hour is a thing. */
export const DEFAULT_BLOCK = 30;

/** Rows outside these never appear, however wrong the stored minute is. */
export const DAY_START = 0;
export const DAY_END = 24 * 60;

export interface Block {
  note: Note;
  /** Minutes past midnight. */
  at: number;
  minutes: number;
}

export function clockOf(minutes: number): string {
  const m = ((Math.round(minutes) % DAY_END) + DAY_END) % DAY_END;
  const h = Math.floor(m / 60);
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  const mins = m % 60;
  return mins === 0
    ? `${twelve}${suffix}`
    : `${twelve}:${String(mins).padStart(2, "0")}${suffix}`;
}

/** Today's blocks, earliest first. Finished ones stay: the day happened. */
export function blocksOn(notes: Note[], todayKey: string): Block[] {
  return notes
    .filter(
      (n) =>
        n.archivedAt === null &&
        n.blockAt !== null &&
        n.todayOn === todayKey &&
        n.blockAt >= DAY_START &&
        n.blockAt < DAY_END,
    )
    .map((n) => ({
      note: n,
      at: n.blockAt as number,
      minutes: Math.max(15, n.estimateMinutes ?? DEFAULT_BLOCK),
    }))
    .sort((a, b) => a.at - b.at || a.note.id.localeCompare(b.note.id));
}

/**
 * Which hours to draw.
 *
 * Not all twenty-four: an empty column of a day nobody has planned is sixteen
 * rows of nothing, which is the opposite of help. It reaches an hour either
 * side of what is actually blocked, keeps a minimum height so the strip is a
 * strip rather than one line, and follows the clock so "now" is always on it.
 */
export function hoursShown(
  blocks: Block[],
  nowMinutes: number,
): { from: number; to: number } {
  const marks = [nowMinutes, ...blocks.map((b) => b.at)];
  const ends = blocks.map((b) => b.at + b.minutes);
  let from = Math.floor(Math.min(...marks) / 60) - 1;
  let to = Math.ceil(Math.max(nowMinutes + 60, ...ends, 0) / 60) + 1;
  from = Math.max(0, from);
  to = Math.min(24, Math.max(to, from + 5));
  if (to === 24) from = Math.min(from, 19);
  return { from, to };
}

/**
 * Blocks that overlap, so two things at once can be drawn as two things at
 * once rather than one on top of the other. Nothing stops you double-booking;
 * being shown that you have is the useful part.
 */
export function clashes(blocks: Block[]): Set<string> {
  const bad = new Set<string>();
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i];
      const b = blocks[j];
      if (b.at < a.at + a.minutes && a.at < b.at + b.minutes) {
        bad.add(a.note.id);
        bad.add(b.note.id);
      }
    }
  }
  return bad;
}

/** Minutes past midnight, from a real clock. */
export function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}
