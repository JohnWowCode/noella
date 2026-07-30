"use client";

import { useEffect, useRef, useState } from "react";
import { seqLabel, stamp } from "@/lib/format";
import { wordCount } from "@/lib/notes";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";

interface Props {
  note: Note;
  /** Highlight terms from the live query. */
  query?: string;
  onEnterWorld?: (colorId: string) => void;
  onTag?: (tag: string) => void;
}

export function NoteCard({ note, query = "", onEnterWorld, onTag }: Props) {
  const { colorOf, patchNote, removeNote } = useNoella();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const color = colorOf(note);
  const done = note.doneAt !== null;

  useEffect(() => {
    if (editing) {
      const el = areaRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== note.body) patchNote(note.id, { body: next });
    else setDraft(note.body);
  }

  // Colour is a flat full fill, and #111 always clears contrast on it.
  const onColor = color !== null;
  const surface = onColor
    ? { backgroundColor: color.hex, color: "#111111" }
    : undefined;

  return (
    <article
      className={`group border-b border-rule px-4 py-3.5 last:border-b-0 ${
        onColor ? "" : "bg-field"
      }`}
      style={surface}
    >
      <header
        className={`label flex flex-wrap items-center gap-x-2 gap-y-1 ${
          onColor ? "opacity-70" : "text-mute"
        }`}
      >
        {note.isTask && (
          <button
            type="button"
            onClick={() =>
              patchNote(note.id, {
                doneAt: done ? null : new Date().toISOString(),
              })
            }
            aria-label={done ? "Mark not done" : "Mark done"}
            className="mr-1 grid h-4 w-4 place-items-center border border-current text-[10px] leading-none"
          >
            {done ? "×" : ""}
          </button>
        )}
        <span>{seqLabel(note.seq)}</span>
        <Dot />
        <span>{note.visibility}</span>
        <Dot />
        <span>{wordCount(note.body)} words</span>
        <Dot />
        <span>{stamp(note.createdAt)}</span>
        {note.pinned && (
          <>
            <Dot />
            <span>pinned</span>
          </>
        )}

        <span
          data-card-actions
          className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        >
          <Action onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </Action>
          <Action onClick={() => patchNote(note.id, { pinned: !note.pinned })}>
            {note.pinned ? "Unpin" : "Pin"}
          </Action>
          <Action
            onClick={() =>
              patchNote(note.id, {
                isTask: !note.isTask,
                doneAt: null,
              })
            }
          >
            {note.isTask ? "Untask" : "Task"}
          </Action>
          <Action onClick={() => removeNote(note.id)}>Del</Action>
        </span>
      </header>

      {editing ? (
        <textarea
          ref={areaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") commit();
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") commit();
          }}
          rows={3}
          className="mt-2 block w-full resize-none border border-current
                     bg-transparent px-2 py-1.5 text-[17px] leading-relaxed outline-none"
        />
      ) : (
        <p
          className={`mt-2 whitespace-pre-wrap text-[17px] leading-relaxed ${
            done ? "line-through opacity-55" : ""
          }`}
        >
          <Highlight text={note.body} query={query} />
        </p>
      )}

      {(note.tags.length > 0 || color !== null) && (
        <footer className="label mt-3 flex flex-wrap items-center gap-1.5">
          {color !== null && onEnterWorld && (
            <button
              type="button"
              onClick={() => onEnterWorld(color.id)}
              className="border border-current px-1.5 py-1 hover:bg-[#111] hover:text-white"
            >
              {color.emoji ? `${color.emoji} ` : ""}
              {color.name ?? "Enter world"}
            </button>
          )}
          {note.tags.map((t) =>
            onTag ? (
              <button
                key={t}
                type="button"
                onClick={() => onTag(t)}
                className={`border border-current px-1.5 py-1 hover:bg-[#111] hover:text-white ${
                  onColor ? "opacity-70" : "text-mute"
                }`}
              >
                #{t}
              </button>
            ) : (
              <span
                key={t}
                className={`border border-current px-1.5 py-1 ${
                  onColor ? "opacity-70" : "text-mute"
                }`}
              >
                #{t}
              </span>
            ),
          )}
        </footer>
      )}
    </article>
  );
}

function Dot() {
  return <span aria-hidden>·</span>;
}

function Action({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="label underline decoration-1 underline-offset-2 hover:no-underline"
    >
      {children}
    </button>
  );
}

/** Match highlighting, drawn as a flat inversion. */
function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return <>{text}</>;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        terms.includes(part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-[color:var(--ink)] text-[color:var(--paper)]"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
