"use client";

import Link from "next/link";
import { useMemo } from "react";
import { daysBetween, fromKey, useTodayKey } from "@/lib/clock";
import {
  billLines,
  describeDue,
  formatMoney,
  monthlyEquivalent,
  togglePaid,
  type BillLine,
} from "@/lib/money";
import { projectTitle } from "@/lib/projects";
import { useNoella } from "@/lib/store/provider";
import { Footer, Header, NavLink } from "./Chrome";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Bills, and the two numbers worth knowing: what this month still wants from
 * you, and what you are committed to every month. Not a budgeting app — no
 * categories, no charts, no reconciliation. Colour already does categories.
 */
export function Money() {
  const { ready, notes, settings, patchSettings } = useNoella();
  const todayKey = useTodayKey();

  const lines = useMemo(() => {
    if (!todayKey) return [];
    return billLines(notes, fromKey(todayKey));
  }, [notes, todayKey]);

  const monthly = lines.reduce((n, l) => n + monthlyEquivalent(l.bill), 0);
  const outstanding = lines
    .filter((l) => l.owed)
    .reduce((n, l) => n + l.bill.amount, 0);
  const overdue = lines.filter((l) => l.overdue);

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/wall">Wall</NavLink>
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/">Today</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 sm:px-6 pb-28">
        {!ready || !todayKey ? (
          <Empty>Reading local store…</Empty>
        ) : lines.length === 0 ? (
          <Empty>
            No bills. Hit <span className="normal-case">Bill</span> on any note
            to turn it into one.
          </Empty>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Figure
                label="Every month"
                value={formatMoney(monthly, settings.currency)}
                note="committed"
              />
              <Figure
                label="Owed now"
                value={formatMoney(outstanding, settings.currency)}
                note={`${lines.filter((l) => l.owed).length} of ${lines.length} bills`}
                loud={outstanding > 0}
              />
              <Figure
                label="Overdue"
                value={String(overdue.length)}
                note={overdue.length === 0 ? "nothing late" : "past due"}
                loud={overdue.length > 0}
              />
            </section>

            <section className="mt-8 flex flex-col gap-3">
              {lines.map((line) => (
                <Row key={line.note.id} line={line} todayKey={todayKey} />
              ))}
            </section>

            <div className="label mt-6 flex flex-wrap items-center gap-2 text-mute">
              <span>Currency</span>
              <input
                value={settings.currency}
                onChange={(e) =>
                  patchSettings({ currency: e.target.value.slice(0, 3) })
                }
                aria-label="Currency symbol"
                className="w-14 border border-rule bg-field px-2 py-1.5 text-center outline-none"
              />
              <span className="ml-auto">
                {formatMoney(monthly * 12, settings.currency)} a year
              </span>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  loud = false,
}: {
  label: string;
  value: string;
  note: string;
  loud?: boolean;
}) {
  return (
    <div
      className={`border border-rule px-5 py-4 ${
        loud ? "bg-ink text-paper" : "bg-field"
      }`}
    >
      <p className="label opacity-60">{label}</p>
      <p className="prose-note mt-2 text-[26px] leading-none tabular-nums">
        {value}
      </p>
      <p className="label mt-2 opacity-60">{note}</p>
    </div>
  );
}

function Row({ line, todayKey }: { line: BillLine; todayKey: string }) {
  const { colorOf, patchNote, settings } = useNoella();
  const { note, bill, period, settled, overdue } = line;
  const color = colorOf(note);
  const onColor = color !== null;

  const days = line.dueKey ? daysBetween(todayKey, line.dueKey) : null;

  return (
    <article
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 border border-rule px-5 py-4 ${
        onColor ? "" : "bg-field"
      } ${settled ? "opacity-60" : ""}`}
      style={onColor ? { backgroundColor: color.hex, color: "#111111" } : undefined}
    >
      <span className="min-w-40 flex-1">
        <Link
          href={`/wall#note-${note.id}`}
          className="prose-note block text-[17px] leading-snug hover:underline"
        >
          {projectTitle(note)}
        </Link>
        <span className="label mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 opacity-65">
          <span>{describeDue(bill)}</span>
          {bill.autopay && (
            <>
              <span aria-hidden>·</span>
              <span>autopay</span>
            </>
          )}
        </span>
      </span>

      <span className="label text-right">
        <span className="prose-note block text-[19px] leading-none tabular-nums">
          {formatMoney(bill.amount, settings.currency)}
        </span>
        <span
          className={`mt-1.5 inline-block px-1.5 py-0.5 ${
            overdue
              ? onColor
                ? "bg-[#111] text-white"
                : "bg-ink text-paper"
              : "opacity-65"
          }`}
        >
          {settled
            ? `paid · ${period}`
            : days === null
              ? "—"
              : days < 0
                ? `${-days}d late`
                : days === 0
                  ? "today"
                  : `in ${days}d`}
        </span>
      </span>

      <button
        type="button"
        onClick={() => patchNote(note.id, { bill: togglePaid(bill, period) })}
        className={`label border border-current px-2.5 py-1.5 ${
          onColor
            ? "hover:bg-[#111] hover:text-white"
            : "hover:bg-ink hover:text-paper"
        }`}
      >
        {settled ? "Unpay" : "Pay"}
      </button>
    </article>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="label border border-rule bg-field px-6 py-14 text-center text-mute">
      {children}
    </p>
  );
}
