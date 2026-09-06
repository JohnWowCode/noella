"use client";

import { useState } from "react";
import {
  CADENCES,
  daysLeftInPeriod,
  isSettled,
  type Cadence,
} from "@/lib/recurrence";
import { reorder } from "@/lib/order";
import { titleOf } from "@/lib/rooms";
import { useNoella } from "@/lib/store/provider";
import { countChildren } from "@/lib/tree";
import type { Note } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * What is inside a note.
 *
 * One panel where there were two — a project panel with a status row and a
 * list panel with a cadence row — because a project and a list were never two
 * things. Anything can hold anything, so anything gets this: a line to add to
 * it, what is in it, and how far through it you are.
 *
 * It sits under the words rather than over them. The old list card opened with
 * three cadence buttons and a "resets in 7d" counter above a single item,
 * which put the machinery of the thing in front of the thing. What you wrote
 * comes first, always; the plumbing is underneath and quiet.
 */
export function Inside({
  note,
  contents,
  onColor,
  showContents = true,
  today,
}: {
  note: Note;
  contents: Note[];
  /** Cards on a colour draw in their computed ink; plain cards use tokens. */
  onColor: boolean;
  /**
   * False when you are standing inside this note, where its contents are
   * already the cards below. Listing them twice — once as rows, once as cards
   * — was the single most confusing thing on the screen.
   */
  showContents?: boolean;
  today: Date;
}) {
  const { notes, addNote, patchNote, removeNote } = useNoella();
  const [draft, setDraft] = useState("");
  const [settings, setSettings] = useState(false);

  const line = onColor ? "border-current/30" : "border-rule-soft";
  const tickable = contents.filter((c) => c.isTask);
  const done = tickable.filter((c) => isSettled(c, note.repeats, today)).length;

  function add() {
    const body = draft.trim();
    if (!body) return;
    /*
     * Whatever you put in inherits the room's colour and lands at the bottom.
     * It is not forced into a checkbox: a room holds sub-rooms, screenshots
     * and paragraphs as readily as it holds jobs, and deciding which at the
     * moment of typing is the friction this app keeps removing.
     */
    addNote({ body, colorId: note.colorId, parentId: note.id });
    setDraft("");
  }

  if (!showContents) return null;

  return (
    <div className={`mt-4 border-t ${line} pt-3`}>
      {contents.length > 0 && (
        <ul className={`border ${line}`}>
          {contents.map((item, i) => (
            <Row
              key={item.id}
              item={item}
              index={i}
              count={contents.length}
              line={line}
              settled={isSettled(item, note.repeats, today)}
              inside={countChildren(notes, item.id)}
              onTick={() =>
                patchNote(item.id, {
                  doneAt: item.doneAt ? null : new Date().toISOString(),
                })
              }
              onMove={(by: 1 | -1) => {
                for (const patch of reorder(contents, item.id, by)) {
                  patchNote(patch.id, { order: patch.order });
                }
              }}
              onRemove={() => removeNote(item.id)}
            />
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add inside, then Enter"
          aria-label={`Add something inside ${titleOf(note)}`}
          className={`min-w-0 flex-1 border ${line} bg-transparent px-3 py-2
                      text-[calc(15px*var(--type))] outline-none placeholder:opacity-55`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add it"
          className={`label grid h-9 w-9 shrink-0 place-items-center border border-current ${
            onColor
              ? "enabled:hover:bg-[var(--on)] enabled:hover:text-[var(--on-inv)]"
              : "enabled:hover:bg-ink enabled:hover:text-paper"
          } disabled:opacity-40`}
        >
          <Icon name="plus" size={15} />
        </button>
      </div>

      {/*
        The machinery, underneath and small.

        Progress and repeating were the loudest things on a list card — three
        cadence buttons and a countdown above one item. They matter, but they
        are about the container rather than about anything in it, so they read
        last and only once there is something to say.
      */}
      {(tickable.length > 0 || note.repeats) && (
        <div className="label mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 opacity-60">
          {tickable.length > 0 && (
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-16 border border-current"
                role="img"
                aria-label={`${done} of ${tickable.length} done`}
              >
                <span
                  className={`block h-full ${onColor ? "bg-[var(--on)]" : "bg-ink"}`}
                  style={{
                    width: `${Math.round((done / tickable.length) * 100)}%`,
                  }}
                />
              </span>
              <span className="tabular-nums">
                {done}/{tickable.length}
              </span>
            </span>
          )}
          {note.repeats && (
            <span className="tabular-nums">
              repeats {note.repeats} · resets in{" "}
              {daysLeftInPeriod(note.repeats, today)}d
            </span>
          )}
          <button
            type="button"
            onClick={() => setSettings((v) => !v)}
            aria-pressed={settings}
            className="ml-auto underline decoration-1 underline-offset-2 hover:no-underline"
          >
            {note.repeats ? "Repeating" : "Repeat?"}
          </button>
        </div>
      )}

      {settings && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {CADENCES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                patchNote(note.id, { repeats: note.repeats === c ? null : c })
              }
              aria-pressed={note.repeats === c}
              className={`label border border-current px-2 py-1 ${
                note.repeats === c
                  ? onColor
                    ? "bg-[var(--on)] text-[var(--on-inv)]"
                    : "bg-ink text-paper"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              {c}
            </button>
          ))}
          <span className="label opacity-55">
            everything inside un-ticks when the period turns
          </span>
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  index,
  count,
  line,
  settled,
  inside,
  onTick,
  onMove,
  onRemove,
}: {
  item: Note;
  index: number;
  count: number;
  line: string;
  settled: boolean;
  inside: number;
  onTick: () => void;
  onMove: (by: 1 | -1) => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={`group/row flex items-start gap-3 border-b ${line} px-3 py-2.5 last:border-b-0`}
    >
      {/*
        A tick box only on things that can be ticked. A room gets a chevron:
        drawing an empty checkbox beside "Cave Sniper" said it was a job you
        had not done, when it is a place you have not opened.
      */}
      {item.isTask ? (
        <button
          type="button"
          onClick={onTick}
          aria-label={settled ? "Not done after all" : "Done"}
          className="tap mt-0.5 grid h-4 w-4 shrink-0 place-items-center border border-current text-[10px] leading-none"
        >
          {settled ? "×" : ""}
        </button>
      ) : (
        <span
          aria-hidden
          className="mt-1 grid h-4 w-4 shrink-0 place-items-center opacity-45"
        >
          <Icon
            name={inside > 0 ? "chevron" : "ring"}
            size={inside > 0 ? 11 : 6}
          />
        </span>
      )}
      <span
        className={`min-w-0 flex-1 text-[calc(15px*var(--type))] leading-snug ${
          settled ? "line-through opacity-50" : ""
        }`}
      >
        {titleOf(item)}
      </span>
      {inside > 0 && (
        <span className="label mt-0.5 shrink-0 tabular-nums opacity-50">
          {inside}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-2 opacity-0 group-hover/row:opacity-70 focus-within:opacity-100 [@media(hover:none)]:opacity-50">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Move up"
          className="tap label px-1 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          aria-label="Move down"
          className="tap label px-1 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete"
          className="tap label px-1 underline decoration-1 underline-offset-2"
        >
          Del
        </button>
      </span>
    </li>
  );
}

export type { Cadence };
