"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatBytes,
  isVideo,
  mediaFilesFrom,
  isMediaFile,
} from "@/lib/images";
import { swatchName } from "@/lib/store/defaults";
import { Popover } from "./Popover";
import { useNoella } from "@/lib/store/provider";
import { PRIORITIES, PRIORITY, type Priority } from "@/lib/priority";
import { STICKERS, isSticker } from "@/lib/stickers";
import type { Color, NewNote, NoteImage } from "@/lib/types";

const DRAFT_KEY = "noella.draft";

/** How many of the colours you actually use sit out in the open. */
const RECENT = 5;

/**
 * The folders you filed something in most recently.
 *
 * Derived from the notes rather than stored: a "recently used" list held in
 * settings would need writing on every save, migrating, and reconciling with
 * a wall that arrived by import. The notes already carry the answer in the
 * order they were written.
 */
function useRecentColors(): Color[] {
  const { notes, colors } = useNoella();
  return useMemo(() => {
    const seen: Color[] = [];
    const ordered = [...notes].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    for (const n of ordered) {
      if (!n.colorId || seen.some((c) => c.id === n.colorId)) continue;
      const hit = colors.find((c) => c.id === n.colorId);
      if (hit) seen.push(hit);
      if (seen.length === RECENT) break;
    }
    return seen;
  }, [notes, colors]);
}

