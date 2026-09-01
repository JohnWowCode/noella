"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dateKey, daysBetween, fromKey, useTodayKey } from "@/lib/clock";
import { billLines, formatMoney } from "@/lib/money";
import {
  ACTIVE_LIMIT,
  bestRun,
  drifting,
  ledger,
  movesThisWeek,
  quietDays,
  streak,
} from "@/lib/momentum";
import {
  nextActionOf,
  progressOf,
  projectTitle,
  projectsOf,
  stepsOf,
  unfiled,
} from "@/lib/projects";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Footer, Header, NavLink } from "./Chrome";
import { Progress } from "./ProjectPanel";
import { Timer } from "./Timer";
import { ThemeToggle } from "./ThemeToggle";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/**
 * The front door.
 *
 * The wall is where thinking goes; it is a bad thing to open every morning,
 * because a feed of everything answers no question. This screen answers one:
 * what moves today. Everything on it is either the move, proof you have been
 * moving, or a loop you have quietly stopped working on.
 */
export function Focus() {
  const { ready, notes, settings } = useNoella();
  const todayKey = useTodayKey();

  const active = useMemo(
    () => projectsOf(notes).filter((p) => p.projectStatus === "active"),
    [notes],
  );

  // The focused project, or the first active one until you pick.
  const drift = useMemo(
    () => (todayKey ? drifting(notes, todayKey) : []),
    [notes, todayKey],
  );
  const driftIds = useMemo(() => new Set(drift.map((p) => p.id)), [drift]);

  // A project you called active but haven't touched in a fortnight belongs in
  // Drifting, not here — that is the confrontation the screen exists for.
  // projectsOf() is already in priority order, so the first one is today's.
  const moving = active.filter((p) => !driftIds.has(p.id));
  const focus = moving[0] ?? null;
  const others = moving.slice(1);

  const cells = useMemo(
    () => (todayKey ? ledger(notes, todayKey) : []),
    [notes, todayKey],
  );
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

  const loose = useMemo(() => unfiled(notes), [notes]);
  const days = streak(cells);
  const week = movesThisWeek(cells);
  const today = todayKey ? fromKey(todayKey) : null;

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/wall">Wall</NavLink>
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/money">Bills</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-10 sm:px-6 sm:pt-16 pb-28">
        {!ready || !today ? (
          <p className="label text-mute">Reading local store…</p>
        ) : (
          <>
            <div className="label flex flex-wrap items-baseline gap-x-3 gap-y-1 text-mute">
              <span>
                {WEEKDAY[today.getDay()]} {today.getDate()} {MONTH[today.getMonth()]}
              </span>
              <span className="ml-auto tabular-nums">
                {week} {week === 1 ? "move" : "moves"} this week
                {days > 1 && ` · ${days} in a row`}
              </span>
            </div>

            {focus ? (
              <TheMove key={focus.id} project={focus} notes={notes} />
            ) : (
              <NothingFocused hasProjects={projectsOf(notes).length > 0} />
            )}

            {others.length > 0 && (
              <Block>
                <h2 className="label mb-3 flex items-center gap-2 text-mute">
                  <span>Also active</span>
                  <span aria-hidden>·</span>
                  <span>{others.length}</span>
                  {active.length > ACTIVE_LIMIT && (
                    <span className="ml-auto normal-case tracking-normal text-mute">
                      {active.length} active · {ACTIVE_LIMIT} is usually the limit
                    </span>
                  )}
                </h2>
                <div className="flex flex-col gap-2">
                  {others.map((p) => (
                    <AlsoActive key={p.id} project={p} notes={notes} />
                  ))}
                </div>
              </Block>
            )}

            {due.length > 0 && (
              <Block>
                <h2 className="label mb-3 text-mute">Money this week</h2>
                <div className="flex flex-col gap-px">
                  {due.map((l) => (
                    <Link
                      key={l.note.id}
                      href="/money"
                      className="label flex items-baseline gap-3 border border-rule bg-field px-4 py-3 hover:bg-ink hover:text-paper"
                    >
                      <span className="normal-case tracking-normal">
                        {projectTitle(l.note)}
                      </span>
                      <span className="ml-auto tabular-nums">
                        {formatMoney(l.bill.amount, settings.currency)}
                      </span>
                      <span className="opacity-60">
                        {l.overdue ? "late" : `in ${daysBetween(todayKey, l.dueKey!)}d`}
                      </span>
                    </Link>
                  ))}
                </div>
              </Block>
            )}

            {drift.length > 0 && (
              <Block>
                <h2 className="label mb-3 flex items-center gap-2 text-mute">
                  <span>Still want these?</span>
                  <span aria-hidden>·</span>
                  <span>{drift.length}</span>
                  <span className="ml-auto normal-case tracking-normal">
                    no wrong answer
                  </span>
                </h2>
                <div className="flex flex-col gap-2">
                  {drift.map((p) => (
                    <Drifting
                      key={p.id}
                      project={p}
                      quiet={quietDays(notes, p, todayKey)}
                    />
                  ))}
                </div>
              </Block>
            )}

            {loose.length > 0 && (
              <Block>
                <Link
                  href="/wall"
                  className="label flex items-center gap-3 border border-rule bg-field px-4 py-3.5 text-mute hover:bg-ink hover:text-paper"
                >
                  <span>{loose.length} unfiled</span>
                  <span className="ml-auto normal-case tracking-normal">
                    jotted, no world yet →
                  </span>
                </Link>
              </Block>
            )}

            <Ledger cells={cells} week={week} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

/** The one thing. Nothing else on this screen is allowed to be this loud. */
function TheMove({ project, notes }: { project: Note; notes: Note[] }) {
  const { colorOf, patchNote, addNote } = useNoella();
  const [draft, setDraft] = useState("");

  const color = colorOf(project);
  const onColor = color !== null;
  const steps = stepsOf(notes, project.id);
  const step = nextActionOf(steps);
  const { done, total } = progressOf(steps);

  return (
    <section
      className={`mt-6 border border-rule px-6 py-7 sm:px-8 sm:py-9 ${
        onColor ? "" : "bg-field"
      }`}
      style={onColor ? { backgroundColor: color.hex, color: "#111111" } : undefined}
    >
      <div className="label flex flex-wrap items-center gap-x-3 gap-y-2 opacity-70">
        <Link href={`/wall#note-${project.id}`} className="hover:underline">
          {projectTitle(project)}
        </Link>
        {total > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <Progress done={done} total={total} onColor={onColor} />
            <span className="tabular-nums">
              {done}/{total}
            </span>
          </span>
        )}
      </div>

      {step ? (
        <div className="mt-6 flex items-start gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() =>
              patchNote(step.id, { doneAt: new Date().toISOString() })
            }
            aria-label={`Done: ${step.body}`}
            className="mt-1.5 h-7 w-7 shrink-0 border-2 border-current hover:bg-current sm:mt-2 sm:h-8 sm:w-8"
          />
          <p className="prose-note text-[26px] leading-[1.25] sm:text-[32px]">
            {step.body}
          </p>
        </div>
      ) : (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            addNote({
              body: draft.trim(),
              colorId: project.colorId,
              parentId: project.id,
            });
            setDraft("");
          }}
        >
          <p className="prose-note text-[22px] leading-tight opacity-60 sm:text-[26px]">
            No next step. Name the smallest one.
          </p>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="The next physical thing…"
            aria-label="Next step"
            className="prose-note border border-current bg-transparent px-4 py-3 text-[18px]
                       outline-none placeholder:opacity-50"
          />
        </form>
      )}

      {step && <Timer step={step} onColor={onColor} />}
    </section>
  );
}

