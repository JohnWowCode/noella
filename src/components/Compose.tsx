"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatBytes,
  isVideo,
  mediaFilesFrom,
  isMediaFile,
} from "@/lib/images";
import { swatchName } from "@/lib/store/defaults";
import { Icon, type IconName } from "./Icon";
import { Popover } from "./Popover";
import { useNoella } from "@/lib/store/provider";
import { PRIORITIES, PRIORITY, type Priority } from "@/lib/priority";
import { MARK_GROUPS, markLabel, toggleMark } from "@/lib/stickers";
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
  const [icons, setIcons] = useState<IconName[]>([]);
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
      icons,
      priority,
    };
    if (task) input.isTask = true;
    addNote(input);

    /*
     * Everything that would slow the next one down is left alone.
     *
     * The tick, the colour, the marks and the rank all stay set, because a
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
    if (e.key === "Enter" && !e.shiftKey && !e.altKey && !body.includes("\n")) {
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
         *
         * That floor was eleven rem — a hundred and seventy pixels of blank
         * cream above the fold, the largest empty thing on the screen, held
         * open for a rant that had not been typed yet. Three lines is enough
         * to say "write as much as you like"; the rant makes its own room.
         */
        className="prose-note block min-h-24 w-full resize-none bg-transparent px-4 py-3.5 sm:min-h-32 sm:px-5 sm:py-4
                   text-[calc(21px*var(--type))] leading-[1.5] outline-none placeholder:text-mute"
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
            className="tap shrink-0 px-1 hover:text-ink"
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
        marks button, three ranks, thirty-six colours, a "no world", an
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
          <Icon name="check" size={16} />
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
                <span className="sr-only">
                  File in {c.name ?? "recent folder"}
                </span>
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
          current={<Icon name="swatches" size={15} />}
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

        {/*
          Marks, plural.

          One sticker per note was decoration. These are the reasons — bug,
          money, ship — and a note wears every one that applies, because a bug
          in a game you have to ship is genuinely three things and picking the
          "main" one is a decision with no right answer and a real cost. They
          are the filters on the wall too, so this is also how a note gets
          filed without typing a single #.
        */}
        <Popover
          label="Marks"
          set={icons.length > 0}
          current={
            icons.length > 0 ? (
              <span className="flex items-center gap-1">
                {icons.slice(0, 3).map((m) => (
                  <Icon key={m} name={m} size={16} />
                ))}
              </span>
            ) : (
              <Icon name="tag" size={16} />
            )
          }
        >
          {() => (
            <Marks
              icons={icons}
              onToggle={(mark) => setIcons((prev) => toggleMark(prev, mark))}
              onClear={() => setIcons([])}
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
              <Icon name="flag" size={16} />
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
          <Icon name="clip" size={16} />
        </button>

        <button
          type="button"
          onMouseDown={hold}
          onClick={save}
          disabled={!ready}
          aria-label={parentName ? `Put it in ${parentName}` : "Keep it"}
          /*
           * A thumb-sized square on a phone, an ordinary worded button above
           * it. min-height rather than height, so the desktop version is
           * sized by its own text instead of being stretched to a tap target
           * it does not need.
           */
          /*
           * flex, not grid: a grid container makes the words and the return
           * glyph two separate items and stacks them into two rows, which is
           * why the button was twice as tall as its own text.
           */
          className="label ml-auto flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap border-2 border-ink bg-ink px-3 py-2 text-paper
                     enabled:hover:bg-transparent enabled:hover:text-ink
                     disabled:cursor-not-allowed disabled:border-rule disabled:bg-transparent
                     disabled:text-mute sm:min-h-0 sm:min-w-0 sm:px-4"
        >
          {/*
            Six controls and a worded button do not fit across 375px, so the
            button wrapped onto a line of its own and the box grew a row of
            empty. The words are a desktop luxury; the return glyph says the
            same thing and the label is still on the button for a reader.
          */}
          <span className="hidden sm:inline">
            {parentName ? "Put it in" : "Keep it"} ·
          </span>
          <span>↵</span>
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
      {/* Twelve across is one hue per column, which is the right reading —
          and 12 × 32px does not fit a 390px phone. Six across on small
          screens keeps the bands intact and the swatches thumb-sized. */}
      <span
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(var(--palette-cols, ${hues}), minmax(0, 1fr))`,
        }}
      >
        {colors.map((c, index) => (
          <button
            key={c.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onColorId(c.id === colorId ? null : c.id)}
            aria-pressed={c.id === colorId}
            title={c.name ?? swatchName(index)}
            className={`h-6 w-6 border [@media(hover:none)]:h-8 [@media(hover:none)]:w-8 ${
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

/**
 * The twenty-four, named and grouped.
 *
 * It stays open as you pick, because picking one is rare — you are usually
 * saying "bug, in a game, urgent" — and a panel that closes after each choice
 * turns three marks into three trips. Names are on the rows, not in tooltips:
 * a mark you have to hover to identify is a mark you will never trust.
 */
function Marks({
  icons,
  onToggle,
  onClear,
}: {
  icons: IconName[];
  onToggle: (mark: IconName) => void;
  onClear: () => void;
}) {
  return (
    <span className="flex w-80 flex-col gap-2.5">
      {MARK_GROUPS.map((group) => (
        <span key={group.name} className="flex flex-col gap-1">
          <span className="label text-mute">{group.name}</span>
          <span className="grid grid-cols-3 gap-1">
            {group.icons.map((mark) => {
              const on = icons.includes(mark);
              return (
                <button
                  key={mark}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onToggle(mark)}
                  aria-pressed={on}
                  aria-label={markLabel(mark)}
                  className={`flex items-center gap-1.5 border px-1.5 py-1.5 ${
                    on
                      ? "border-ink bg-ink text-paper"
                      : "border-transparent hover:border-rule"
                  }`}
                >
                  <Icon name={mark} size={16} />
                  <span className="label">{markLabel(mark)}</span>
                </button>
              );
            })}
          </span>
        </span>
      ))}
      {icons.length > 0 && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          className="label border border-rule px-2 py-1.5 text-mute hover:text-ink"
        >
          No marks
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
