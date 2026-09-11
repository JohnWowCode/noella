"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatBytes,
  isVideo,
  mediaFilesFrom,
  isMediaFile,
} from "@/lib/images";
import { SWATCH_FAMILIES, swatchName } from "@/lib/store/defaults";
import { Icon, type IconName } from "./Icon";
import { Mover } from "./Mover";
import { Popover } from "./Popover";
import { useNoella } from "@/lib/store/provider";
import { PRIORITIES, PRIORITY, type Priority } from "@/lib/priority";
import { MARK_GROUPS, markLabel, toggleMark } from "@/lib/stickers";
import type { NewNote, NoteImage } from "@/lib/types";

const DRAFT_KEY = "noella.draft";


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
  /**
   * Opens a note. Used by the folder switch, which makes a thing and then
   * stands you inside it — the only sensible next move after saying "this is
   * going to hold other things".
   */
  onOpen?: (id: string) => void;
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
  onOpen,
}: Props) {
  const { colors, notes, addNote, attachImage } = useNoella();
  const [body, setBody] = useState("");
  const [task, setTask] = useState(false);
  const [restored, setRestored] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<NoteImage[]>([]);
  const [busy, setBusy] = useState(0);
  const [tooBig, setTooBig] = useState(false);
  const [icons, setIcons] = useState<IconName[]>([]);
  const [priority, setPriority] = useState<Priority | null>(null);
  /*
   * Where it is going, and whether it is going to hold things.
   *
   * Both start where you are standing: writing inside a room files into that
   * room, and nothing is a folder until you say so. The destination is not
   * sticky between notes the way the colour and the tick are — a run of
   * thoughts belongs where you are, and silently filing the fourth one
   * somewhere you chose for the first is how notes go missing.
   */
  // Seeded from where you are standing. The box is keyed on the room in the
  // page above, so walking into another one remounts this and reseeds it —
  // there is nothing here to keep in step.
  const [into, setInto] = useState<string | null>(parentId);
  const [holds, setHolds] = useState(false);
  const places = useMemo(
    () => notes.filter((n) => n.archivedAt === null),
    [notes],
  );
  const intoName = into
    ? (notes.find((n) => n.id === into)?.body.split("\n", 1)[0] ?? null)
    : null;
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

  async function save() {
    if (!body.trim() && pending.length === 0) return;
    const input: NewNote = {
      body: body.trim(),
      colorId,
      images: pending,
      parentId: into,
      icons,
      priority,
    };
    if (task) input.isTask = true;
    const made = await addNote(input);

    /*
     * A folder is a note with things in it, so "make it a folder" cannot be a
     * flag — it has to be an act. It puts you inside the thing you just named,
     * with the box already pointed at it, which is what you were going to do
     * next anyway.
     */
    if (holds) {
      setHolds(false);
      setBody("");
      setPending([]);
      onOpen?.(made.id);
      return;
    }

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
      void save();
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
      void save();
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
  /*
   * One swatch, not six.
   *
   * A strip of recently-used colours sat beside the button that opens all
   * fifty of them — six controls to do what one already did, on the row that
   * was pushing the wall off the bottom of the screen. The trigger wears the
   * chosen colour, so nothing is hidden; it is one tap further to change it
   * and one row of phone screen back.
   */
  const chosen = colors.find((c) => c.id === colorId) ?? null;

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
         *
         * Short, though. A hundred pixels of empty box is a hundred pixels of
         * the first screen, and the first screen decides whether the app is
         * worth opening — measured at sixty-five per cent chrome before this.
         */
        className="prose-note block min-h-14 w-full resize-none bg-transparent px-4 py-3.5 sm:min-h-24 sm:px-5 sm:py-4
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
          One swatch, wearing whatever is chosen.

          It used to be a strip of the last few colours used, sitting beside
          the button that opens all of them — six controls doing what one
          already did, on the row that was pushing the wall off the bottom of
          a phone. Nothing is hidden by folding it: the trigger shows the
          choice, and the rest are one tap away.
        */}
        <Popover
          label="Folder colour"
          set={colorId !== null}
          current={
            chosen ? (
              <span
                aria-hidden
                className="h-4 w-4 border border-rule-soft"
                style={{ backgroundColor: chosen.hex }}
              />
            ) : (
              <Icon name="swatches" size={15} />
            )
          }
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

        {/*
          Where it lands, and whether it is a place itself.

          These were two buttons, and two buttons is what pushed this row onto
          a second line — a hundred and twenty pixels of the first screen on a
          phone. They are one question anyway: where does this thing live. So
          one button, and the panel answers both halves.
        */}
        <Popover
          label={intoName ? `Going into ${intoName}` : "Where it goes"}
          set={into !== null || holds}
          current={
            <span className="flex items-center gap-1.5">
              <Icon name={holds ? "folderPlus" : "fileInto"} size={16} />
              {intoName && (
                <span className="label max-w-24 truncate">{intoName}</span>
              )}
            </span>
          }
        >
          {(close) => (
            <div className="flex w-64 flex-col gap-2 sm:w-72">
              <button
                type="button"
                onMouseDown={hold}
                onClick={() => setHolds((v) => !v)}
                aria-pressed={holds}
                className={`label flex items-center gap-2 border px-2.5 py-2 text-left ${
                  holds ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink"
                }`}
              >
                <Icon name="folderPlus" size={15} />
                This one holds things
              </button>
              <p className="prose-note text-[calc(13px*var(--type))] text-mute">
                {holds
                  ? "You will land inside it, ready to fill it."
                  : "Or put it inside something you already have:"}
              </p>
              {!holds && (
                <Mover
                  targets={places}
                  notes={notes}
                  canClear={into !== null}
                  clearLabel="Top of the wall"
                  onPick={(id) => {
                    setInto(id);
                    close();
                  }}
                />
              )}
            </div>
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
          onClick={() => void save()}
          disabled={!ready}
          aria-label={
            holds
              ? "Make the folder"
              : intoName
                ? `Put it in ${intoName}`
                : "Keep it"
          }
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
 * A row per family, dark to light along it.
 *
 * It was one grid whose width was the number of colours divided by three —
 * true when the palette was twelve hues in three shades each, and nonsense
 * once families had their own sizes. Fifty over three is seventeen columns,
 * so the picker drew seventeen columns of twenty-pixel squares and the
 * complaint wrote itself: too many, too cramped, and half of them too alike
 * to tell apart at that size anyway. Nine of the too-alike ones are gone now;
 * the rest are drawn the way the data is actually shaped.
 *
 * A family to a row is also how somebody looks for a colour. Nobody scans a
 * grid for #2E9B54. They look for the greens, and then for a green.
 */
function Palette({
  colorId,
  onColorId,
}: {
  colorId: string | null;
  onColorId: (id: string | null) => void;
}) {
  const { colors } = useNoella();

  /*
   * Grouped by the family each colour belongs to, with anything the palette
   * does not know about — a swatch somebody renamed from a retired default,
   * a colour carried in from another device — gathered at the end rather than
   * dropped. The picker must show every colour the wall holds: one it will
   * not draw is a folder that cannot be reached.
   */
  const byHex = new Map(colors.map((c, index) => [c.hex.toUpperCase(), index]));
  const placed = new Set<string>();
  const rows = SWATCH_FAMILIES.map((family) => ({
    name: family.name,
    swatches: family.hexes.flatMap((hex) => {
      const index = byHex.get(hex.toUpperCase());
      if (index === undefined) return [];
      placed.add(hex.toUpperCase());
      return [{ color: colors[index], index }];
    }),
  })).filter((row) => row.swatches.length > 0);

  const rest = colors
    .map((color, index) => ({ color, index }))
    .filter(({ color }) => !placed.has(color.hex.toUpperCase()));
  if (rest.length > 0) rows.push({ name: "yours", swatches: rest });

  return (
    <span className="flex flex-col gap-2">
      <span className="flex flex-col gap-[3px]">
        {rows.map((row) => (
          <span key={row.name} className="flex gap-[3px]">
            {row.swatches.map(({ color: c, index }) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onColorId(c.id === colorId ? null : c.id)}
                aria-pressed={c.id === colorId}
                title={c.name ?? swatchName(index)}
                className={`h-7 w-7 shrink-0 border [@media(hover:none)]:h-9 [@media(hover:none)]:w-9 ${
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
