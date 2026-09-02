"use client";

import { useState } from "react";
import { reorder } from "@/lib/order";
import { stepsOf } from "@/lib/projects";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";

/**
 * A plain list.
 *
 * Deliberately less than a project: no status ladder, no drift, no progress
 * meter, and it never reaches Today. A long list presented as a demand is the
 * thing that makes people freeze, so this one makes no demand at all — it is
 * somewhere to put twenty things and forget them until you want them.
 *
 * Ticked items sink to the bottom rather than vanishing, because a list you
 * are working through should show that you are working through it.
 */
export function ListPanel({
  list,
  items,
  onColor,
}: {
  list: Note;
  items: Note[];
  onColor: boolean;
}) {
  const { addNote, patchNote, removeNote } = useNoella();
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const edge = onColor ? "border-current/30" : "border-rule-soft";
  const open = items.filter((i) => i.doneAt === null);
  const done = items.filter((i) => i.doneAt !== null);
  const ordered = [...open, ...done];

  function add() {
    const body = draft.trim();
    if (!body) return;
    addNote({ body, colorId: list.colorId, parentId: list.id });
    setDraft("");
  }

  /**
   * Real collaboration needs a server this app does not have. Handing someone
   * the list as text is the honest version of it, and covers most of what
   * "send this to someone" actually means.
   */
  async function copy() {
    const text = [
      list.body.split("\n")[0],
      ...ordered.map((i) => `- [${i.doneAt ? "x" : " "}] ${i.body}`),
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
    <div className={`mt-4 border-t ${edge} pt-4`}>
      <div className="label flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="opacity-60">
          {open.length} to go
          {done.length > 0 && ` · ${done.length} done`}
        </span>
        <button
          type="button"
          onClick={copy}
          className={`ml-auto border border-current px-2 py-1 ${
            onColor
              ? "hover:bg-[#111] hover:text-white"
              : "hover:bg-ink hover:text-paper"
          }`}
        >
          {copied ? "Copied" : "Copy as text"}
        </button>
      </div>

      {ordered.length > 0 && (
        <ul className={`mt-3 border ${edge}`}>
          {ordered.map((item, i) => (
            <li
              key={item.id}
              className={`group/item flex items-start gap-3 border-b ${edge} px-3 py-2.5 last:border-b-0`}
            >
              <button
                type="button"
                onClick={() =>
                  patchNote(item.id, {
                    doneAt: item.doneAt ? null : new Date().toISOString(),
                  })
                }
                aria-label={item.doneAt ? "Untick item" : "Tick item"}
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center border border-current text-[10px] leading-none"
              >
                {item.doneAt ? "×" : ""}
              </button>
              <span
                className={`flex-1 text-[15px] leading-snug ${
                  item.doneAt ? "line-through opacity-45" : ""
                }`}
              >
                {item.body}
              </span>
              <span className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover/item:opacity-70 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    for (const patch of reorder(ordered, item.id, -1)) {
                      patchNote(patch.id, { order: patch.order });
                    }
                  }}
                  disabled={i === 0}
                  aria-label="Move item up"
                  className="label disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => {
                    for (const patch of reorder(ordered, item.id, 1)) {
                      patchNote(patch.id, { order: patch.order });
                    }
                  }}
                  disabled={i === ordered.length - 1}
                  aria-label="Move item down"
                  className="label disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeNote(item.id)}
                  className="label underline decoration-1 underline-offset-2"
                >
                  Del
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

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
          placeholder="Add an item, then Enter"
          aria-label={`Add to ${list.body.split("\n")[0]}`}
          className={`flex-1 border ${edge} bg-transparent px-3 py-2 text-[15px]
                      outline-none placeholder:opacity-55`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className={`label border border-current px-2.5 py-2 ${
            onColor
              ? "enabled:hover:bg-[#111] enabled:hover:text-white"
              : "enabled:hover:bg-ink enabled:hover:text-paper"
          } disabled:opacity-40`}
        >
          + Item
        </button>
      </div>
    </div>
  );
}

export { stepsOf as itemsOf };
