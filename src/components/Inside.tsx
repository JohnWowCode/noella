"use client";

import { useState } from "react";
import {
  CADENCES,
  daysLeftInPeriod,
  isSettled,
  type Cadence,
} from "@/lib/recurrence";
import { reorder } from "@/lib/order";
import { contentsOf, titleOf } from "@/lib/rooms";
import { marksOf } from "@/lib/stickers";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * What is inside, as something you can walk.
 *
 * This was a list you could not use. A row showed a name that was not a
 * button and three things you could do: move it up, move it down, delete it.
 * So the only easy action on a folder full of folders was destroying one, and
 * getting *into* one meant going somewhere else and finding its card. Making
 * folders inside folders — the thing this app is for — was the one thing it
 * was worst at.
 *
 * It is a tree now. The name opens it. A chevron unfolds it in place, as deep
 * as you have nested, so you can see and reach the whole shape from wherever
 * you are standing. Delete is gone from here entirely: it lives on the card,
 * behind a menu, like every other destructive thing, instead of being the
 * most prominent control on a list of your work.
 */
export function Inside({
  note,
  contents,
  onColor,
  showContents = true,
  today,
  onOpen,
}: {
  note: Note;
  contents: Note[];
  /** Cards on a colour draw in their computed ink; plain cards use tokens. */
  onColor: boolean;
  /**
   * False when you are standing inside this note, where its contents are
   * already the cards below.
   */
  showContents?: boolean;
  today: Date;
  onOpen?: (id: string) => void;
}) {
  const { notes, addNote, patchNote } = useNoella();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [settings, setSettings] = useState(false);

  const line = onColor ? "border-current/30" : "border-rule-soft";
  const tickable = contents.filter((c) => c.isTask);
  const done = tickable.filter((c) => isSettled(c, note.repeats, today)).length;

  function add() {
    const body = draft.trim();
    if (!body) return;
    addNote({ body, colorId: note.colorId, parentId: note.id });
    setDraft("");
  }

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!showContents) return null;

  return (
    <div className={`mt-4 border-t ${line} pt-3`}>
      {contents.length > 0 && (
        <ul className={`border ${line}`}>
          {contents.map((item, i) => (
            <Branch
              key={item.id}
              item={item}
              siblings={contents}
              index={i}
              depth={0}
              line={line}
              repeats={note.repeats}
              today={today}
              open={open}
              onToggle={toggle}
              onOpen={onOpen}
              notes={notes}
              patchNote={patchNote}
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
        The machinery, underneath and small. It is about the container rather
        than about anything in it, so it reads last and only when there is
        something to say.
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

/** How far in a row is allowed to indent before it stops being readable. */
const MAX_DEPTH = 4;

function Branch({
  item,
  siblings,
  index,
  depth,
  line,
  repeats,
  today,
  open,
  onToggle,
  onOpen,
  notes,
  patchNote,
}: {
  item: Note;
  siblings: Note[];
  index: number;
  depth: number;
  line: string;
  repeats: Cadence | null;
  today: Date;
  open: Set<string>;
  onToggle: (id: string) => void;
  onOpen?: (id: string) => void;
  notes: Note[];
  patchNote: (id: string, patch: Partial<Note>) => void;
}) {
  const children = contentsOf(notes, item.id);
  const room = children.length > 0;
  const unfolded = room && open.has(item.id);
  const settled = isSettled(item, repeats, today);
  const marks = marksOf(item);

  return (
    <>
      <li
        className={`group/row flex items-start gap-2 border-b ${line} py-2.5 pr-3 last:border-b-0`}
        style={{ paddingLeft: `${12 + Math.min(depth, MAX_DEPTH) * 18}px` }}
      >
        {/*
          The chevron unfolds; the name goes in. Two different verbs, so two
          different targets — collapsing a folder to look at the one below it
          should not move you into it.
        */}
        {room ? (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            aria-expanded={unfolded}
            aria-label={
              unfolded ? `Fold ${titleOf(item)}` : `Unfold ${titleOf(item)}`
            }
            className="tap mt-0.5 grid h-4 w-4 shrink-0 place-items-center opacity-60 hover:opacity-100"
          >
            <span className={unfolded ? "rotate-90" : ""}>
              <Icon name="chevron" size={11} />
            </span>
          </button>
        ) : item.isTask ? (
          <button
            type="button"
            onClick={() =>
              patchNote(item.id, {
                doneAt: item.doneAt ? null : new Date().toISOString(),
              })
            }
            aria-label={settled ? "Not done after all" : "Done"}
            className="tap mt-0.5 grid h-4 w-4 shrink-0 place-items-center border border-current text-[10px] leading-none"
          >
            {settled ? "×" : ""}
          </button>
        ) : (
          <span
            aria-hidden
            className="mt-1 grid h-4 w-4 shrink-0 place-items-center opacity-35"
          >
            <Icon name="ring" size={6} />
          </span>
        )}

        {marks.length > 0 && (
          <span className="mt-0.5 flex shrink-0 items-center gap-1 opacity-70">
            {marks.slice(0, 2).map((m) => (
              <Icon key={m} name={m} size={13} />
            ))}
          </span>
        )}

        {/* The name is the way in. This was a span. */}
        <button
          type="button"
          onClick={() => onOpen?.(item.id)}
          className={`min-w-0 flex-1 text-left text-[calc(15px*var(--type))] leading-snug underline decoration-transparent underline-offset-2 hover:decoration-current ${
            settled ? "line-through opacity-50" : ""
          }`}
        >
          {titleOf(item)}
        </button>

        {room && (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            aria-hidden
            tabIndex={-1}
            className="label mt-0.5 shrink-0 tabular-nums opacity-45 hover:opacity-100"
          >
            {children.length}
          </button>
        )}

        {/*
          Reordering, and nothing else. Delete used to be here, on every row,
          as the loudest thing on offer — it is on the card now, behind the
          menu, with the other things you cannot undo.
        */}
        <span className="flex shrink-0 items-center gap-1 opacity-0 group-hover/row:opacity-60 focus-within:opacity-100 [@media(hover:none)]:opacity-40">
          <button
            type="button"
            onClick={() => {
              for (const patch of reorder(siblings, item.id, -1)) {
                patchNote(patch.id, { order: patch.order });
              }
            }}
            disabled={index === 0}
            aria-label="Move up"
            className="tap label px-1 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => {
              for (const patch of reorder(siblings, item.id, 1)) {
                patchNote(patch.id, { order: patch.order });
              }
            }}
            disabled={index === siblings.length - 1}
            aria-label="Move down"
            className="tap label px-1 disabled:opacity-30"
          >
            ↓
          </button>
        </span>
      </li>

      {unfolded &&
        children.map((child, i) => (
          <Branch
            key={child.id}
            item={child}
            siblings={children}
            index={i}
            depth={depth + 1}
            line={line}
            repeats={item.repeats}
            today={today}
            open={open}
            onToggle={onToggle}
            onOpen={onOpen}
            notes={notes}
            patchNote={patchNote}
          />
        ))}
    </>
  );
}

export type { Cadence };
