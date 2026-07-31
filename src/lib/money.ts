/**
 * Bills. A bill is a note you promoted, same as a project — so rent lives on
 * the wall with everything else, keeps its colour, and turns up in search.
 *
 * Recurrence is never expanded into rows. A bill stores the set of periods it
 * has been settled for ("2026-07"), so next month resets itself and the store
 * never accumulates instances.
 *
 * Everything here hangs off one idea: the period containing today. That is the
 * obligation you are actually being asked about, which is why paying it makes
 * the outstanding total fall rather than rolling forward to next month.
 */

import { dateKey, fromKey } from "./clock";
import type { Note } from "./types";

export const CADENCES = ["monthly", "weekly", "yearly", "once"] as const;
export type Cadence = (typeof CADENCES)[number];

export interface Bill {
  /** Major units, e.g. 1250.5. Kept as a number; these are household sums. */
  amount: number;
  cadence: Cadence;
  /**
   * monthly → day of month, "15"
   * weekly  → day of week, "1" (Monday)
   * yearly  → "MM-DD"
   * once    → "YYYY-MM-DD"
   */
  dueOn: string;
  /** Period keys already settled. See periodKeyFor. */
  paid: string[];
  /** On autopay it still counts in the totals, but it stops nagging you. */
  autopay: boolean;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isBill(note: Note): boolean {
  return note.bill !== null;
}

export function newBill(): Bill {
  return { amount: 0, cadence: "monthly", dueOn: "1", paid: [], autopay: false };
}

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Sunday opening the week that contains `on`. Weekly bills settle per week. */
function weekStart(on: Date): Date {
  const d = startOfDay(on);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** The bucket a given date settles. Marking paid records one of these. */
export function periodKeyFor(cadence: Cadence, on: Date): string {
  switch (cadence) {
    case "monthly":
      return `${on.getFullYear()}-${pad(on.getMonth() + 1)}`;
    case "weekly":
      return `W${dateKey(weekStart(on))}`;
    case "yearly":
      return String(on.getFullYear());
    case "once":
      return "once";
  }
}

/**
 * When this bill falls due inside the period containing `on` — which may be
 * behind or ahead of `on` itself. A monthly bill set to the 31st lands on the
 * last day of shorter months rather than skipping them.
 */
export function occurrenceIn(bill: Bill, on: Date): Date | null {
  switch (bill.cadence) {
    case "monthly": {
      const day = Math.min(31, Math.max(1, Number(bill.dueOn) || 1));
      const y = on.getFullYear();
      const m = on.getMonth();
      return new Date(y, m, Math.min(day, daysInMonth(y, m)));
    }
    case "weekly": {
      const target = Math.min(6, Math.max(0, Number(bill.dueOn) || 0));
      const d = weekStart(on);
      d.setDate(d.getDate() + target);
      return d;
    }
    case "yearly": {
      const [m, day] = bill.dueOn.split("-").map(Number);
      return new Date(on.getFullYear(), (m || 1) - 1, day || 1);
    }
    case "once": {
      const d = fromKey(bill.dueOn);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
}

/** Any date inside the period following the one containing `on`. */
function nextPeriodFrom(cadence: Cadence, on: Date): Date {
  const d = startOfDay(on);
  if (cadence === "monthly") d.setMonth(d.getMonth() + 1);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  if (cadence === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** The next time this bill falls due, on or after `from`. */
export function nextDueDate(bill: Bill, from: Date): Date | null {
  if (bill.cadence === "once") return occurrenceIn(bill, from);
  const here = occurrenceIn(bill, from);
  if (!here) return null;
  return here >= startOfDay(from)
    ? here
    : occurrenceIn(bill, nextPeriodFrom(bill.cadence, from));
}

/** What this bill costs per month, for the one number worth knowing. */
export function monthlyEquivalent(bill: Bill): number {
  switch (bill.cadence) {
    case "monthly":
      return bill.amount;
    case "weekly":
      return (bill.amount * 52) / 12;
    case "yearly":
      return bill.amount / 12;
    case "once":
      return 0;
  }
}

export function describeDue(bill: Bill): string {
  switch (bill.cadence) {
    case "monthly": {
      const n = Number(bill.dueOn) || 1;
      return `monthly · ${n}${ordinal(n)}`;
    }
    case "weekly":
      return `weekly · ${WEEKDAYS[Number(bill.dueOn) || 0]}`;
    case "yearly":
      return `yearly · ${bill.dueOn}`;
    case "once":
      return `once · ${bill.dueOn}`;
  }
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const body = rounded
    .toFixed(Number.isInteger(rounded) ? 0 : 2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency}${body}`;
}

/** Everything a screen needs about one bill, resolved against a single day. */
export interface BillLine {
  note: Note;
  bill: Bill;
  /** The period containing today — the one Pay settles. */
  period: string;
  /** Settled for this period. */
  settled: boolean;
  /**
   * Money this period still wants. False once settled, and false when the
   * occurrence fell due before the bill was written down: adding "rent, 3rd of
   * the month" on the 30th must not announce that you are already late.
   */
  owed: boolean;
  /** The date to show: this period's if still owed, otherwise the next one. */
  due: Date | null;
  dueKey: string | null;
  overdue: boolean;
  /**
   * The period `due` belongs to, which is next month's when this month is
   * already settled or was never yours. "What is coming up in the next week"
   * has to reach across the month boundary; "am I square for this month" must
   * not. The two questions genuinely want different periods.
   */
  duePeriod: string;
  dueSettled: boolean;
}

export function billLineFor(note: Note, today: Date): BillLine | null {
  const bill = note.bill;
  if (!bill) return null;

  const day = startOfDay(today);
  const period = periodKeyFor(bill.cadence, day);
  const settled = bill.paid.includes(period);
  const here = occurrenceIn(bill, day);
  const createdOn = startOfDay(new Date(note.createdAt));

  const inScope = here !== null && (bill.cadence === "once" || here >= createdOn);
  const owed = !settled && inScope;
  const due = owed ? here : nextDueDate(bill, day);
  const duePeriod = due ? periodKeyFor(bill.cadence, due) : period;

  return {
    note,
    bill,
    period,
    settled,
    owed,
    due,
    dueKey: due ? dateKey(due) : null,
    overdue: owed && here !== null && here < day,
    duePeriod,
    dueSettled: bill.paid.includes(duePeriod),
  };
}

/** Bills, most urgent first. */
export function billLines(notes: Note[], today: Date): BillLine[] {
  return notes
    .filter((n) => n.bill !== null && n.archivedAt === null)
    .map((n) => billLineFor(n, today))
    .filter((l): l is BillLine => l !== null)
    .sort((a, b) => {
      if (a.owed !== b.owed) return a.owed ? -1 : 1;
      if (!a.due || !b.due) return 0;
      return a.due.getTime() - b.due.getTime();
    });
}

/** Toggling settlement for the period a line refers to. */
export function togglePaid(bill: Bill, period: string): Bill {
  return {
    ...bill,
    paid: bill.paid.includes(period)
      ? bill.paid.filter((p) => p !== period)
      : [...bill.paid, period],
  };
}