function AlsoActive({ project, notes }: { project: Note; notes: Note[] }) {
  const { colorOf, patchNote } = useNoella();
  const color = colorOf(project);
  const step = nextActionOf(stepsOf(notes, project.id));

  return (
    <article className="flex items-start gap-3 border border-rule bg-field px-4 py-3.5">
      {step ? (
        <button
          type="button"
          onClick={() =>
            patchNote(step.id, { doneAt: new Date().toISOString() })
          }
          aria-label={`Done: ${step.body}`}
          className="mt-0.5 h-4 w-4 shrink-0 border border-rule hover:bg-ink"
          style={color ? { backgroundColor: "transparent", borderColor: color.hex } : undefined}
        />
      ) : (
        <span
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 border border-rule"
          style={{ backgroundColor: color?.hex ?? "transparent" }}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="label block truncate text-mute">
          {projectTitle(project)}
        </span>
        <span
          className={`prose-note mt-1 block text-[16px] leading-snug ${
            step ? "" : "opacity-45"
          }`}
        >
          {step ? step.body : "No next step"}
        </span>
      </span>
      <Link
        href="/projects"
        className="label shrink-0 border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
      >
        Rank
      </Link>
    </article>
  );
}

/**
 * A project that has gone quiet.
 *
 * This used to have no dismiss, on the theory that leaving it unanswered was
 * the only wrong answer. That is a bad bet for anyone who finds a standing
 * list of their own failures a reason to stop opening an app — and an
 * undismissable one is answered by closing the tab, not by deciding. "Not now"
 * is a real answer, so it is offered, and the row asks rather than accuses.
 */
function Drifting({ project, quiet }: { project: Note; quiet: number }) {
  const { patchNote } = useNoella();

  return (
    <article className="flex flex-col gap-3 border border-rule bg-field px-4 py-3.5 sm:flex-row sm:items-center sm:gap-x-3">
      <span className="label sm:flex-1">{projectTitle(project)}</span>
      <span className="label flex items-center gap-3">
        <span className="tabular-nums opacity-55">
          last touched {quiet}d ago
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() =>
            patchNote(project.id, { projectStatus: "active", order: -1 })
          }
          className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
        >
          Revive
        </button>
        <button
          type="button"
          onClick={() => patchNote(project.id, { projectStatus: "paused" })}
          className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
        >
          Park
        </button>
        <button
          type="button"
          onClick={() =>
            patchNote(project.id, { archivedAt: new Date().toISOString() })
          }
          className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
        >
          Drop
        </button>
        <button
          type="button"
          onClick={() => {
            const until = new Date();
            until.setDate(until.getDate() + 7);
            patchNote(project.id, { snoozedUntil: dateKey(until) });
          }}
          className="label border border-rule px-2 py-1 text-mute hover:bg-ink hover:text-paper"
        >
          Not now
        </button>
      </span>
    </article>
  );
}

/**
 * Eight weeks of days, filled on the days you finished something, with the
 * numbers it adds up to alongside. The grid alone left half the width empty
 * and read as decoration; paired with the figures it reads as an instrument.
 */
function Ledger({
  cells,
  week,
}: {
  cells: { key: string; moves: number }[];
  week: number;
}) {
  const total = cells.reduce((n, c) => n + c.moves, 0);
  const best = bestRun(cells);

  return (
    <Block>
      <h2 className="label mb-3 flex items-center gap-2 text-mute">
        <span>Ledger</span>
        <span className="ml-auto normal-case tracking-normal">last 8 weeks</span>
      </h2>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-6 border border-rule bg-field px-5 py-5">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {cells.map((c) => (
            <span
              key={c.key}
              title={`${c.key} — ${c.moves} ${c.moves === 1 ? "move" : "moves"}`}
              className="h-4 w-4 border border-rule-soft"
              style={{
                // Four steps, not a gradient: the wall has no gradients either.
                backgroundColor:
                  c.moves === 0
                    ? "transparent"
                    : c.moves === 1
                      ? "color-mix(in srgb, var(--ink) 32%, transparent)"
                      : c.moves < 4
                        ? "color-mix(in srgb, var(--ink) 64%, transparent)"
                        : "var(--ink)",
              }}
            />
          ))}
        </div>

        <dl className="flex flex-1 flex-wrap items-baseline justify-between gap-x-8 gap-y-4">
          <Figure value={week} unit="moves" label="this week" />
          <Figure value={total} unit="moves" label="8 weeks" />
          <Figure value={best} unit={best === 1 ? "day" : "days"} label="best run" />
        </dl>
      </div>
    </Block>
  );
}

