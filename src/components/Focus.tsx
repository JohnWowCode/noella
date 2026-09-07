"use client";

import { useEffect } from "react";
import { estimateFactor } from "@/lib/momentum";
import { markLabel, marksOf } from "@/lib/stickers";
import { titleOf } from "@/lib/rooms";
import { useNoella } from "@/lib/store/provider";
import { pathTo } from "@/lib/tree";
import { Icon } from "./Icon";
import { Timer } from "./Timer";

/**
 * One thing, and nothing else.
 *
 * Every piece of this already existed and none of it was reachable. The timer,
 * the four estimate buttons and the minutes-taken field have been in the app
 * for weeks behind a jester's dice roll — so the loop that actually does the
 * work (say how long, start, watch it, see what it really took) could only be
 * entered by accident.
 *
 * The wall is the distraction. That is not a criticism of the wall; it is what
 * a wall is for. But you cannot work from one, so this covers it: the words at
 * a readable measure, the marks, where it lives, a clock, and two ways out.
 * Everything else in the app is still there when you close it.
 */
export function Focus({
  id,
  onClose,
  onOpen,
}: {
  id: string;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { notes, patchNote } = useNoella();
  const note = notes.find((n) => n.id === id) ?? null;

  // Escape is the way out of every other overlay here, so it is the way out
  // of this one. Registered while it is open and nowhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;
      if (e.key === "Escape" && !typing) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The page behind must not scroll while this is over it.
  useEffect(() => {
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = was;
    };
  }, []);

  if (!note) return null;

  const marks = marksOf(note);
  const trail = pathTo(notes, note.id);
  const guesses = estimateFactor(notes);
  const done = note.doneAt !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Working on one thing"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header className="flex items-center gap-3 border-b border-rule-soft px-4 py-3 sm:px-6">
        <span className="label text-mute">Doing this</span>
        {trail.length > 0 && (
          <span className="label truncate text-mute">
            {trail.map((t) => titleOf(t)).join(" › ")}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="label ml-auto border border-rule px-3 py-2.5 hover:bg-ink hover:text-paper"
        >
          Close
        </button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-start gap-3">
          {marks.length > 0 && (
            <span className="mt-2 flex shrink-0 items-center gap-2 text-mute">
              {marks.map((m) => (
                <span key={m} title={markLabel(m)} className="flex">
                  <Icon name={m} size={20} />
                </span>
              ))}
            </span>
          )}
          <p
            className={`prose-note min-w-0 flex-1 [overflow-wrap:anywhere] whitespace-pre-wrap text-[calc(21px*var(--type))] sm:text-[calc(24px*var(--type))] ${
              done ? "line-through opacity-55" : ""
            }`}
          >
            {note.body}
          </p>
        </div>

        <Timer step={note} onColor={false} />

        {/*
          Your own multiplier, once there is enough of it to mean anything.
          Being told that estimates run short is advice about other people;
          being shown that yours run 1.8× is a number you produced.
        */}
        {guesses && (
          <p className="prose-note mt-6 text-[calc(15px*var(--type))] text-mute">
            Across {guesses.samples} timed things, yours take about{" "}
            <strong className="font-semibold">
              {guesses.factor.toFixed(1)}×
            </strong>{" "}
            what you guessed.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-rule-soft pt-6">
          <button
            type="button"
            onClick={() => {
              patchNote(note.id, {
                doneAt: done ? null : new Date().toISOString(),
              });
              if (!done) onClose();
            }}
            className="label border-2 border-ink bg-ink px-4 py-3 text-paper hover:bg-transparent hover:text-ink"
          >
            {done ? "Not done after all" : "Finished"}
          </button>
          <button
            type="button"
            onClick={() => {
              patchNote(note.id, { todayOn: null });
              onClose();
            }}
            className="label border border-rule px-3 py-3 text-mute hover:bg-ink hover:text-paper"
          >
            Not today
          </button>
          <button
            type="button"
            onClick={() => {
              onOpen(note.id);
              onClose();
            }}
            className="label ml-auto border border-rule px-3 py-3 hover:bg-ink hover:text-paper"
          >
            Open it on the wall
          </button>
        </div>
      </div>
    </div>
  );
}
