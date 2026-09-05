"use client";

import { useState } from "react";
import { PROJECT_STATUSES, progressOf, type ProjectStatus } from "@/lib/projects";
import { reorder } from "@/lib/order";
import { useNoella } from "@/lib/store/provider";
import { countChildren } from "@/lib/tree";
import type { Note } from "@/lib/types";

/**
 * The execution half of a project card: where it stands, how far along, the
 * steps in order, and the one thing to do next.
 */
export function ProjectPanel({
  project,
  steps,
  onColor,
  showContents = true,
}: {
  project: Note;
  steps: Note[];
  /** Cards on a colour draw in their computed ink; plain cards use tokens. */
  onColor: boolean;
  /**
   * False when you are standing inside this project, where its contents are
   * already the cards below. Listing them twice — once as ticky rows, once as
   * cards — was the single most confusing thing on the screen.
   */
  showContents?: boolean;
}) {
  const { notes, addNote, patchNote, removeNote } = useNoella();
  const [draft, setDraft] = useState("");

  const status = project.projectStatus as ProjectStatus;
  const { done, total } = progressOf(steps);
  const spent = steps.reduce((n, s) => n + (s.actualMinutes ?? 0), 0);

  function addStep() {
    const body = draft.trim();
    if (!body) return;
    addNote({ body, colorId: project.colorId, parentId: project.id });
    setDraft("");
  }

  const line = onColor ? "border-current/30" : "border-rule-soft";

  return (
    <div className={`mt-4 border-t ${line} pt-4`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="label opacity-60">Status</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {PROJECT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patchNote(project.id, { projectStatus: s })}
              aria-pressed={s === status}
              className={`label border border-current px-2 py-1 ${
                s === status
                  ? onColor
                    ? "bg-[var(--on)] text-[var(--on-inv)]"
                    : "bg-ink text-paper"
                  : "opacity-55 hover:opacity-100"
              }`}
            >
              {s}
            </button>
          ))}
        </span>

        {total > 0 && (
          <span className="label ml-auto flex items-center gap-2 opacity-70">
            {spent > 0 && <span className="tabular-nums">{spent}m spent</span>}
            <Progress done={done} total={total} onColor={onColor} />
            <span className="tabular-nums">
              {done}/{total}
            </span>
          </span>
        )}
      </div>

      {/* No "next" line here: the checklist is directly below, and the first
          unticked box already says it. It earns its place on the projects
          screen and on Today, where there is no checklist. */}
      {showContents && steps.length > 0 && (
        <ul className={`mt-3 border ${line}`}>
          {steps.map((step, i) => (
            <li
              key={step.id}
              className={`group/step flex items-start gap-3 border-b ${line} px-3 py-2.5 last:border-b-0`}
            >
              {/*
                A tick box only on things that can be ticked.
                
                A project can hold notes and screenshots and sub-folders now,
                and drawing an empty checkbox beside "Cave Sniper" said it was
                a job you had not done. A container gets a marker instead.
              */}
              {step.isTask ? (
                <button
                  type="button"
                  onClick={() =>
                    patchNote(step.id, {
                      doneAt: step.doneAt ? null : new Date().toISOString(),
                    })
                  }
                  aria-label={
                    step.doneAt ? "Mark step not done" : "Mark step done"
                  }
                  className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center border border-current text-[10px] leading-none"
                >
                  {step.doneAt ? "×" : ""}
                </button>
              ) : (
                <span
                  aria-hidden
                  className="label mt-0.5 grid h-4 w-4 shrink-0 place-items-center opacity-50"
                >
                  {countChildren(notes, step.id) > 0 ? "›" : "·"}
                </span>
              )}
              <span
                className={`flex-1 text-[15px] leading-snug ${
                  step.doneAt ? "line-through opacity-50" : ""
                }`}
              >
                {step.body}
              </span>
              {step.actualMinutes !== null && (
                <span className="label shrink-0 tabular-nums opacity-50">
                  {step.actualMinutes}m
                </span>
              )}
              <span className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover/step:opacity-70 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    for (const patch of reorder(steps, step.id, -1)) {
                      patchNote(patch.id, { order: patch.order });
                    }
                  }}
                  disabled={i === 0}
                  aria-label="Move step up"
                  className="label disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => {
                    for (const patch of reorder(steps, step.id, 1)) {
                      patchNote(patch.id, { order: patch.order });
                    }
                  }}
                  disabled={i === steps.length - 1}
                  aria-label="Move step down"
                  className="label disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeNote(step.id)}
                  className="label underline decoration-1 underline-offset-2"
                >
                  Del
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showContents && (
        <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addStep();
            }
          }}
          placeholder="Next step, then Enter"
          aria-label={`Add a step to ${project.body.split("\n")[0]}`}
          className={`flex-1 border ${line} bg-transparent px-3 py-2 text-[15px]
                      outline-none placeholder:opacity-55`}
        />
        <button
          type="button"
          onClick={addStep}
          disabled={!draft.trim()}
          className={`label border border-current px-2.5 py-2 ${
            onColor
              ? "enabled:hover:bg-[var(--on)] enabled:hover:text-[var(--on-inv)]"
              : "enabled:hover:bg-ink enabled:hover:text-paper"
          } disabled:opacity-40`}
        >
          + Step
        </button>
      </div>
      )}
    </div>
  );
}

/** Flat hairline meter. No rounded ends, no gradient, no animation. */
export function Progress({
  done,
  total,
  onColor,
}: {
  done: number;
  total: number;
  onColor: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span
      className="inline-block h-2.5 w-20 border border-current align-middle"
      role="img"
      aria-label={`${done} of ${total} steps done`}
    >
      <span
        className={`block h-full ${onColor ? "bg-[var(--on)]" : "bg-ink"}`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
