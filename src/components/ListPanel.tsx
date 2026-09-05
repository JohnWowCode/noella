"use client";

import { useState } from "react";
import { fromKey, useTodayKey } from "@/lib/clock";
import {
  CADENCES,
  daysLeftInPeriod,
  describeCadence,
  formatMoney,
  isSettled,
  listState,
} from "@/lib/recurrence";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";

/**
 * A list, and — if you give it a cadence — a recurring one.
 *
 * Bills used to be their own kind of note with their own screen. They are not:
 * a bill is a thing on a list that comes back every month. Giving a list a
 * cadence covers rent as easily as it covers a weekly tidy, and it deleted a
 * whole tab.
 *
 * Ticked items sink rather than vanish, so a list you are working through
 * shows that you are working through it.
 */
export function ListPanel({
  list,
  items,
  onColor,
  showContents = true,
}: {
  list: Note;
  items: Note[];
  onColor: boolean;
  /** False inside the list, where the items are already the cards below. */
  showContents?: boolean;
}) {
  const { addNote, patchNote, removeNote, settings } = useNoella();
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const todayKey = useTodayKey();

  const edge = onColor ? "border-current/25" : "border-rule-soft";
  const today = todayKey ? fromKey(todayKey) : new Date();
  const cadence = list.listCadence;
  const state = listState(items, cadence, today);
  const ordered = [...state.open, ...state.settled];

  function add() {
    const body = draft.trim();
    if (!body) return;
    addNote({ body, colorId: list.colorId, parentId: list.id });
    setDraft("");
  }

  /** Real collaboration needs a server; handing someone the text does not. */
  async function copy() {
    const text = [
      list.body.split("\n")[0],
      ...ordered.map(
        (i) =>
          `- [${isSettled(i, cadence, today) ? "x" : " "}] ${i.body}` +
          (i.amount ? ` — ${formatMoney(i.amount, settings.currency)}` : ""),
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked; nothing useful to say about it.
    }
  }

  return (
    <div className={`mt-5 border-t ${edge} pt-5`}>
      <div className="label flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5">
          {CADENCES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                patchNote(list.id, { listCadence: cadence === c ? null : c })
              }
              aria-pressed={cadence === c}
              className={` border border-current px-2 py-1 ${
                cadence === c
                  ? onColor
                    ? "bg-[var(--on)] text-[var(--on-inv)]"
                    : "bg-ink text-paper"
                  : "opacity-45 hover:opacity-100"
              }`}
            >
              {c}
            </button>
          ))}
        </span>

        {state.total > 0 && (
          <span className="tabular-nums opacity-70">
            {formatMoney(state.total, settings.currency)}
            {cadence && ` ${describeCadence(cadence)}`}
          </span>
        )}

        <button
          type="button"
          onClick={copy}
          className={`ml-auto border border-current px-2 py-1 ${
            onColor
              ? "hover:bg-[var(--on)] hover:text-[var(--on-inv)]"
              : "hover:bg-ink hover:text-paper"
          }`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* The satisfying part: how much of this is behind you. */}
      {items.length > 0 && (
        <div className="label mt-4 flex items-center gap-3">
          <span className="h-2 flex-1 overflow-hidden border border-current/30">
            <span
              className={`block h-full ${onColor ? "bg-[var(--on)]" : "bg-ink"}`}
              style={{ width: `${(state.settled.length / items.length) * 100}%` }}
            />
          </span>
          <span className="tabular-nums opacity-70">
            {state.settled.length}/{items.length}
          </span>
          {cadence && state.open.length > 0 && (
            <span className="opacity-55">
              resets in {daysLeftInPeriod(cadence, today)}d
            </span>
          )}
          {cadence && state.open.length === 0 && (
            <span className="opacity-70">all done</span>
          )}
        </div>
      )}

      {showContents && ordered.length > 0 && (
        <ul className={`mt-4 overflow-hidden border ${edge}`}>
          {ordered.map((item, i) => {
            const done = isSettled(item, cadence, today);
            return (
              <li
                key={item.id}
                className={`group/item flex items-center gap-3 border-b ${edge} px-4 py-3 last:border-b-0`}
              >
                <button
                  type="button"
                  onClick={() =>
                    patchNote(item.id, {
                      doneAt: done ? null : new Date().toISOString(),
                    })
                  }
                  aria-label={done ? "Untick" : "Tick"}
                  className={`grid h-5 w-5 shrink-0 place-items-center border text-[11px] leading-none ${
                    done
                      ? onColor
                        ? "border-current bg-[var(--on)] text-[var(--on-inv)]"
                        : "border-ink bg-ink text-paper"
                      : "border-current/50 hover:border-current"
                  }`}
                >
                  {done ? "✓" : ""}
                </button>
                <span
                  className={`flex-1 text-[15px] leading-snug ${
                    done ? "line-through opacity-40" : ""
                  }`}
                >
                  {item.body}
                </span>
                <AmountField item={item} onColor={onColor} />
                <button
                  type="button"
                  onClick={() => removeNote(item.id)}
                  aria-label="Remove item"
                  className="label shrink-0 opacity-0 transition-opacity group-hover/item:opacity-60 hover:!opacity-100 focus:opacity-100"
                >
                  ×
                </button>
                <span className="sr-only">{i + 1}</span>
              </li>
            );
          })}
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
              add();
            }
          }}
          placeholder="Add something, then Enter"
          aria-label={`Add to ${list.body.split("\n")[0]}`}
          className={`flex-1 border ${edge} bg-transparent px-4 py-2.5 text-[15px]
                      outline-none placeholder:opacity-50`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className={`label border border-current px-3 py-2.5 ${
            onColor
              ? "enabled:hover:bg-[var(--on)] enabled:hover:text-[var(--on-inv)]"
              : "enabled:hover:bg-ink enabled:hover:text-paper"
          } disabled:opacity-35`}
        >
          Add
        </button>
      </div>
      )}
    </div>
  );
}

/** Money is optional on any item, and invisible until you give it some. */
function AmountField({ item, onColor }: { item: Note; onColor: boolean }) {
  const { patchNote, settings } = useNoella();
  const [editing, setEditing] = useState(false);

  if (!editing && item.amount === null) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Add an amount"
        className="label shrink-0 opacity-0 transition-opacity group-hover/item:opacity-50 hover:!opacity-100 focus:opacity-100"
      >
        {settings.currency}
      </button>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="label shrink-0 tabular-nums opacity-70 hover:opacity-100"
      >
        {formatMoney(item.amount as number, settings.currency)}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      inputMode="decimal"
      step="0.01"
      defaultValue={item.amount ?? ""}
      onBlur={(e) => {
        const v = e.target.value.trim();
        patchNote(item.id, { amount: v === "" ? null : Number(v) });
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(false);
      }}
      aria-label="Amount"
      className={`w-20 shrink-0 border bg-transparent px-2 py-1 text-right text-[14px] outline-none ${
        onColor ? "border-current/40" : "border-rule-soft"
      }`}
    />
  );
}
