"use client";

import { useMemo, useState } from "react";
import { fromKey } from "@/lib/clock";
import { candidates, pick, type Candidate } from "@/lib/pick";
import { PRIORITY, rankOf } from "@/lib/priority";
import { isList, isProject } from "@/lib/projects";
import { markLabel, marksOf } from "@/lib/stickers";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Icon } from "./Icon";
import { Timer } from "./Timer";
import { Today } from "./Today";

/** Rows before the queue folds. Long enough to be a plan, short enough to read. */
const ROWS = 12;

/**
 * The half of the app that is about doing rather than keeping.
 *
 * Ranking used to be five chips above a wall — you filtered to Now, got the
 * same wall with fewer cards on it, and were no closer to starting. Chips are
 * a way of asking a question about a pile; they are not a list you work down.
 *
 * This is the list. Today at the top, because that is the part with an end to
 * it. Then everything else you have ranked, in rank order, one line each, with
 * one tap to promise it or tick it. And the jester, who was a black slab
 * taking ninety pixels to say "can't choose?", is now a button on the queue's
 * own header — the place you are standing when you cannot choose.
 */
export function Work({
  todayKey,
  onOpen,
}: {
  todayKey: string;
  onOpen?: (id: string) => void;
}) {
  const { notes, patchNote } = useNoella();
  const [drawn, setDrawn] = useState<Candidate | null>(null);
  const [line, setLine] = useState("");

  /*
   * Everything open that is not already promised, hardest-wanted first.
   *
   * Ranked things sort by rank; unranked open to-dos come after them, newest
   * first, so a thing you have never triaged is still reachable without having
   * to go and label it before you are allowed to do it.
   */
  const queue = useMemo(() => {
    const rows = notes.filter(
      (n) =>
        n.archivedAt === null &&
        n.doneAt === null &&
        n.priority !== "now" &&
        !isProject(n) &&
        !isList(n) &&
        (n.priority !== null || n.isTask),
    );
    return rows.sort((a, b) => {
      const r = rankOf(a.priority) - rankOf(b.priority);
      if (r !== 0) return r;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes]);

  const [all, setAll] = useState(false);
  const shown = all ? queue : queue.slice(0, ROWS);

  /*
   * What the hat can contain.
   *
   * The weighted pool was built out of project steps, loose to-dos and
   * recurring items — which meant that on a wall of plain ranked notes, which
   * is what most walls are, the jester had nothing to draw and simply did not
   * appear. "Pick a random note" has to be able to pick a note.
   *
   * So the queue tops it up: anything ranked that the weighting did not
   * already know about goes in, wanting it roughly as much as its rank says.
   * The weighting still runs the show where it applies, and the top of your
   * list still comes up most.
   */
  const pool = useMemo(() => {
    const weighted = candidates(
      notes,
      todayKey ? fromKey(todayKey) : new Date(),
    );
    const known = new Set(weighted.map((c) => c.note.id));
    const extra = queue
      .filter((n) => !known.has(n.id))
      .map((n) => ({
        note: n,
        from: "",
        weight: n.priority === "next" ? 6 : n.priority === "later" ? 2 : 3,
      }));
    return [...weighted, ...extra];
  }, [notes, todayKey, queue]);

  // Whatever was drawn, as it stands now — a card offering a job you have
  // already ticked off is the app lying to you.
  const live = drawn
    ? (notes.find((n) => n.id === drawn.note.id) ?? null)
    : null;
  const showing =
    live && live.doneAt === null && live.archivedAt === null
      ? { ...drawn!, note: live }
      : null;

  function draw() {
    // Math.random lives in the handler, never in render.
    const next = pick(pool, Math.random());
    setDrawn(next);
    setLine(LINES[Math.floor(Math.random() * LINES.length)]);
  }

  return (
    <>
      <Today todayKey={todayKey} onOpen={onOpen} />

      {showing && (
        <section className="mt-4 border-2 border-ink bg-field">
          <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3.5">
            <p className="label text-mute">{line}</p>
            {showing.from && (
              <p className="label normal-case tracking-normal text-mute">
                {showing.from}
              </p>
            )}
            <button
              type="button"
              onClick={() => setDrawn(null)}
              className="label ml-auto text-mute hover:text-ink"
            >
              Put it back
            </button>
          </div>
          <p className="display px-4 pt-1.5 text-[21px] sm:text-[25px]">
            {showing.note.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => patchNote(showing.note.id, { priority: "now" })}
              className="label border border-ink bg-ink px-3 py-2 text-paper hover:bg-transparent hover:text-ink"
            >
              Do it today
            </button>
            <button
              type="button"
              onClick={() =>
                patchNote(showing.note.id, { doneAt: new Date().toISOString() })
              }
              className="label border border-rule px-3 py-2 hover:bg-ink hover:text-paper"
            >
              Already done
            </button>
            <button
              type="button"
              onClick={draw}
              className="label border border-rule px-3 py-2 hover:bg-ink hover:text-paper"
            >
              Draw again
            </button>
          </div>
          <div className="border-t border-rule px-4 pt-1 pb-4">
            <Timer step={showing.note} onColor={false} />
          </div>
        </section>
      )}

      {/*
        An empty Work area is a fair thing to see — it means nothing is owed —
        but a blank screen reads as broken, so it says which it is and where
        the rest of your stuff went.
      */}
      {queue.length === 0 && pool.length === 0 && (
        <section className="mt-4 border border-rule bg-field px-6 py-10">
          <p className="display text-[22px] sm:text-[26px]">
            Nothing owed today.
          </p>
          <p className="prose-note mt-3 max-w-md text-[16px] text-mute">
            Anything you rank <strong className="font-semibold">Now</strong>{" "}
            lands at the top here as today&apos;s short list; Next and Later
            queue up underneath it. Everything you have written is on the Wall.
          </p>
        </section>
      )}

      {(queue.length > 0 || pool.length > 0) && (
        <section
          aria-label="Up next"
          className="mt-4 border border-rule bg-field"
        >
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule-soft px-4 py-3">
            <h2 className="title">Up next</h2>
            <span className="label text-mute">{queue.length}</span>
            {pool.length > 0 && (
              <button
                type="button"
                onClick={draw}
                className="label ml-auto flex items-center gap-2 border border-rule px-2.5 py-1.5 hover:bg-ink hover:text-paper"
              >
                <JesterFace />
                {showing ? "Draw again" : "Draw one"}
              </button>
            )}
          </header>

          {queue.length === 0 ? (
            <p className="prose-note px-4 py-5 text-[15px] text-mute">
              Nothing ranked. Anything you mark Next or Later lands here, in
              order.
            </p>
          ) : (
            <ul className="flex flex-col">
              {shown.map((n) => (
                <Row
                  key={n.id}
                  note={n}
                  onToday={() => patchNote(n.id, { priority: "now" })}
                  onTick={() =>
                    patchNote(n.id, { doneAt: new Date().toISOString() })
                  }
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}

          {queue.length > ROWS && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="label w-full border-t border-rule-soft px-4 py-2.5 text-mute hover:bg-ink hover:text-paper"
            >
              {all ? "Fewer" : `${queue.length - ROWS} more`}
            </button>
          )}
        </section>
      )}
    </>
  );
}

/**
 * One line, and the two things you can do to it.
 *
 * Tick, or promise it for today. Everything else about the note — colour,
 * marks, what it lives inside, its whole body — is a tap away on the wall.
 * A queue that shows you all of that is a wall again.
 */
function Row({
  note,
  onToday,
  onTick,
  onOpen,
}: {
  note: Note;
  onToday: () => void;
  onTick: () => void;
  onOpen?: (id: string) => void;
}) {
  const marks = marksOf(note);
  return (
    <li className="group flex items-start gap-3 border-b border-rule-soft px-4 py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={onTick}
        aria-label="Done"
        className="tap mt-[6px] grid h-4 w-4 shrink-0 place-items-center border border-mute hover:border-ink"
      />
      {note.priority && (
        <span
          aria-hidden
          title={PRIORITY[note.priority].label}
          className="mt-[9px] h-2.5 w-2.5 shrink-0"
          style={{ backgroundColor: PRIORITY[note.priority].hex }}
        />
      )}
      <span className="mt-[5px] flex shrink-0 items-center gap-1.5 text-mute">
        {marks.map((m) => (
          <span key={m} title={markLabel(m)} className="flex">
            <Icon name={m} size={15} />
          </span>
        ))}
      </span>
      <button
        type="button"
        onClick={() => onOpen?.(note.id)}
        className="prose-note min-w-0 flex-1 text-left text-[17px] leading-snug"
      >
        {note.body.split("\n", 1)[0]}
      </button>
      <button
        type="button"
        onClick={onToday}
        className="label mt-[3px] shrink-0 border border-rule px-2 py-1 text-mute
                   opacity-0 group-hover:opacity-100 hover:bg-ink hover:text-paper
                   focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      >
        Today
      </button>
    </li>
  );
}

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

/** Three points, three bells, a face. Drawn, so it takes the ink around it. */
function JesterFace() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
    >
      <path d="M4 13 L8 4 L12 11 L16 3 L20 11 L24 4 L28 13" />
      <path d="M3.5 13 h25" />
      <circle cx="8" cy="3" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="2" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="24" cy="3" r="1.8" fill="currentColor" stroke="none" />
      <path d="M6 13 v9 a10 10 0 0 0 20 0 v-9" />
      <path d="M11 24 q5 4 10 0" />
    </svg>
  );
}
