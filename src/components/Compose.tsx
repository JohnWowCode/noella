"use client";

import { useEffect, useState } from "react";
import { useNoella } from "@/lib/store/provider";
import { Swatch } from "./Swatch";

const DRAFT_KEY = "noella.draft";

function readDraft(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

interface Props {
  /** Sticky colour: consecutive notes in the same world cost one keystroke. */
  colorId: string | null;
  onColorId: (id: string | null) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function Compose({ colorId, onColorId, inputRef }: Props) {
  const { colors, addNote } = useNoella();
  const [body, setBody] = useState("");
  const [restored, setRestored] = useState(false);
  const [focused, setFocused] = useState(false);

  // localStorage is an external system, so the draft is pulled in after mount:
  // the first render matches the server, then the draft lands. The value is
  // captured synchronously, before the persist effect below can clear it.
  useEffect(() => {
    let live = true;
    const saved = readDraft();
    Promise.resolve().then(() => {
      if (!live) return;
      if (saved) setBody(saved);
      setRestored(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // Every keystroke persists the draft. Nothing is ever lost to a closed tab.
  useEffect(() => {
    if (!restored) return;
    try {
      if (body) localStorage.setItem(DRAFT_KEY, body);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage full or blocked; typing still works.
    }
  }, [body, restored]);

  function save() {
    if (!body.trim()) return;
    addNote({ body: body.trim(), colorId });
    setBody("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "Enter") {
      e.preventDefault();
      save();
      return;
    }
    // Cmd/Ctrl+1..8 files into a world, ⌘0 clears. These *set* rather than
    // toggle: the colour is sticky between notes, so pressing the same key
    // twice has to keep meaning "this world", not undo it.
    if (mod && /^[0-8]$/.test(e.key)) {
      if (e.key === "0") {
        e.preventDefault();
        onColorId(null);
        return;
      }
      const target = colors[Number(e.key) - 1];
      if (target) {
        e.preventDefault();
        onColorId(target.id);
      }
      return;
    }
    if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }

  const selected = colors.find((c) => c.id === colorId) ?? null;

  return (
    <section
      className="border border-rule bg-field"
      style={
        focused && selected
          ? { boxShadow: `4px 4px 0 0 ${selected.hex}` }
          : focused
            ? { boxShadow: "4px 4px 0 0 var(--ink)" }
            : undefined
      }
    >
      <textarea
        ref={inputRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={3}
        spellCheck
        placeholder="Type the thing. Pick a colour if you feel like it."
        aria-label="New note"
        className="block w-full resize-none bg-transparent px-4 py-3.5 text-[17px] leading-relaxed
                   outline-none placeholder:text-mute"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          {colors.map((c, i) => (
            <Swatch
              key={c.id}
              color={c}
              index={i}
              selected={c.id === colorId}
              onSelect={() => onColorId(c.id === colorId ? null : c.id)}
              size="sm"
              purpose="file"
            />
          ))}
          <button
            type="button"
            onClick={() => onColorId(null)}
            aria-pressed={colorId === null}
            title="No colour"
            className={`label ml-1 border border-rule px-1.5 py-1 ${
              colorId === null ? "bg-ink text-paper" : "text-mute hover:text-ink"
            }`}
          >
            None
          </button>
        </div>

        <div className="label ml-auto flex items-center gap-3 text-mute">
          <span className="hidden sm:inline">⌘1–8 colour · ⌘0 none</span>
          <span>{body.trim() ? `${body.trim().length} chars` : "empty"}</span>
          <button
            type="button"
            onClick={save}
            disabled={!body.trim()}
            className="label border border-rule px-2 py-1 text-ink
                       enabled:hover:bg-ink enabled:hover:text-paper
                       disabled:cursor-not-allowed disabled:text-mute"
          >
            ⌘↵ Save
          </button>
        </div>
      </div>
    </section>
  );
}