/*
 * There used to be four tabs here: Note, To do, Project, List.
 *
 * They were not four categories. They were two unrelated questions wearing one
 * row — can this be ticked, and how is it tracked — and the second one stopped
 * being structural the moment anything could hold anything. A "project" is a
 * note with a status; a "list" is a note with a cadence. Nothing about either
 * changes what the thing *is*, so asking at the keyboard meant classifying a
 * thought before it had been written.
 *
 * What is left is the only question worth asking that early: is this something
 * to do? And even that is a toggle you can flip afterwards. Whether it becomes
 * a project is offered later, when it has contents and the question means
 * something.
 */

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
  const [task, setTask] = useState(false);
  const [restored, setRestored] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<NoteImage[]>([]);
  const [busy, setBusy] = useState(0);
  const [tooBig, setTooBig] = useState(false);
  const [icon, setIcon] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  /** What you have fired off without leaving the box. */
  const [burst, setBurst] = useState<string[]>([]);
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
      icon,
      priority,
    };
    if (task) input.isTask = true;
    addNote(input);

    /*
     * Everything that would slow the next one down is left alone.
     *
     * The tick, the colour, the sticker and the rank all stay set, because a
     * run of ideas is usually a run of the same kind of idea. Only the words
     * clear and the caret never leaves the box, so a stream of thoughts goes
     * down as fast as it can be typed — and what landed stays visible in the
     * strip below rather than scrolling away unacknowledged.
     */
    setBurst((prev) => [input.body.split("\n")[0], ...prev].slice(0, 4));
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
    /*
     * Enter fires it off, unless you are mid-rant.
     *
     * Shift+Enter always makes a newline, and once the draft contains one,
     * Enter stops saving — otherwise the first paragraph break of a long
     * thought would post half of it. Rapid-firing one-liners is Enter, Enter,
     * Enter; writing a paragraph is untouched.
     */
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.altKey &&
      !body.includes("\n")
    ) {
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
  const selected = colors.find((c) => c.id === colorId) ?? null;
  const recent = useRecentColors();
  /*
   * What sits out in the open: the colours you actually use, plus whatever is
   * chosen right now if it is not already among them. Without that second
   * part, picking something from the full grid would leave nothing on screen
   * showing it had been picked.
   */
  const strip =
    selected && !recent.some((c) => c.id === selected.id)
      ? [selected, ...recent].slice(0, RECENT)
      : recent;


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
        rows={6}
        spellCheck
        placeholder={
          dragging
            ? "Drop it."
            : (placeholder ??
              (parentName ? `Anything, into ${parentName}` : "Anything."))
        }
        aria-label="New note"
        /*
         * min-height, not rows.
         *
         * The base layer sets `field-sizing: content` so the box grows with a
         * rant instead of scrolling inside itself — but that also makes `rows`
         * meaningless, and an empty box collapsed to a couple of lines. A
         * floor gives it presence to start with; growing is unaffected.
         */
        className="prose-note block min-h-44 w-full resize-none bg-transparent px-5 py-5
                   text-[21px] leading-[1.5] outline-none placeholder:text-mute"
      />

      {/*
        Proof it landed.

        Firing off six thoughts in a row and watching the box empty six times
        gives you nothing to hold onto — the notes are real, but they are below
        the fold. These are the last four, newest first, and they clear the
        moment you leave.
      */}
      {/*
        Proof it landed. One line, no boxes — a burst of six thoughts and an
        emptying box gives you nothing to hold onto, but a row of outlined
        fragments was its own small pile of clutter.
      */}
      {burst.length > 0 && (
        <p className="label flex items-baseline gap-2 border-t border-rule px-4 py-2 text-mute">
          <span className="shrink-0">Kept</span>
          <span className="min-w-0 flex-1 truncate normal-case tracking-normal">
            {burst.join(" · ")}
          </span>
          <button
            type="button"
            onMouseDown={hold}
            onClick={() => setBurst([])}
            aria-label="Clear"
            className="shrink-0 hover:text-ink"
          >
            ×
          </button>
        </p>
      )}

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

      {/*
        One row.

        This was forty-seven controls on an empty wall — four kind tabs, a
        sticker button, three ranks, thirty-six colours, a "no world", an
        attach and a save — which is not a box you write in. Each of them is
        one button now, showing what is currently chosen, opening only when
        asked. Nothing was removed; it just stopped standing there.
      */}
      <div className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-3">
        <button
          type="button"
          onMouseDown={hold}
          onClick={() => setTask((v) => !v)}
          aria-pressed={task}
          aria-label="Something to do"
          title="Something to do — you can flip this later"
          className={`grid h-9 w-9 place-items-center border text-[15px] leading-none ${
            task
              ? "border-ink bg-ink text-paper"
              : "border-rule text-mute hover:border-ink hover:text-ink"
          }`}
        >
          ✓
        </button>

        {/*
          The colours you actually use.
          
          Thirty-six is the right number to have and the wrong number to
          choose from every time — in practice a wall lives in four or five.
          The last few used sit here for one tap; the rest are one tap deeper.
          Nothing shows until you have used one, like everything else.
        */}
        {strip.length > 0 && (
          <span className="flex items-center gap-1">
            {strip.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={hold}
                onClick={() => onColorId(c.id === colorId ? null : c.id)}
                aria-pressed={c.id === colorId}
                title={c.name ?? "Recent folder"}
                className={`h-7 w-7 border ${
                  c.id === colorId
                    ? "border-ink ring-2 ring-ink ring-inset"
                    : "border-rule-soft hover:border-ink"
                }`}
                style={{ backgroundColor: c.hex }}
              >
                <span className="sr-only">File in {c.name ?? "recent folder"}</span>
              </button>
            ))}
          </span>
        )}

        {/*
          The trigger means "the other thirty-one", not "the current one".

          It used to show the selected colour, which sat immediately beside the
          same colour in the strip — the same swatch twice, looking like a bug.
          Selection lives in the strip now; this is only the way to the rest.
        */}
        <Popover
          label="All folder colours"
          set={false}
          current={<span className="label">···</span>}
        >
          {(close) => (
            <Palette
              colorId={colorId}
              onColorId={(id) => {
                onColorId(id);
                close();
              }}
            />
          )}
        </Popover>

        <Popover label="Sticker" set={icon !== null} current={icon ?? "☺"}>
          {(close) => (
            <Stickers
              icon={icon}
              onPick={(glyph) => {
                setIcon(glyph);
                close();
              }}
            />
          )}
        </Popover>

        <Popover
          label="Priority"
          set={priority !== null}
          current={
            priority ? (
              <span
                aria-hidden
                className="h-3.5 w-3.5"
                style={{ backgroundColor: PRIORITY[priority].hex }}
              />
            ) : (
              "⚑"
            )
          }
        >
          {(close) => (
            <span className="flex flex-col gap-1">
              {PRIORITIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  onMouseDown={hold}
                  onClick={() => {
                    setPriority(priority === level ? null : level);
                    close();
                  }}
                  className={`label flex items-center gap-2 px-2 py-2 text-left ${
                    priority === level ? "bg-ink text-paper" : "hover:bg-ink/10"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0"
                    style={{ backgroundColor: PRIORITY[level].hex }}
                  />
                  {PRIORITY[level].label}
                  <span className="ml-auto normal-case tracking-normal opacity-55">
                    {PRIORITY[level].hint}
                  </span>
                </button>
              ))}
            </span>
          )}
        </Popover>

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
          aria-label="Add a photo or video"
          title="Add a photo or video"
          className="grid h-9 w-9 place-items-center border border-rule text-[17px] leading-none text-mute hover:border-ink hover:text-ink"
        >
          {/* A plain plus, not a picture emoji: the row sits in the mono
              chrome, and an emoji-presentation glyph renders as a tofu box
              wherever an emoji font is not installed. */}
          +
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
          {parentName ? "Put it in" : "Keep it"} · ↵
        </button>
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
/**
 * Thirty-six worlds, twelve across and three down: one hue per column, one
 * intensity per row. It reads as a palette rather than a very long line of
 * buttons — and it lives behind a swatch now, because thirty-six of anything
 * is not something a writing box should open with.
 */
function Palette({
  colorId,
  onColorId,
}: {
  colorId: string | null;
  onColorId: (id: string | null) => void;
}) {
  const { colors } = useNoella();
  const hues = Math.max(1, Math.round(colors.length / 3));

  return (
    <span className="flex flex-col gap-2">
      <span
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${hues}, minmax(0, 1fr))` }}
      >
        {colors.map((c, index) => (
          <button
            key={c.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
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
      </span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onColorId(null)}
        className={`label border border-rule px-2 py-1.5 ${
          colorId === null ? "bg-ink text-paper" : "text-mute hover:text-ink"
        }`}
      >
        No folder
      </button>
    </span>
  );
}

/** The curated forty, grouped, plus a slot for anything else. */
function Stickers({
  icon,
  onPick,
}: {
  icon: string | null;
  onPick: (glyph: string | null) => void;
}) {
  return (
    <span className="flex flex-col gap-2">
      {STICKERS.map((group) => (
        <span key={group.name} className="flex flex-wrap gap-1">
          {group.icons.map((glyph) => (
            <button
              key={glyph}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(glyph === icon ? null : glyph)}
              aria-pressed={glyph === icon}
              className={`grid h-8 w-8 place-items-center border text-[17px] leading-none ${
                glyph === icon
                  ? "border-ink bg-ink/10"
                  : "border-transparent hover:border-rule"
              }`}
            >
              {glyph}
            </button>
          ))}
        </span>
      ))}
      <input
        onChange={(e) => {
          const value = e.target.value.trim();
          if (isSticker(value)) onPick(value);
        }}
        placeholder="…or any emoji"
        aria-label="Use any emoji as the sticker"
        className="label w-full border border-rule bg-transparent px-2 py-1.5
                   outline-none placeholder:opacity-50"
      />
      {icon && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(null)}
          className="label border border-rule px-2 py-1.5 text-mute hover:text-ink"
        >
          No sticker
        </button>
      )}
    </span>
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
