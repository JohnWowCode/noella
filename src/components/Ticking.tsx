"use client";

import { useEffect, useState } from "react";
import {
  clearRunning,
  minutesSince,
  readRunning,
  type Running,
} from "@/lib/running";
import { useNoella } from "@/lib/store/provider";

/**
 * The clock, when you have wandered off from it.
 *
 * Starting a timer and then leaving the one-thing view used to hide it
 * completely: the clock kept running, honestly and invisibly, while you read
 * the wall for twenty minutes. Which is the whole problem in one behaviour —
 * time you cannot see does not exist, and the thing you were doing stops
 * existing along with it.
 *
 * So it follows you. What is running, how long it has been, one tap back into
 * it and one tap to stop and keep the minutes. It is deliberately a strip and
 * not a card: it is a fact about right now, not a thing to read.
 */
export function Ticking({
  hidden,
  onOpen,
}: {
  /** True while the one-thing view is up — you are looking at the clock. */
  hidden: boolean;
  onOpen: (id: string) => void;
}) {
  const { notes, patchNote } = useNoella();
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(0);

  /*
   * Polled rather than pushed. The clock is started by a component that has no
   * idea this one exists, and may be started in another tab entirely; a second
   * of lag on a bar that counts seconds costs nothing, and there is no state
   * to keep in step.
   */
  useEffect(() => {
    const tick = () => {
      setRunning(readRunning());
      setNow(Date.now());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (hidden || !running) return null;
  const note = notes.find((n) => n.id === running.stepId);
  if (!note) return null;

  const elapsed = Math.max(0, now - running.startedAt);
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const over =
    note.estimateMinutes !== null && mins >= note.estimateMinutes
      ? mins - note.estimateMinutes
      : null;

  return (
    <div
      role="status"
      aria-label="Clock running"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <span className="label shrink-0 tabular-nums">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        {over !== null && (
          <span className="label shrink-0 text-mute">over by {over}m</span>
        )}
        <button
          type="button"
          onClick={() => onOpen(note.id)}
          className="prose-note min-w-0 flex-1 truncate text-left text-[calc(15px*var(--type))]"
        >
          {note.body.split("\n", 1)[0] || "a note"}
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpen(note.id)}
            className="label border border-rule px-2.5 py-2 hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11"
          >
            Back to it
          </button>
          <button
            type="button"
            onClick={() => {
              const minutes = minutesSince(running.startedAt, Date.now());
              clearRunning();
              setRunning(null);
              patchNote(note.id, {
                actualMinutes: (note.actualMinutes ?? 0) + minutes,
              });
            }}
            className="label border border-ink bg-ink px-2.5 py-2 text-paper hover:bg-transparent hover:text-ink [@media(hover:none)]:min-h-11"
          >
            Stop
          </button>
        </span>
      </div>
    </div>
  );
}
