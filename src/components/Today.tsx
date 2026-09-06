"use client";

import { ledger, streak } from "@/lib/momentum";
import { markLabel, marksOf } from "@/lib/stickers";
import { ageOf, todayOf, TOO_MANY } from "@/lib/today";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { useMemo } from "react";
import { Icon } from "./Icon";

/**
 * The only list in Noella you can reach the bottom of.
 *
 * The wall answers "what have I got?", which is a question that never runs
 * out and so never lets you stop. This answers "what did I say I would do
 * today?", which does — and being able to finish is the entire mechanism.
 * Ticking the last one is meant to feel like something, so the block says so
 * and then stays there for the rest of the day rather than vanishing, because
 * a reward that disappears the instant you earn it is not a reward.
 *
 * It never appears on its own. Nothing is on today until you put it there,
 * and an empty Today block standing over an empty day would be the app asking
 * you a question first thing in the morning.
 */
export function Today({
  todayKey,
  onOpen,
}: {
  todayKey: string;
  onOpen?: (id: string) => void;
}) {
  const { notes, patchNote } = useNoella();
  const { open, done, carried, finished } = todayOf(notes, todayKey);
  const run = useMemo(
    () => (todayKey ? streak(ledger(notes, todayKey)) : 0),
    [notes, todayKey],
  );

  if (open.length === 0 && done.length === 0 && carried.length === 0) {
    return null;
  }

  const promised = open.length + done.length + carried.length;
  const left = open.length + carried.length;
  const clear = left === 0 && promised > 0;

  return (
    <section
      aria-label="Today"
      className={`mt-4 border ${clear ? "border-2 border-ink" : "border-rule"} bg-field`}
    >
      {/*
        A rule that fills as the day empties.
        
        No number, no percentage, no ring: a line under the heading that is
        part done and part not. You take it in without reading it, which is
        the only kind of progress display worth having on a screen you are
        trying to work from — and ticking the last thing closes it, which is
        the small thing this app never had.
      */}
      {promised > 0 && (
        <div aria-hidden className="h-[3px] w-full bg-rule-soft">
          <div
            className="h-full bg-ink"
            style={{ width: `${Math.round((done.length / promised) * 100)}%` }}
          />
        </div>
      )}

      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule-soft px-4 py-3">
        <h2 className="title">Today</h2>
        {clear ? (
          <span className="prose-note text-[calc(15px*var(--type))]">
            Done. {done.length} finished
            {finished.length > done.length
              ? `, ${finished.length} altogether`
              : ""}
            .
          </span>
        ) : (
          <span className="label text-mute">
            {left} left
            {done.length > 0 ? ` · ${done.length} done` : ""}
          </span>
        )}
        {/*
          Said, not enforced. Refusing a seventh thing would be the app
          telling you what your day is; being told is the useful part.
        */}
        {/*
          One of two things on the right, never both: how long the run is, or
          that the day is overloaded. A streak is only mentioned once it is
          worth something — two days is a coincidence, three is a run.
        */}
        {!clear && promised > TOO_MANY ? (
          <span className="label ml-auto text-mute">
            {promised} is a lot for one day
          </span>
        ) : (
          run >= 3 && (
            <span className="label ml-auto text-mute tabular-nums">
              {run} days running
            </span>
          )
        )}
      </header>

      <ul className="flex flex-col">
        {carried.map((n) => (
          <Row
            key={n.id}
            note={n}
            days={ageOf(n, todayKey)}
            onTick={() => patchNote(n.id, { doneAt: new Date().toISOString() })}
            onDrop={() => patchNote(n.id, { priority: null })}
            onOpen={onOpen}
          />
        ))}
        {open.map((n) => (
          <Row
            key={n.id}
            note={n}
            days={0}
            onTick={() => patchNote(n.id, { doneAt: new Date().toISOString() })}
            onDrop={() => patchNote(n.id, { priority: null })}
            onOpen={onOpen}
          />
        ))}
        {done.map((n) => (
          <Row
            key={n.id}
            note={n}
            days={0}
            finished
            onTick={() => patchNote(n.id, { doneAt: null })}
            onDrop={() => patchNote(n.id, { priority: null })}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * One promise.
 *
 * The same shape as a card in the wall — tick on the left, marks, the words —
 * so this reads as the same notes rather than a second copy of them, which is
 * what it is: putting something on today does not move it anywhere.
 */
function Row({
  note,
  days,
  finished = false,
  onTick,
  onDrop,
  onOpen,
}: {
  note: Note;
  days: number;
  finished?: boolean;
  onTick: () => void;
  onDrop: () => void;
  onOpen?: (id: string) => void;
}) {
  const marks = marksOf(note);
  return (
    <li className="group flex items-start gap-3 border-b border-rule-soft px-4 py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={onTick}
        aria-label={finished ? "Not done after all" : "Done"}
        className="tap mt-[6px] grid h-4 w-4 shrink-0 place-items-center border border-mute text-[11px] leading-none hover:border-ink"
      >
        {finished ? "×" : ""}
      </button>

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
        className={`prose-note min-w-0 flex-1 text-left text-[calc(17px*var(--type))] leading-snug ${
          finished ? "text-mute line-through" : ""
        }`}
      >
        {note.body.split("\n", 1)[0]}
      </button>

      {/*
        How long it has been sitting there, and one tap to stop pretending.
        Not a scolding and not a red badge — a number and a way out, because
        the thing that kills a list like this is being unable to say no to it
        without feeling like you failed.
      */}
      {days > 0 && (
        <span className="label mt-[6px] shrink-0 text-mute tabular-nums">
          {days}d
        </span>
      )}
      <button
        type="button"
        onClick={onDrop}
        aria-label="Take off today"
        title="Take off today"
        className="tap mt-[3px] shrink-0 px-1 text-mute opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
      >
        <Icon name="blocked" size={14} />
      </button>
    </li>
  );
}
