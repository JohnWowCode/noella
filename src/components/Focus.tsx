"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { dateKey, fromKey, useTodayKey } from "@/lib/clock";
import { seqLabel, stamp } from "@/lib/format";
import { formatMoney, listState } from "@/lib/recurrence";
import {
  ACTIVE_LIMIT,
  bestRun,
  drifting,
  estimateFactor,
  ledger,
  movesThisWeek,
  quietDays,
  streak,
} from "@/lib/momentum";
import {
  isList,
  isProject,
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
import { Compose } from "./Compose";
import { Progress } from "./ProjectPanel";
import { Timer } from "./Timer";
import { ThemeToggle } from "./ThemeToggle";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/** Enough of the wall to prove the box works. Not enough to become a feed. */
const LATELY = 4;

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
  const [composeColor, setComposeColor] = useState<string | null>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);

  // `n` from anywhere on this screen lands the cursor in the box. There is now
  // a box to land in — this screen used to open with nowhere to write.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        composeRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  // Recurring lists that still want something this period. Plain lists never
  // appear here — a list is storage, not a demand.
  const due = useMemo(() => {
    if (!todayKey) return [];
    const today = fromKey(todayKey);
    return notes
      .filter((n) => n.isList && n.listCadence && n.archivedAt === null)
      .map((list) => ({
        list,
        state: listState(
          notes.filter((i) => i.parentId === list.id && i.archivedAt === null),
          list.listCadence,
          today,
        ),
      }))
      .filter((entry) => entry.state.open.length > 0);
  }, [notes, todayKey]);

  const loose = useMemo(() => unfiled(notes), [notes]);
  /*
   * Plain notes, newest first.
   *
   * Steps live inside their project. Projects and lists are excluded too —
   * they already have bands of their own further up this page, and showing
   * them again here made the screen repeat itself three rows running.
   */
  const top = useMemo(
    () =>
      notes
        .filter(
          (n) =>
            n.archivedAt === null &&
            n.parentId === null &&
            !isProject(n) &&
            !isList(n),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes],
  );
  const lately = useMemo(() => top.slice(0, LATELY), [top]);
  const calibration = useMemo(() => estimateFactor(notes), [notes]);
  const days = streak(cells);
  const week = movesThisWeek(cells);
  const today = todayKey ? fromKey(todayKey) : null;

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/">Today</NavLink>
            <NavLink href="/wall">Wall</NavLink>
            <NavLink href="/projects">Projects</NavLink>
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
              {week > 0 && (
                <span className="ml-auto tabular-nums">
                  {week} {week === 1 ? "move" : "moves"} this week
                  {days > 1 && ` · ${days} in a row`}
                </span>
              )}
            </div>

            {/* The whole point of the front door. You open the app and the
                first thing under your thumb is somewhere to put the thought —
                not a button that opens somewhere to put the thought. */}
            <div className="mt-4">
              <Compose
                colorId={composeColor}
                onColorId={setComposeColor}
                inputRef={composeRef}
                placeholder="What's on your mind?"
              />
            </div>

            {focus ? (
              <TheMove key={focus.id} project={focus} notes={notes} />
            ) : (
              <NothingFocused hasProjects={projectsOf(notes).length > 0} />
            )}

            {others.length > 0 && (
              <Block>
                <Heading count={others.length}>
                  Also going
                  {active.length > ACTIVE_LIMIT && (
                    <span className="label ml-auto font-normal text-mute">
                      {ACTIVE_LIMIT} at a time is usually the limit
                    </span>
                  )}
                </Heading>
                <div className="flex flex-col gap-2">
                  {others.map((p) => (
                    <AlsoActive key={p.id} project={p} notes={notes} />
                  ))}
                </div>
              </Block>
            )}

            {due.length > 0 && (
              <Block>
                <Heading count={due.length}>Coming round again</Heading>
                <div className="flex flex-col gap-2">
                  {due.map(({ list, state }) => (
                    <Link
                      key={list.id}
                      href={`/wall#note-${list.id}`}
                      className="flex items-baseline gap-3 rounded-xl border border-rule bg-field px-4 py-3.5 hover:bg-ink hover:text-paper"
                    >
                      <span className="prose-note text-[16px] leading-snug">
                        {projectTitle(list)}
                      </span>
                      <span className="label ml-auto shrink-0 tabular-nums opacity-70">
                        {state.settled.length}/{state.items.length}
                      </span>
                      {state.outstanding > 0 && (
                        <span className="label shrink-0 tabular-nums opacity-70">
                          {formatMoney(state.outstanding, settings.currency)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </Block>
            )}

            {drift.length > 0 && (
              <Block>
                <Heading count={drift.length}>
                  Still want these?
                  <span className="label ml-auto font-normal text-mute">
                    no wrong answer
                  </span>
                </Heading>
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

            {/* What you actually wrote, where you wrote it. Without this the
                box above swallows the note and gives nothing back. */}
            {lately.length > 0 && (
              <Block>
                <Heading>
                  Lately
                  {top.length > LATELY && (
                    <Link
                      href="/wall"
                      className="label ml-auto font-normal text-mute underline decoration-1 underline-offset-4 hover:text-ink"
                    >
                      all {top.length} →
                    </Link>
                  )}
                </Heading>
                <div className="flex flex-col gap-2">
                  {lately.map((n) => (
                    <Jot key={n.id} note={n} />
                  ))}
                </div>
              </Block>
            )}

            {loose.length > LATELY && (
              <Block>
                <Link
                  href="/wall"
                  className="flex items-center gap-3 rounded-xl border border-rule bg-field px-4 py-3.5 hover:bg-ink hover:text-paper"
                >
                  <span className="prose-note text-[16px]">
                    {loose.length} {loose.length === 1 ? "note" : "notes"} with
                    nowhere to live yet
                  </span>
                  <span className="label ml-auto shrink-0 opacity-70">Sort →</span>
                </Link>
              </Block>
            )}

            {/* Eight weeks of empty squares and three zeroes is not
                encouragement, it is an audit. It appears once there is
                something in it. */}
            {cells.some((c) => c.moves > 0) && (
              <Ledger cells={cells} week={week} calibration={calibration} />
            )}
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
      className={`mt-6 rounded-2xl border border-rule px-6 py-7 sm:px-8 sm:py-9 ${
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
            What is the smallest next bit?
          </p>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Something you could do in five minutes…"
            aria-label="Next step"
            className="prose-note border border-current bg-transparent px-4 py-3 text-[18px]
                       outline-none placeholder:opacity-50"
          />
        </form>
      )}

      {step && <Timer step={step} onColor={onColor} />}

      {step && <StartSmaller step={step} project={project} onColor={onColor} />}
    </section>
  );
}

function AlsoActive({ project, notes }: { project: Note; notes: Note[] }) {
  const { colorOf, patchNote } = useNoella();
  const color = colorOf(project);
  const step = nextActionOf(stepsOf(notes, project.id));

  return (
    <article className="flex items-start gap-3 rounded-xl border border-rule bg-field px-4 py-3.5">
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
    <article className="flex flex-col gap-3 rounded-xl border border-rule bg-field px-4 py-3.5 sm:flex-row sm:items-center sm:gap-x-3">
      <span className="prose-note text-[16px] leading-snug sm:flex-1">
        {projectTitle(project)}
      </span>
      <span className="label tabular-nums text-mute">
        quiet {quiet}d
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
  calibration,
}: {
  cells: { key: string; moves: number }[];
  week: number;
  calibration: { samples: number; factor: number } | null;
}) {
  const total = cells.reduce((n, c) => n + c.moves, 0);
  const best = bestRun(cells);

  return (
    <Block>
      <Heading>
        Ledger
        <span className="label ml-auto font-normal text-mute">last 8 weeks</span>
      </Heading>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-6 rounded-2xl border border-rule bg-field px-5 py-5">
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
          {calibration && (
            <Figure
              value={`×${calibration.factor.toFixed(1)}`}
              unit="actual"
              label={`vs your guess · ${calibration.samples}`}
            />
          )}
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
  value: number | string;
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

/**
 * When a step will not start, the answer is not motivation, it is specificity:
 * name something smaller and do that instead. The smaller thing is inserted
 * above, so it becomes the move immediately, and the original is untouched.
 */
function StartSmaller({
  step,
  project,
  onColor,
}: {
  step: Note;
  project: Note;
  onColor: boolean;
}) {
  const { addNote } = useNoella();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label mt-3 underline decoration-1 underline-offset-2 opacity-55 hover:opacity-100"
      >
        Too big? Start smaller
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        addNote({
          body: draft.trim(),
          colorId: project.colorId,
          parentId: project.id,
          order: step.order - 1,
        });
        setDraft("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="A smaller first bit…"
        aria-label="A smaller first step"
        className="prose-note min-w-0 flex-1 border border-current bg-transparent px-3 py-2
                   text-[16px] outline-none placeholder:opacity-50"
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="label border border-current px-2.5 py-2 opacity-60 hover:opacity-100"
      >
        Cancel
      </button>
      <button
        type="submit"
        className={`label border border-current px-2.5 py-2 ${
          onColor
            ? "hover:bg-[#111] hover:text-white"
            : "hover:bg-ink hover:text-paper"
        }`}
      >
        Do this first
      </button>
    </form>
  );
}

/** One vertical rhythm for every band on this screen. */
function Block({ children }: { children: React.ReactNode }) {
  return <section className="mt-11">{children}</section>;
}

/**
 * A band's name, in the serif, bold, at a size you can read across a room.
 *
 * These were 11px uppercase mono with the count spliced in between two
 * interpuncts — five glyphs of punctuation to say "three of these".
 */
function Heading({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <h2 className="title mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      {children}
      {count !== undefined && (
        <span className="label font-normal text-mute tabular-nums">{count}</span>
      )}
    </h2>
  );
}

/**
 * One thing you wrote, shown back to you.
 *
 * A note lands on the wall the moment you save it, and the wall is a screen
 * away — so the box on this page used to swallow your thought and show you
 * nothing. Four lines of your own handwriting is the whole difference between
 * a form and a desk.
 */
function Jot({ note }: { note: Note }) {
  const { colorOf } = useNoella();
  const color = colorOf(note);
  const first = note.body.split("\n")[0] || seqLabel(note.seq);

  return (
    <Link
      href={`/wall#note-${note.id}`}
      className="flex items-baseline gap-3 rounded-xl border border-rule bg-field px-4 py-3 hover:border-ink"
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-full border border-rule"
        style={{ backgroundColor: color?.hex ?? "transparent" }}
      />
      <span
        className={`prose-note line-clamp-2 min-w-0 flex-1 text-[16px] leading-snug ${
          note.doneAt ? "line-through opacity-45" : ""
        }`}
      >
        {first}
      </span>
      <span className="label shrink-0 text-mute">{stamp(note.createdAt)}</span>
    </Link>
  );
}

function NothingFocused({ hasProjects }: { hasProjects: boolean }) {
  return (
    <section className="mt-6 rounded-2xl border border-rule bg-field px-6 py-10 sm:px-8">
      <p className="display text-[26px] sm:text-[32px]">Nothing on today.</p>
      <p className="prose-note mt-3 max-w-md text-[16px] text-mute">
        {hasProjects
          ? "Make a project active and it lands here as today's move."
          : "Write something in the box above. When one of them turns into real work, make it a project and give it one small step."}
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
