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
  const { ready, notes } = useNoella();

  const grouped = useMemo(() => {
    const all = projectsOf(notes);
    return PROJECT_STATUSES.map((status) => ({
      status,
      projects: all.filter((p) => p.projectStatus === status),
    }));
  }, [notes]);

  const total = grouped.reduce((n, g) => n + g.projects.length, 0);

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/">Wall</NavLink>
            <NavLink href="/today">Today</NavLink>
            <NavLink href="/money">Bills</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 sm:px-6">
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
                  {projects.map((p) => (
                    <Row key={p.id} project={p} notes={notes} />
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

function Row({ project, notes }: { project: Note; notes: Note[] }) {
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
        <span aria-hidden>·</span>
        {project.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
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
            href={`/#note-${project.id}`}
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
