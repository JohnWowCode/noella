"use client";

import Link from "next/link";
import { useMemo } from "react";
import { daysBetween, fromKey, useTodayKey } from "@/lib/clock";
import {
  billLines,
  formatMoney,
  togglePaid,
  type BillLine,
} from "@/lib/money";
import {
  nextActionOf,
  progressOf,
  projectTitle,
  projectsOf,
  stepsOf,
} from "@/lib/projects";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Footer, Header, NavLink } from "./Chrome";
import { NoteCard } from "./NoteCard";
import { Progress } from "./ProjectPanel";
import { ThemeToggle } from "./ThemeToggle";

export function Today() {
  const { ready, notes, settings } = useNoella();
  const todayKey = useTodayKey();

  // One next step per active project. This is the executable list: if you only
  // did these, every project you called active would move today.
  const nextActions = useMemo(
    () =>
      projectsOf(notes)
        .filter((p) => p.projectStatus === "active")
        .map((project) => {
          const steps = stepsOf(notes, project.id);
          return { project, step: nextActionOf(steps), ...progressOf(steps) };
        }),
    [notes],
  );

  // Bills wanting money soon. Autopay ones are excluded: they are money you
  // are committed to, not a thing to do.
  const due = useMemo(() => {
    if (!todayKey) return [];
    return billLines(notes, fromKey(todayKey)).filter(
      (l) =>
        !l.dueSettled &&
        !l.bill.autopay &&
        l.dueKey !== null &&
        daysBetween(todayKey, l.dueKey) <= 7,
    );
  }, [notes, todayKey]);

  // Loose tasks only — steps belong to their project's line above.
  const open = useMemo(
    () =>
      notes
        .filter(
          (n) =>
            n.isTask &&
            n.doneAt === null &&
            n.archivedAt === null &&
            n.parentId === null,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [notes],
  );

  const pinned = useMemo(
    () => notes.filter((n) => n.pinned && n.archivedAt === null),
    [notes],
  );

  // One old note, chosen by the day so it stays put until tomorrow. Anything
  // already listed above is excluded — resurfacing should return something you
  // had forgotten, not repeat what you are looking at.
  const resurfaced = useMemo(() => {
    const older = notes.filter(
      (n) =>
        n.archivedAt === null &&
        !n.pinned &&
        n.parentId === null &&
        n.projectStatus === null &&
        n.bill === null &&
        !(n.isTask && n.doneAt === null),
    );
    if (older.length === 0 || !todayKey) return null;
    // Any stable function of the date works; this one just has to not move
    // until tomorrow.
    const seed = [...todayKey].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7);
    return older[Math.abs(seed) % older.length];
  }, [notes, todayKey]);

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/">Wall</NavLink>
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/money">Bills</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 sm:px-6">
        {!ready ? (
          <p className="label border border-rule bg-field px-6 py-14 text-center text-mute">
            Reading local store…
          </p>
        ) : (
          <>
            <Block
              title="Next actions"
              count={nextActions.length}
              empty="No active projects."
            >
              {nextActions.map((entry) => (
                <NextAction key={entry.project.id} {...entry} />
              ))}
            </Block>

            <Block title="Due" count={due.length} empty="Nothing due this week.">
              {due.map((line) => (
                <DueBill
                  key={line.note.id}
                  line={line}
                  todayKey={todayKey}
                  currency={settings.currency}
                />
              ))}
            </Block>

            <Block title="Open" count={open.length} empty="Nothing open.">
              {open.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </Block>

            <Block
              title="Pinned"
              count={pinned.length}
              empty="Nothing pinned."
            >
              {pinned.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </Block>

            <Block
              title="Resurfaced"
              count={resurfaced ? 1 : 0}
              empty="Nothing to resurface yet."
            >
              {resurfaced && <NoteCard note={resurfaced} />}
            </Block>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

/** One active project, its next step, and a box to tick it off right here. */
function NextAction({
  project,
  step,
  done,
  total,
}: {
  project: Note;
  step: Note | null;
  done: number;
  total: number;
}) {
  const { colorOf, patchNote } = useNoella();
  const color = colorOf(project);
  const onColor = color !== null;

  return (
    <article
      className={`flex flex-wrap items-start gap-x-4 gap-y-3 border border-rule px-5 py-4 ${
        onColor ? "" : "bg-field"
      }`}
      style={onColor ? { backgroundColor: color.hex, color: "#111111" } : undefined}
    >
      {step ? (
        <button
          type="button"
          onClick={() => patchNote(step.id, { doneAt: new Date().toISOString() })}
          aria-label={`Mark done: ${step.body}`}
          className="mt-1 grid h-4 w-4 shrink-0 place-items-center border border-current"
        />
      ) : (
        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center border border-current opacity-30" />
      )}

      <span className="min-w-48 flex-1">
        <Link
          href={`/#note-${project.id}`}
          className="label block opacity-60 hover:opacity-100"
        >
          {projectTitle(project)}
        </Link>
        <span className="prose-note mt-1 block text-[16px] leading-snug">
          {step ? step.body : "No steps yet — add one on the wall."}
        </span>
      </span>

      {total > 0 && (
        <span className="label flex items-center gap-2 opacity-70">
          <Progress done={done} total={total} onColor={onColor} />
          <span className="tabular-nums">
            {done}/{total}
          </span>
        </span>
      )}
    </article>
  );
}

/** A bill wanting money this week, payable from here. */
function DueBill({
  line,
  todayKey,
  currency,
}: {
  line: BillLine;
  todayKey: string;
  currency: string;
}) {
  const { colorOf, patchNote } = useNoella();
  const { note, bill, duePeriod, dueKey, overdue } = line;
  const color = colorOf(note);
  const onColor = color !== null;
  const days = dueKey ? daysBetween(todayKey, dueKey) : null;

  return (
    <article
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 border border-rule px-5 py-4 ${
        onColor ? "" : "bg-field"
      }`}
      style={onColor ? { backgroundColor: color.hex, color: "#111111" } : undefined}
    >
      <span className="min-w-40 flex-1">
        <Link
          href={`/#note-${note.id}`}
          className="prose-note block text-[16px] leading-snug hover:underline"
        >
          {projectTitle(note)}
        </Link>
        <span
          className={`label mt-1.5 inline-block px-1.5 py-0.5 ${
            overdue
              ? onColor
                ? "bg-[#111] text-white"
                : "bg-ink text-paper"
              : "opacity-65"
          }`}
        >
          {days === null
            ? "—"
            : days < 0
              ? `${-days}d late`
              : days === 0
                ? "due today"
                : `in ${days}d`}
        </span>
      </span>

      <span className="prose-note text-[19px] leading-none tabular-nums">
        {formatMoney(bill.amount, currency)}
      </span>

      <button
        type="button"
        onClick={() => patchNote(note.id, { bill: togglePaid(bill, duePeriod) })}
        className={`label border border-current px-2.5 py-1.5 ${
          onColor
            ? "hover:bg-[#111] hover:text-white"
            : "hover:bg-ink hover:text-paper"
        }`}
      >
        Pay
      </button>
    </article>
  );
}

function Block({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-11">
      <h2 className="label mb-3 flex items-center gap-2 text-mute">
        <span>{title}</span>
        <span aria-hidden>·</span>
        <span>{count}</span>
      </h2>
      {count === 0 ? (
        <p className="label border border-rule bg-field px-6 py-12 text-center text-mute">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  );
}