function Figure({
  value,
  unit,
  label,
}: {
  value: number;
  unit: string;
  label: string;
}) {
  return (
    <div>
      <dd className="prose-note text-[30px] leading-none tabular-nums">
        {value}
        <span className="label ml-1.5 align-baseline text-mute">{unit}</span>
      </dd>
      <dt className="label mt-2 text-mute">{label}</dt>
    </div>
  );
}

/** One vertical rhythm for every band on this screen. */
function Block({ children }: { children: React.ReactNode }) {
  return <section className="mt-11">{children}</section>;
}

function NothingFocused({ hasProjects }: { hasProjects: boolean }) {
  return (
    <section className="mt-6 border border-rule bg-field px-6 py-10 sm:px-8">
      <p className="prose-note text-[22px] leading-tight sm:text-[26px]">
        Nothing is active.
      </p>
      <p className="label mt-4 text-mute">
        {hasProjects
          ? "Set a project to active and it becomes today's move."
          : "Write something on the wall, promote it to a project, give it one step."}
      </p>
      <Link
        href={hasProjects ? "/projects" : "/wall"}
        className="label mt-5 inline-block border border-rule px-3 py-2 hover:bg-ink hover:text-paper"
      >
        {hasProjects ? "Projects" : "The wall"}
      </Link>
    </section>
  );
}
