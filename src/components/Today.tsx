"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  nextActionOf,
  progressOf,
  projectTitle,
  projectsOf,
  stepsOf,
} from "@/lib/projects";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Progress } from "./ProjectPanel";

const DAY_MS = 86_400_000;

// The clock is an external system, so the impure read belongs in a snapshot
// rather than in render. It never changes within a session.
const neverChanges = () => () => {};
const dayOnClient = () => Math.floor(Date.now() / DAY_MS);
const dayOnServer = () => 0;
import { Footer, Header, NavLink } from "./Chrome";
import { NoteCard } from "./NoteCard";
import { ThemeToggle } from "./ThemeToggle";

export function Today() {
  const { ready, notes } = useNoella();

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

  const day = useSyncExternalStore(neverChanges, dayOnClient, dayOnServer);

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
        !(n.isTask && n.doneAt === null),
    );
    if (older.length === 0) return null;
    return older[day % older.length];
  }, [notes, day]);

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/">Wall</NavLink>
            <NavLink href="/projects">Projects</NavLink>
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
