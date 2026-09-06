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

export const CADENCES = ["weekly", "monthly", "yearly"] as const;
export type Cadence = (typeof CADENCES)[number];

const pad = (n: number) => String(n).padStart(2, "0");

/** Sunday opening the week containing `on`. */
function weekStart(on: Date): Date {
  const d = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** The bucket a date belongs to. Two dates in the same bucket are one period. */
export function periodKey(cadence: Cadence, on: Date): string {
  switch (cadence) {
    case "weekly":
      return `W${weekStart(on).toDateString()}`;
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
  if (cadence === null) return true;
  return (
    periodKey(cadence, new Date(item.doneAt)) === periodKey(cadence, today)
  );
}

export function describeCadence(cadence: Cadence): string {
  return { weekly: "every week", monthly: "every month", yearly: "every year" }[
    cadence
  ];
}

/** When this period ends, in days. What "resets in 9 days" is counting. */
export function daysLeftInPeriod(cadence: Cadence, today: Date): number {
  const end = new Date(today);
  if (cadence === "weekly") end.setDate(weekStart(today).getDate() + 7);
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
