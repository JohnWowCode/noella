"use client";

import { useEffect, useState } from "react";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";

const KEY = "noella.timer";

/** The sizes a next step should ever be. Anything bigger is not a next step. */
export const ESTIMATES = [5, 15, 30, 60] as const;

interface Running {
  stepId: string;
  startedAt: number;
}

function read(): Running | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Running) : null;
  } catch {
    return null;
  }
}

/**
 * A clock for one step.
 *
 * Two ADHD-specific jobs, not one. Starting is the hard part, so the button
 * says five minutes rather than "focus session" — a five minute commitment is
 * cheap enough to say yes to, and starting is nearly all of the battle.
 * Elapsed time is then visible rather than guessed at, because time that is
 * not on screen does not exist.
 *
 * It survives navigation and reload by keeping the start instant in
 * localStorage rather than in React state.
 */
export function Timer({ step, onColor }: { step: Note; onColor: boolean }) {
  const { patchNote } = useNoella();
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(0);

  // Read after mount so the server and first client render agree.
  useEffect(() => {
    let live = true;
    const stored = read();
    Promise.resolve().then(() => {
      if (live) setRunning(stored);
    });
    return () => {
      live = false;
    };
  }, []);

  const active = running?.stepId === step.id ? running : null;

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  function start() {
    const next = { stepId: step.id, startedAt: Date.now() };
    setRunning(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // The clock still runs for this session.
    }
  }

  function stop(): number {
    const minutes = active
      ? Math.max(1, Math.round((Date.now() - active.startedAt) / 60000))
      : 0;
    setRunning(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to clean up.
    }
    return minutes;
  }

  const elapsed = active ? Math.max(0, now - active.startedAt) : 0;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  const button = onColor
    ? "border-current hover:bg-[#111] hover:text-white"
    : "border-rule hover:bg-ink hover:text-paper";

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
      {active ? (
        <>
          {step.estimateMinutes !== null && (
            <span
              className="inline-block h-2.5 w-24 border border-current align-middle"
              role="img"
              aria-label={`${mins} of about ${step.estimateMinutes} minutes`}
            >
              <span
                className={`block h-full ${onColor ? "bg-[#111]" : "bg-ink"}`}
                style={{
                  width: `${Math.min(100, (elapsed / (step.estimateMinutes * 60000)) * 100)}%`,
                }}
              />
            </span>
          )}
          <span className="label tabular-nums">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            {step.estimateMinutes !== null &&
              mins >= step.estimateMinutes &&
              ` · over by ${mins - step.estimateMinutes}m`}
          </span>
          <button
            type="button"
            onClick={() => {
              const minutes = stop();
              patchNote(step.id, {
                actualMinutes: (step.actualMinutes ?? 0) + minutes,
              });
            }}
            className={`label border px-2.5 py-1.5 ${button}`}
          >
            Stop
          </button>
          <button
            type="button"
            onClick={() => {
              const minutes = stop();
              patchNote(step.id, {
                doneAt: new Date().toISOString(),
                actualMinutes: (step.actualMinutes ?? 0) + minutes,
              });
            }}
            className={`label border px-2.5 py-1.5 ${button}`}
          >
            Done
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={start}
          className={`label border px-2.5 py-1.5 ${button}`}
        >
          Start · 5 min
        </button>
      )}

      <span className="label flex items-center gap-1.5 opacity-60">
        {ESTIMATES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() =>
              patchNote(step.id, {
                estimateMinutes: step.estimateMinutes === m ? null : m,
              })
            }
            aria-pressed={step.estimateMinutes === m}
            aria-label={`Estimate ${m} minutes`}
            className={`label border border-current px-1.5 py-1 ${
              step.estimateMinutes === m
                ? onColor
                  ? "bg-[#111] text-white opacity-100"
                  : "bg-ink text-paper opacity-100"
                : "hover:opacity-100"
            }`}
          >
            {m}m
          </button>
        ))}
      </span>

      {step.actualMinutes !== null && (
        <span className="label ml-auto tabular-nums opacity-60">
          {step.actualMinutes}m spent
          {step.estimateMinutes !== null &&
            ` · guessed ${step.estimateMinutes}m`}
        </span>
      )}
    </div>
  );
}
