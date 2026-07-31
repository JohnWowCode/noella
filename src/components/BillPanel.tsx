"use client";

import {
  CADENCES,
  WEEKDAYS,
  billLineFor,
  formatMoney,
  monthlyEquivalent,
  togglePaid,
  type Bill,
} from "@/lib/money";
import { dateKey, fromKey } from "@/lib/clock";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";

/**
 * The money half of a bill card: how much, how often, when next, and one
 * button to settle the current period. Marking paid records a period key, so
 * next month resets itself without a single row being generated.
 */
export function BillPanel({
  note,
  bill,
  today,
  onColor,
}: {
  note: Note;
  bill: Bill;
  today: Date;
  onColor: boolean;
}) {
  const { patchNote, settings } = useNoella();
  const edge = onColor ? "border-current/30" : "border-rule";

  const line = billLineFor(note, today);
  const due = line?.due ?? null;
  const settled = line?.settled ?? false;
  const overdue = line?.overdue ?? false;
  const period = line?.period ?? "";

  function set(patch: Partial<Bill>) {
    patchNote(note.id, { bill: { ...bill, ...patch } });
  }

  return (
    <div className={`mt-4 border-t ${edge} pt-4`}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="flex flex-col gap-1.5">
          <span className="label opacity-60">Amount</span>
          <span className="flex items-center">
            <span className="label pr-1 opacity-70">{settings.currency}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={bill.amount || ""}
              onChange={(e) => set({ amount: Number(e.target.value) || 0 })}
              placeholder="0"
              aria-label="Amount"
              className={`w-24 border ${edge} bg-transparent px-2 py-1.5 text-[15px] outline-none`}
            />
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label opacity-60">Every</span>
          <select
            value={bill.cadence}
            onChange={(e) => {
              const cadence = e.target.value as Bill["cadence"];
              // Each cadence reads dueOn differently, so reset it to a sane one.
              const dueOn =
                cadence === "monthly"
                  ? "1"
                  : cadence === "weekly"
                    ? "1"
                    : cadence === "yearly"
                      ? "01-01"
                      : dateKey(today);
              set({ cadence, dueOn, paid: [] });
            }}
            aria-label="How often"
            className={`label border ${edge} bg-transparent px-2 py-2 outline-none`}
          >
            {CADENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label opacity-60">Due</span>
          <DueInput bill={bill} onChange={(dueOn) => set({ dueOn })} edge={edge} />
        </label>

        <label className="label flex items-center gap-2">
          <input
            type="checkbox"
            checked={bill.autopay}
            onChange={(e) => set({ autopay: e.target.checked })}
            className="h-4 w-4 appearance-none border border-current checked:bg-current"
          />
          Autopay
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`label px-1.5 py-1 ${
            overdue
              ? onColor
                ? "bg-[#111] text-white"
                : "bg-ink text-paper"
              : "opacity-70"
          }`}
        >
          {settled
            ? `Paid · ${period}`
            : due
              ? overdue
                ? `Overdue · ${dateKey(due)}`
                : `Due · ${dateKey(due)}`
              : "No due date"}
        </span>

        {bill.cadence !== "monthly" && bill.cadence !== "once" && (
          <span className="label opacity-60">
            {formatMoney(monthlyEquivalent(bill), settings.currency)}/mo
          </span>
        )}

        <button
          type="button"
          onClick={() => patchNote(note.id, { bill: togglePaid(bill, period) })}
          className={`label ml-auto border border-current px-2.5 py-1.5 ${
            onColor
              ? "hover:bg-[#111] hover:text-white"
              : "hover:bg-ink hover:text-paper"
          }`}
        >
          {settled ? "Unpay" : "Mark paid"}
        </button>
      </div>
    </div>
  );
}

/** Each cadence needs a different question, so the control changes with it. */
function DueInput({
  bill,
  onChange,
  edge,
}: {
  bill: Bill;
  onChange: (dueOn: string) => void;
  edge: string;
}) {
  const base = `border ${edge} bg-transparent px-2 py-1.5 text-[15px] outline-none`;

  if (bill.cadence === "monthly") {
    return (
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min="1"
          max="31"
          value={bill.dueOn}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Day of month"
          className={`w-16 ${base}`}
        />
        <span className="label opacity-60">of the month</span>
      </span>
    );
  }

  if (bill.cadence === "weekly") {
    return (
      <select
        value={bill.dueOn}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Day of week"
        className={`label border ${edge} bg-transparent px-2 py-2 outline-none`}
      >
        {WEEKDAYS.map((d, i) => (
          <option key={d} value={String(i)}>
            {d}
          </option>
        ))}
      </select>
    );
  }

  if (bill.cadence === "yearly") {
    // A yearly bill only needs month and day, so it borrows a date input and
    // throws the year away.
    return (
      <input
        type="date"
        value={`2000-${bill.dueOn}`}
        onChange={(e) => onChange(e.target.value.slice(5))}
        aria-label="Date each year"
        className={base}
      />
    );
  }

  return (
    <input
      type="date"
      value={bill.dueOn}
      onChange={(e) => onChange(e.target.value || dateKey(fromKey(bill.dueOn)))}
      aria-label="Date"
      className={base}
    />
  );
}
