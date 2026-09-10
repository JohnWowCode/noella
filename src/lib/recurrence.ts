/**
 * Recurring lists.
 *
 * A bill used to be its own kind of note with its own screen, its own editor
 * and a stored set of settled periods. It never needed to be: a bill is an
 * item on a list that comes back every month. So a list can have a cadence,
 * and its items reset when the period turns.
 *
 * Nothing is stored to track that. An item carries the moment it was ticked,
 * and "done this period" is just whether that moment falls in the period we
 * are in now — which means turning the month over requires no work at all.
 */

import type { Note } from "./types";

/*
 * The rhythms a household actually runs on.
 *
 * Weekly, monthly and yearly covered bills and not much else. Chores are the
 * case that breaks it: the dishes are daily, the laundry is weekly, the sheets
 * are every other week, and those three cannot live on one list if the list
 * owns the rhythm. Daily and fortnightly are not decoration — they are two of
 * the four things a person actually does on a repeat.
 */
export const CADENCES = [
  "daily",
  "weekly",
  "fortnightly",
  "monthly",
  "yearly",
] as const;
export type Cadence = (typeof CADENCES)[number];

const pad = (n: number) => String(n).padStart(2, "0");

/** Sunday opening the week containing `on`. */
function weekStart(on: Date): Date {
  const d = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * The Sunday that opened this fortnight.
 *
 * Counted from a fixed point rather than from anything stored: an anchor per
 * list would be one more thing to keep, to get wrong, and to lose in a merge.
 * Which of two weeks you are in is decided by the parity of the week number
 * since the epoch, and the answer is a real date — the first attempt returned
 * an index and multiplied it back up, which lands on a Thursday, because the
 * epoch began on one. That put the end of the fortnight before the start of
 * it and every fortnightly chore read "back in 0d" forever.
 *
 * Rounded rather than floored so the hour that daylight saving moves cannot
 * push a Sunday into the week before it.
 */
function fortnightStart(on: Date): Date {
  const start = weekStart(on);
  const weeks = Math.round(start.getTime() / 604_800_000);
  if (weeks % 2 !== 0) start.setDate(start.getDate() - 7);
  return start;
}

/** The bucket a date belongs to. Two dates in the same bucket are one period. */
export function periodKey(cadence: Cadence, on: Date): string {
  switch (cadence) {
    case "daily":
      return `D${on.getFullYear()}-${pad(on.getMonth() + 1)}-${pad(on.getDate())}`;
    case "weekly":
      return `W${weekStart(on).toDateString()}`;
    case "fortnightly":
      return `F${fortnightStart(on).toDateString()}`;
    case "monthly":
      return `${on.getFullYear()}-${pad(on.getMonth() + 1)}`;
    case "yearly":
      return String(on.getFullYear());
  }
}

/**
 * Ticked, and ticked recently enough to still count. On a plain list a tick is
 * permanent; on a recurring one it lapses when the period turns.
 */
export function isSettled(
  item: Note,
  cadence: Cadence | null,
  today: Date,
): boolean {
  if (item.doneAt === null) return false;
  // Its own rhythm beats the list's. The dishes are daily on a weekly list
  // and the sheets are fortnightly on the same one; a list that forced every
  // item to share a rhythm meant a chore list per rhythm, which is three
  // lists to keep and two of them permanently half-read.
  const rhythm = item.repeats ?? cadence;
  if (rhythm === null) return true;
  return periodKey(rhythm, new Date(item.doneAt)) === periodKey(rhythm, today);
}

/** The rhythm actually governing an item, list included. */
export function rhythmOf(item: Note, list: Cadence | null): Cadence | null {
  return item.repeats ?? list;
}

export function describeCadence(cadence: Cadence): string {
  return {
    daily: "every day",
    weekly: "every week",
    fortnightly: "every other week",
    monthly: "every month",
    yearly: "every year",
  }[cadence];
}

/** Two words for a chip. "Every other week" is a sentence, not a label. */
export function shortCadence(cadence: Cadence): string {
  return {
    daily: "Daily",
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly",
    yearly: "Yearly",
  }[cadence];
}

/** When this period ends, in days. What "resets in 9 days" is counting. */
export function daysLeftInPeriod(cadence: Cadence, today: Date): number {
  /*
   * Built out of the period's own start, never by adding to today.
   *
   * The weekly case read `end.setDate(weekStart(today).getDate() + 7)`, which
   * takes the day-of-month the week began on and sets it on *this* month — so
   * a week that started on the 30th asked for the 37th of the following one,
   * and every wall was told the wrong day for the first few days of a month.
   */
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  if (cadence === "daily") end.setDate(end.getDate() + 1);
  if (cadence === "weekly") {
    const from = weekStart(today);
    end.setFullYear(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  }
  if (cadence === "fortnightly") {
    const from = fortnightStart(today);
    end.setFullYear(from.getFullYear(), from.getMonth(), from.getDate() + 14);
  }
  if (cadence === "monthly") end.setMonth(today.getMonth() + 1, 1);
  if (cadence === "yearly") end.setFullYear(today.getFullYear() + 1, 0, 1);
  end.setHours(0, 0, 0, 0);
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((end.getTime() - from.getTime()) / 86_400_000));
}

export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const body = rounded
    .toFixed(Number.isInteger(rounded) ? 0 : 2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency}${body}`;
}

export interface ListState {
  cadence: Cadence | null;
  items: Note[];
  open: Note[];
  settled: Note[];
  /** Only meaningful once items carry amounts. */
  total: number;
  outstanding: number;
}

export function listState(
  items: Note[],
  cadence: Cadence | null,
  today: Date,
): ListState {
  const settled = items.filter((i) => isSettled(i, cadence, today));
  const settledIds = new Set(settled.map((i) => i.id));
  const open = items.filter((i) => !settledIds.has(i.id));

  return {
    cadence,
    items,
    open,
    settled,
    total: items.reduce((n, i) => n + (i.amount ?? 0), 0),
    outstanding: open.reduce((n, i) => n + (i.amount ?? 0), 0),
  };
}
