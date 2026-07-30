"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes, imageFilesFrom, isImageFile } from "@/lib/images";
import { useNoella } from "@/lib/store/provider";
import type { NoteImage } from "@/lib/types";
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
  const { colors, addNote, attachImage } = useNoella();
  const [body, setBody] = useState("");
  const [restored, setRestored] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<NoteImage[]>([]);
  const [busy, setBusy] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function take(files: File[]) {
    const images = files.filter(isImageFile);
    if (images.length === 0) return;
    setBusy((n) => n + images.length);
    for (const file of images) {
      try {
        const meta = await attachImage(file);
        setPending((prev) => [...prev, meta]);
      } catch {
        // Unreadable or unsupported file. Skip it rather than block the note.
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  function save() {
    if (!body.trim() && pending.length === 0) return;
    addNote({ body: body.trim(), colorId, images: pending });
    setBody("");
    setPending([]);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "Enter") {
      e.preventDefault();
      save();
      return;
    }
    // Cmd/Ctrl+1..9 files into a world, ⌘0 clears. These *set* rather than
    // toggle: the colour is sticky between notes, so pressing the same key
    // twice has to keep meaning "this world", not undo it.
    if (mod && /^[0-9]$/.test(e.key)) {
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
  const ready = body.trim().length > 0 || pending.length > 0;

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void take(imageFilesFrom(e.dataTransfer));
      }}
      className={`border bg-field ${dragging ? "border-ink" : "border-rule"}`}
      style={
        focused || dragging
          ? { boxShadow: `5px 5px 0 0 ${selected ? selected.hex : "var(--ink)"}` }
          : undefined
      }
    >
      <textarea
        ref={inputRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(e) => {
          const files = imageFilesFrom(e.clipboardData);
          if (files.length > 0) {
            e.preventDefault();
            void take(files);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={3}
        spellCheck
        placeholder={
          dragging
            ? "Drop the image."
            : "Type the thing. Pick a colour if you feel like it."
        }
        aria-label="New note"
        className="prose-note block w-full resize-none bg-transparent px-6 py-5
                   outline-none placeholder:text-mute"
      />

      {(pending.length > 0 || busy > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-rule px-6 py-4">
          {pending.map((img) => (
            <PendingThumb
              key={img.id}
              image={img}
              onRemove={() =>
                setPending((prev) => prev.filter((p) => p.id !== img.id))
              }
            />
          ))}
          {busy > 0 && (
            <span className="label text-mute">Resizing {busy}…</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-rule px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
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
            className={`label ml-1 border border-rule px-2 py-1.5 ${
              colorId === null ? "bg-ink text-paper" : "text-mute hover:text-ink"
            }`}
          >
            None
          </button>
        </div>

        <div className="label ml-auto flex items-center gap-4 text-mute">
          <span className="hidden lg:inline">⌘1–9 colour · ⌘0 none</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void take(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="label border border-rule px-2 py-1.5 text-ink hover:bg-ink hover:text-paper"
          >
            + Image
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="label border border-rule px-2.5 py-1.5 text-ink
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

function PendingThumb({
  image,
  onRemove,
}: {
  image: NoteImage;
  onRemove: () => void;
}) {
  const { imageUrl } = useNoella();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    imageUrl(image.id).then((next) => {
      if (live) setUrl(next);
    });
    return () => {
      live = false;
    };
  }, [image.id, imageUrl]);

  return (
    <span className="flex items-center gap-2 border border-rule px-2 py-1.5">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-8 w-8 object-cover" />
      )}
      <span className="label text-mute">{formatBytes(image.bytes)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="label px-1 hover:bg-ink hover:text-paper"
      >
        ×
      </button>
    </span>
  );
}
