"use client";

import Link from "next/link";
import { useMemo } from "react";
import { stamp } from "@/lib/format";
import {
  PROJECT_STATUSES,
  nextActionOf,
  progressOf,
  projectTitle,
  projectsOf,
  stepsOf,
  type ProjectStatus,
} from "@/lib/projects";
import { ACTIVE_LIMIT, quietDays } from "@/lib/momentum";
import { reorder } from "@/lib/order";
import { useTodayKey } from "@/lib/clock";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Footer, Header, NavLink } from "./Chrome";
import { Progress } from "./ProjectPanel";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Every project in one place, what state it's in, and the one step that moves
 * it. Rows rather than cards: this screen is for scanning twenty things, not
 * reading one.
 */
export function Projects() {
  const { ready, notes, patchNote } = useNoella();
  const todayKey = useTodayKey();

  const grouped = useMemo(() => {
    const all = projectsOf(notes);
    return PROJECT_STATUSES.map((status) => ({
      status,
      projects: all.filter((p) => p.projectStatus === status),
    }));
  }, [notes]);

  const total = grouped.reduce((n, g) => n + g.projects.length, 0);
  const activeCount =
    grouped.find((g) => g.status === "active")?.projects.length ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/wall">Wall</NavLink>
            <NavLink href="/">Today</NavLink>
            <NavLink href="/money">Bills</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 sm:px-6 pb-28">
        {/* The stance, stated plainly. Not enforced — you are an adult — but
            never hidden either, because too many actives is the actual disease. */}
        {activeCount > ACTIVE_LIMIT && (
          <p className="label mb-6 border border-rule bg-ink px-5 py-4 text-paper">
            {activeCount} projects are active. You can move {ACTIVE_LIMIT}. Park
            the rest — parked is not failure, it is honesty.
          </p>
        )}
        {!ready ? (
          <Empty>Reading local store…</Empty>
        ) : total === 0 ? (
          <Empty>
            No projects. Promote any note with{" "}
            <span className="normal-case">Project</span> on its card.
          </Empty>
        ) : (
          grouped.map(({ status, projects }) =>
            projects.length === 0 ? null : (
              <section key={status} className="mb-11">
                <h2 className="label mb-3 flex items-center gap-2 text-mute">
                  <span
                    className={
                      status === "active" ? "bg-ink px-1.5 py-0.5 text-paper" : ""
                    }
                  >
                    {status}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{projects.length}</span>
                </h2>
                <div className="flex flex-col gap-3">
                  {projects.map((p, i) => (
                    <Row
                      key={p.id}
                      project={p}
                      notes={notes}
                      todayKey={todayKey}
                      rank={i + 1}
                      first={i === 0}
                      last={i === projects.length - 1}
                      onMove={(delta) => {
                        for (const patch of reorder(projects, p.id, delta)) {
                          patchNote(patch.id, { order: patch.order });
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            ),
          )
        )}
      </main>

      <Footer />
    </div>
  );
}

function Row({
  project,
  notes,
  todayKey,
  rank,
  first,
  last,
  onMove,
}: {
  project: Note;
  notes: Note[];
  todayKey: string;
  rank: number;
  first: boolean;
  last: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  const { colorOf, patchNote } = useNoella();
  const color = colorOf(project);
  const steps = stepsOf(notes, project.id);
  const { done, total } = progressOf(steps);
  const next = nextActionOf(steps);
  const onColor = color !== null;

  return (
    <article
      className={`border border-rule px-5 py-4 ${onColor ? "" : "bg-field"}`}
      style={onColor ? { backgroundColor: color.hex, color: "#111111" } : undefined}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="label tabular-nums opacity-55">
          {String(rank).padStart(2, "0")}
        </span>
        <h3 className="prose-note text-[17px] leading-snug">
          {projectTitle(project)}
        </h3>
        {total > 0 && (
          <span className="label ml-auto flex items-center gap-2 opacity-70">
            <Progress done={done} total={total} onColor={onColor} />
            <span className="tabular-nums">
              {done}/{total}
            </span>
          </span>
        )}
      </div>

      {next ? (
        // The one thing that moves this project — the most important line on
        // the row, so it reads as content rather than chrome.
        <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="label opacity-55">Next</span>
          <span className="prose-note text-[16px] leading-snug">
            {next.body}
          </span>
        </p>
      ) : (
        <p className="label mt-3 opacity-60">
          {total === 0 ? "No steps yet" : "All steps done"}
        </p>
      )}

      <div className="label mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 opacity-70">
        <span>{stamp(project.createdAt)}</span>
        {todayKey && (
          <>
            <span aria-hidden>·</span>
            <span>{quietDays(notes, project, todayKey)}d quiet</span>
          </>
        )}
        <span aria-hidden>·</span>
        {project.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          {project.projectStatus === "active" && rank === 1 && (
            <span
              className={`label px-2 py-1 ${
                onColor ? "bg-[#111] text-white" : "bg-ink text-paper"
              }`}
            >
              Today
            </span>
          )}
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={first}
            aria-label={`Move ${projectTitle(project)} up`}
            className={`label border border-current px-2 py-1 disabled:opacity-30 ${
              onColor
                ? "enabled:hover:bg-[#111] enabled:hover:text-white"
                : "enabled:hover:bg-ink enabled:hover:text-paper"
            }`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={last}
            aria-label={`Move ${projectTitle(project)} down`}
            className={`label border border-current px-2 py-1 disabled:opacity-30 ${
              onColor
                ? "enabled:hover:bg-[#111] enabled:hover:text-white"
                : "enabled:hover:bg-ink enabled:hover:text-paper"
            }`}
          >
            ↓
          </button>
          {PROJECT_STATUSES.filter((s) => s !== project.projectStatus).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patchNote(project.id, { projectStatus: s })}
              className={`label border border-current px-2 py-1 opacity-70 hover:opacity-100 ${
                onColor ? "hover:bg-[#111] hover:text-white" : "hover:bg-ink hover:text-paper"
              }`}
            >
              → {s}
            </button>
          ))}
          <Link
            href={`/wall#note-${project.id}`}
            className={`label border border-current px-2 py-1 hover:opacity-100 ${
              onColor ? "hover:bg-[#111] hover:text-white" : "hover:bg-ink hover:text-paper"
            }`}
          >
            Open
          </Link>
        </span>
      </div>
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

/** Also used by Today, so the status ranking stays in one place. */
export type { ProjectStatus };
