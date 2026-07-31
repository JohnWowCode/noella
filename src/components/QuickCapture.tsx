"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { imageFilesFrom, isImageFile } from "@/lib/images";
import { useNoella } from "@/lib/store/provider";
import type { NoteImage } from "@/lib/types";
import { Swatch } from "./Swatch";

const COLOR_KEY = "noella.capture.color";

/**
 * One button, every screen. Capture has to be reachable from Today, Projects
 * and Money too — an idea does not wait until you have navigated to the wall.
 * Opens on `n` anywhere, on the floating button, and on a share from the OS.
 */
export function QuickCapture() {
  const { ready, colors, addNote, attachImage } = useNoella();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [colorId, setColorId] = useState<string | null>(null);
  const [pending, setPending] = useState<NoteImage[]>([]);
  const [busy, setBusy] = useState(0);
  const [saved, setSaved] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // The chosen world is sticky across captures, like it is in the compose box.
  // Read after mount so the first render matches the server.
  useEffect(() => {
    let live = true;
    const stored = (() => {
      try {
        return localStorage.getItem(COLOR_KEY);
      } catch {
        return null;
      }
    })();
    Promise.resolve().then(() => {
      if (live && stored) setColorId(stored);
    });
    return () => {
      live = false;
    };
  }, []);

  const choose = useCallback((id: string | null) => {
    setColorId(id);
    try {
      if (id) localStorage.setItem(COLOR_KEY, id);
      else localStorage.removeItem(COLOR_KEY);
    } catch {
      // Preference just won't persist.
    }
  }, []);

  // Shared in from the OS share sheet as ?title=&text=&url=. Prefill and open.
  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    const shared = [params.get("title"), params.get("text"), params.get("url")]
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!shared) return;
    // Drop the params first, so a refresh cannot capture the same thing twice.
    window.history.replaceState({}, "", window.location.pathname);
    Promise.resolve().then(() => {
      if (!live) return;
      setBody(shared);
      setOpen(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      // On the wall `n` focuses the compose box, which is already the fastest
      // path there; everywhere else it opens this.
      if (e.key === "n" && window.location.pathname !== "/") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) areaRef.current?.focus();
  }, [open]);

  async function take(files: File[]) {
    const images = files.filter(isImageFile);
    if (images.length === 0) return;
    setBusy((n) => n + images.length);
    for (const file of images) {
      try {
        const meta = await attachImage(file);
        setPending((prev) => [...prev, meta]);
      } catch {
        // Skip anything unreadable.
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
    setOpen(false);
    // A brief acknowledgement, because the card may be on another screen.
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  if (!ready) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Capture a note"
          className="label fixed right-5 bottom-5 z-40 border border-rule bg-ink
                     px-4 py-3.5 text-paper hover:bg-paper hover:text-ink sm:right-8 sm:bottom-8"
        >
          + Note
        </button>
      )}

      {saved && (
        <p
          role="status"
          className="label fixed right-5 bottom-5 z-40 border border-rule bg-field
                     px-4 py-3.5 sm:right-8 sm:bottom-8"
        >
          Saved
        </p>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Capture a note"
          className="fixed inset-0 z-50 flex flex-col bg-paper"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void take(imageFilesFrom(e.dataTransfer));
          }}
        >
          <div className="label flex items-center gap-3 border-b border-rule px-5 py-4">
            <span>Capture</span>
            <span className="text-mute">⌘↵ to save · esc to close</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="label ml-auto border border-rule px-2.5 py-1.5 hover:bg-ink hover:text-paper"
            >
              Close
            </button>
          </div>

          <textarea
            ref={areaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={(e) => {
              const files = imageFilesFrom(e.clipboardData);
              if (files.length > 0) {
                e.preventDefault();
                void take(files);
              }
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") setOpen(false);
              if ((e.metaKey || e.ctrlKey) && /^[0-9]$/.test(e.key)) {
                e.preventDefault();
                choose(e.key === "0" ? null : (colors[Number(e.key) - 1]?.id ?? null));
              }
            }}
            placeholder="What is it?"
            aria-label="Note"
            className="prose-note flex-1 resize-none bg-transparent px-5 py-5 text-[20px]
                       outline-none placeholder:text-mute sm:px-8"
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-rule px-5 py-4 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              {colors.map((c, i) => (
                <Swatch
                  key={c.id}
                  color={c}
                  index={i}
                  selected={c.id === colorId}
                  onSelect={() => choose(c.id === colorId ? null : c.id)}
                  size="sm"
                  purpose="file"
                />
              ))}
              <button
                type="button"
                onClick={() => choose(null)}
                aria-pressed={colorId === null}
                className={`label ml-1 border border-rule px-2 py-1.5 ${
                  colorId === null
                    ? "bg-ink text-paper"
                    : "text-mute hover:text-ink"
                }`}
              >
                None
              </button>
            </div>

            <div className="label ml-auto flex items-center gap-3 text-mute">
              {busy > 0 && <span>Resizing {busy}…</span>}
              {pending.length > 0 && <span>{pending.length} attached</span>}
              <button
                type="button"
                onClick={save}
                disabled={!body.trim() && pending.length === 0}
                className="label border border-rule px-3 py-2 text-ink
                           enabled:hover:bg-ink enabled:hover:text-paper
                           disabled:cursor-not-allowed disabled:text-mute"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
