"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatBytes,
  isVideo,
  mediaFilesFrom,
  isMediaFile,
} from "@/lib/images";
import { swatchName } from "@/lib/store/defaults";
import { useNoella } from "@/lib/store/provider";
import type { NewNote, NoteImage } from "@/lib/types";

const DRAFT_KEY = "noella.draft";

/** What you are writing. Decided here, once, instead of hunted for later. */
const KINDS = [
  { id: "note", label: "Note", hint: "a thought, a scrap, a picture" },
  { id: "task", label: "To do", hint: "one thing to tick off" },
  { id: "project", label: "Project", hint: "a folder with steps" },
  { id: "list", label: "List", hint: "a folder of items" },
] as const;

export type Kind = (typeof KINDS)[number]["id"];

function readDraft(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

interface Props {
  colorId: string | null;
  onColorId: (id: string | null) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  /** The folder this writes into. Null is the top of the wall. */
  parentId?: string | null;
  /** Its name, so the box can say where what you type is going. */
  parentName?: string | null;
}

/**
 * The one place anything gets written.
 *
 * Two things it must never do. It must not make you choose what a thing is
 * after the fact — a project used to require writing a note, hovering the
 * card, opening a menu and finding "Make a project", which on a touch screen
 * was not reachable at all. And it must not move under the pointer: the
 * control row was previously hidden until the textarea had focus, so pressing
 * a colour blurred the textarea, unmounted the row, and the click landed on
 * nothing. Every control here holds focus on mousedown for that reason.
 */
export function Compose({
  colorId,
  onColorId,
  inputRef,
  placeholder,
  parentId = null,
  parentName = null,
}: Props) {
  const { colors, addNote, attachImage } = useNoella();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Kind>("note");
  const [restored, setRestored] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<NoteImage[]>([]);
  const [busy, setBusy] = useState(0);
  const [tooBig, setTooBig] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    const media = files.filter(isMediaFile);
    if (media.length === 0) return;
    setBusy((n) => n + media.length);
    for (const file of media) {
      try {
        const meta = await attachImage(file);
        setPending((prev) => [...prev, meta]);
      } catch {
        // Almost always an oversized clip; say so rather than dropping it
        // silently, which reads as the app being broken.
        setTooBig(true);
        window.setTimeout(() => setTooBig(false), 4000);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  function save() {
    if (!body.trim() && pending.length === 0) return;
    const input: NewNote = {
      body: body.trim(),
      colorId,
      images: pending,
      parentId,
    };
    if (kind === "project") input.projectStatus = "idea";
    if (kind === "list") input.isList = true;
    if (kind === "task") input.isTask = true;
    addNote(input);
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
    if (mod && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (e.key === "0") onColorId(null);
      else onColorId(colors[Number(e.key) - 1]?.id ?? null);
      return;
    }
    if (e.key === "Escape") e.currentTarget.blur();
  }

  /** Keeps the caret where it is, so nothing shifts and no click is lost. */
  const hold = (e: React.MouseEvent) => e.preventDefault();

  const ready = body.trim().length > 0 || pending.length > 0;
  const active = KINDS.find((k) => k.id === kind) ?? KINDS[0];

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
        void take(mediaFilesFrom(e.dataTransfer));
      }}
      className={`border-2 bg-field ${dragging ? "border-ink" : "border-ink/85"}`}
    >
      <div className="flex flex-wrap items-stretch border-b border-rule">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onMouseDown={hold}
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            title={k.hint}
            className={`label flex-1 border-r border-rule px-3 py-3 last:border-r-0 ${
              kind === k.id
                ? "bg-ink text-paper"
                : "text-mute hover:bg-ink/8 hover:text-ink"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <textarea
        ref={inputRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(e) => {
          const files = mediaFilesFrom(e.clipboardData);
          if (files.length > 0) {
            e.preventDefault();
            void take(files);
          }
        }}
        rows={3}
        spellCheck
        placeholder={
          dragging
            ? "Drop it."
            : (placeholder ??
              (parentName
                ? `New ${active.label.toLowerCase()} in ${parentName}`
                : `${active.label} — ${active.hint}`))
        }
        aria-label="New note"
        className="prose-note block w-full resize-none bg-transparent px-5 py-4 text-[19px]
                   outline-none placeholder:text-mute"
      />

      {(pending.length > 0 || busy > 0 || tooBig) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-rule px-5 py-3">
          {pending.map((img) => (
            <PendingThumb
              key={img.id}
              image={img}
              onRemove={() =>
                setPending((prev) => prev.filter((p) => p.id !== img.id))
              }
            />
          ))}
          {busy > 0 && <span className="label text-mute">Adding {busy}…</span>}
          {tooBig && (
            <span role="status" className="label text-mute">
              That file was too big to keep on the device.
            </span>
          )}
        </div>
      )}

      <div className="border-t border-rule px-5 py-4">
        <Palette colorId={colorId} onColorId={onColorId} hold={hold} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void take(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onMouseDown={hold}
            onClick={() => fileRef.current?.click()}
            className="label border border-rule px-3 py-2 hover:bg-ink hover:text-paper"
          >
            Photo or video
          </button>
          <button
            type="button"
            onMouseDown={hold}
            onClick={save}
            disabled={!ready}
            className="label ml-auto border-2 border-ink bg-ink px-4 py-2 text-paper
                       enabled:hover:bg-transparent enabled:hover:text-ink
                       disabled:cursor-not-allowed disabled:border-rule disabled:bg-transparent
                       disabled:text-mute"
          >
            {parentName ? "Put it in" : "Keep it"} · ⌘↵
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Thirty-six worlds as a block, not a row.
 *
 * Laid out twelve across and three down, so each column is one hue in its
 * light, medium and deep form and the whole thing reads as a palette you could
 * pick from rather than a very long line of buttons.
 */
function Palette({
  colorId,
  onColorId,
  hold,
}: {
  colorId: string | null;
  onColorId: (id: string | null) => void;
  hold: (e: React.MouseEvent) => void;
}) {
  const { colors } = useNoella();
  // The store hands them over as twelve mediums, twelve lights, twelve darks.
  // Laid out in rows of twelve, that puts one hue in each column and one
  // intensity in each row without reordering anything.
  const hues = Math.max(1, Math.round(colors.length / 3));

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${hues}, minmax(0, 1fr))` }}
      >
        {colors.map((c, index) => (
          <button
            key={c.id}
            type="button"
            onMouseDown={hold}
            onClick={() => onColorId(c.id === colorId ? null : c.id)}
            aria-pressed={c.id === colorId}
            title={c.name ?? swatchName(index)}
            className={`h-6 w-6 border ${
              c.id === colorId
                ? "border-ink ring-2 ring-ink ring-inset"
                : "border-rule-soft hover:border-ink"
            }`}
            style={{ backgroundColor: c.hex }}
          >
            <span className="sr-only">
              File in {c.name ?? swatchName(index)}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onMouseDown={hold}
        onClick={() => onColorId(null)}
        aria-pressed={colorId === null}
        className={`label border border-rule px-2.5 py-1.5 ${
          colorId === null ? "bg-ink text-paper" : "text-mute hover:text-ink"
        }`}
      >
        No world
      </button>
    </div>
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
      {url &&
        (isVideo(image) ? (
          <video src={url} className="h-8 w-8 bg-black object-cover" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-8 w-8 object-cover" />
        ))}
      <span className="label text-mute">{formatBytes(image.bytes)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="label px-1 hover:bg-ink hover:text-paper"
      >
        ×
      </button>
    </span>
  );
}
