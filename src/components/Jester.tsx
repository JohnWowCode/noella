"use client";

import { useState } from "react";
import { fromKey, useTodayKey } from "@/lib/clock";
import { candidates, pick, type Candidate } from "@/lib/pick";
import { useNoella } from "@/lib/store/provider";
import { Timer } from "./Timer";

/** What he says while handing it over. Never a scolding, never a deadline. */
const LINES = [
  "The cards say this one.",
  "This one. Don't argue with a jester.",
  "Fate has spoken, and fate is not fussy.",
  "Five minutes on this and the day counts.",
  "I drew this one out of the hat.",
  "Do this, then do whatever you like.",
  "The bells picked it, not me.",
];

/**
 * A jester who picks your next thing out of a hat.
 *
 * Ranking is the part that quietly eats an afternoon: the list is right there,
 * you know roughly what matters, and you reorder it instead of starting. So
 * the choice is taken away — but weighted, not flat, so what you ranked first
 * comes up most often and nothing at the bottom is ever truly unreachable.
 *
 * Nothing here writes anything down until you tick the thing off. Spinning
 * again costs nothing, which is the point: the only wrong move is deciding
 * for twenty minutes.
 */
export function Jester() {
  const { notes } = useNoella();
  const todayKey = useTodayKey();
  const [drawn, setDrawn] = useState<Candidate | null>(null);
  const [line, setLine] = useState(LINES[0]);
  const [spinning, setSpinning] = useState(false);

  const today = todayKey ? fromKey(todayKey) : new Date();
  const pool = candidates(notes, today);

  function spin() {
    // Math.random lives in the handler, never in render.
    const next = pick(pool, Math.random());
    setDrawn(next);
    setLine(LINES[Math.floor(Math.random() * LINES.length)]);
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 260);
  }

  // If the drawn thing gets ticked, finished or deleted elsewhere, stop
  // showing it — a card offering a job you already did is the app lying.
  const live = drawn
    ? (notes.find((n) => n.id === drawn.note.id) ?? null)
    : null;
  const showing = live && live.doneAt === null && live.archivedAt === null
    ? { ...drawn!, note: live }
    : null;

  if (pool.length === 0 && showing === null) return null;

  return (
    <section className="border-2 border-ink bg-field">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={spin}
          aria-label="Draw something to do"
          className="flex shrink-0 items-center gap-3 border-r-2 border-ink bg-ink px-4 py-4
                     text-paper hover:bg-transparent hover:text-ink"
        >
          <JesterFace spinning={spinning} />
          <span className="label hidden sm:inline">
            {showing ? "Again" : "Draw"}
          </span>
        </button>

        <div className="min-w-0 flex-1 px-4 py-3.5">
          {showing ? (
            <>
              <p className="label flex flex-wrap items-baseline gap-x-2 text-mute">
                <span>{line}</span>
                <span aria-hidden>·</span>
                <span className="truncate normal-case tracking-normal">
                  {showing.from}
                </span>
              </p>
              <p className="display mt-1.5 text-[21px] sm:text-[25px]">
                {showing.note.body}
              </p>
            </>
          ) : (
            <>
              <p className="label text-mute">
                {pool.length} open · nothing ranked, nothing owed
              </p>
              <p className="display mt-1.5 text-[21px] sm:text-[25px]">
                Can&apos;t choose? Let him choose.
              </p>
            </>
          )}
        </div>
      </div>

      {showing && (
        <div className="border-t border-rule px-4 pt-1 pb-4">
          <Timer step={showing.note} onColor={false} />
        </div>
      )}
    </section>
  );
}

/**
 * Three points, three bells, a face.
 *
 * Drawn rather than set as an emoji so he inherits the ink of whatever he sits
 * on, stays crisp at any size, and looks like part of the app instead of a
 * sticker on it.
 */
function JesterFace({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      className={spinning ? "-rotate-12" : ""}
    >
      {/* The hat: a brim and three horns, each ending in a bell. */}
      <path d="M4 13 L8 4 L12 11 L16 3 L20 11 L24 4 L28 13" />
      <path d="M3.5 13 h25" />
      <circle cx="8" cy="3" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="2" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="24" cy="3" r="1.8" fill="currentColor" stroke="none" />
      {/* The face: two eyes and a grin that reaches the corners. */}
      <path d="M6 13 v9 a10 10 0 0 0 20 0 v-9" />
      <path d="M11 18 v2" />
      <path d="M21 18 v2" />
      <path d="M11 24 q5 4 10 0" />
    </svg>
  );
}
