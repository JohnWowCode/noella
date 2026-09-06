"use client";

import { useEffect, useRef, useState } from "react";
import { seqLabel, stamp } from "@/lib/format";
import {
  configured,
  readDestination,
  send,
  type Destination,
} from "@/lib/send";
import { imageFilesFrom } from "@/lib/images";
import { isList, isProject, projectTitle, stepsOf } from "@/lib/projects";
import { PRIORITIES, PRIORITY } from "@/lib/priority";
import { swatchName } from "@/lib/store/defaults";
import { MARK_GROUPS, markLabel, marksOf, toggleMark } from "@/lib/stickers";
import { countChildren, pathTo, placesFor } from "@/lib/tree";
import { useNoella } from "@/lib/store/provider";
import { ON_COLOR_BUTTON, surfaceStyle } from "@/lib/surface";
import type { Note } from "@/lib/types";
import { Icon } from "./Icon";
import { Lightbox, NoteImages } from "./NoteImages";
import { ListPanel } from "./ListPanel";
import { ProjectPanel } from "./ProjectPanel";

interface Props {
  note: Note;
  /** Highlight terms from the live query. */
  query?: string;
  onTag?: (tag: string) => void;
  /** Step into this note and see what is inside it. */
  onOpen?: (id: string) => void;
  /** The folders above it. Shown on search results, which come from anywhere. */
  path?: Note[];
  /** This is the folder you are standing in, drawn at the top of its own view. */
  heading?: boolean;
}

export function NoteCard({
  note,
  query = "",
  onTag,
  onOpen,
  path,
  heading = false,
}: Props) {
  const { notes, colors, colorOf, patchNote, removeNote, attachImage } =
    useNoella();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [viewing, setViewing] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [recolouring, setRecolouring] = useState(false);
  const [menu, setMenu] = useState(false);
  const [marking, setMarking] = useState(false);
  /*
   * Read on mount rather than in render: it is a device setting in
   * localStorage, and reading storage during render is both impure and a
   * hydration mismatch waiting to happen.
   */
  const [destination, setDestination] = useState<Destination | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const color = colorOf(note);
  const done = note.doneAt !== null;
  const archived = note.archivedAt !== null;
  const project = isProject(note);
  const list = isList(note);
  const steps = project || list ? stepsOf(notes, note.id) : [];
  // Anything can hold anything now, so the count is not about being a project.
  const inside = countChildren(notes, note.id);
  const marks = marksOf(note);
  /*
   * Where this could be filed: any live note except itself and its own
   * descendants. It used to be projects only, which is why there was no way to
   * put a note inside a note.
   */
  const targets = placesFor(notes, note.id);

  useEffect(() => {
    let live = true;
    const stored = readDestination();
    Promise.resolve().then(() => {
      if (live && configured(stored)) setDestination(stored);
    });
    return () => {
      live = false;
    };
  }, [menu]);

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

  // Images can be dropped straight onto an existing card.
  async function addImages(files: File[]) {
    if (files.length === 0) return;
    const added = [];
    for (const file of files) {
      try {
        added.push(await attachImage(file));
      } catch {
        // Skip anything unreadable.
      }
    }
    if (added.length > 0) {
      patchNote(note.id, { images: [...note.images, ...added] });
    }
  }

  // A flat full fill. What reads on it is computed per colour, because the
  // palette now runs from the palest yellow to a near-black violet.
  const onColor = color !== null;
  const surface = onColor ? surfaceStyle(color) : undefined;
  /*
   * One line of the body, to the pixel: 18px at 1.62 is 29px, and the heading
   * variant's 28px at leading-tight is 34px. The two chrome gutters take that
   * height and centre themselves in it, so a 15px icon and an 18px sentence
   * sit on the same optical line instead of the icon riding high.
   */
  const line = heading ? "h-[34px]" : "h-[29px]";

  return (
    <article
      id={`note-${note.id}`}
      /*
       * The reference and the time, on the card rather than in it.
       *
       * Both were on the face: NOTE 0041 went first, and the clock followed
       * it here. The wall is newest-first, so its order already says what the
       * timestamp said, and eighty pixels of every single row was going to a
       * number nobody reads — enough to push most notes onto a second line.
       */
      title={`${seqLabel(note.seq)} · ${stamp(note.createdAt)}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addImages(imageFilesFrom(e.dataTransfer));
      }}
      className={`group scroll-mt-4 border px-4 py-3 sm:px-5 ${
        onColor ? "" : "border-rule bg-field"
      } ${archived ? "opacity-60" : ""}`}
      style={{
        ...surface,
        // A ranked card carries its colour on the edge as well as in the
        // chip, so a column of them can be read down the margin without
        // reading any of the words.
        ...(note.priority
          ? {
              borderLeft: `6px solid ${PRIORITY[note.priority].hex}`,
              // The edge disappears when a red note is ranked Now, so the
              // shadow draws the boundary the border cannot.
              boxShadow: onColor ? "inset 6px 0 0 -5px var(--on)" : undefined,
            }
          : null),
      }}
    >
      {path !== undefined && path.length > 0 && (
        <p
          className={`label mb-2.5 flex flex-wrap items-center gap-1.5 ${
            onColor ? "opacity-65" : "text-mute"
          }`}
        >
          {path.map((step, i) => (
            <span key={step.id} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>›</span>}
              <button
                type="button"
                onClick={() => onOpen?.(step.id)}
                className="max-w-40 truncate underline decoration-1 underline-offset-2 hover:no-underline"
              >
                {projectTitle(step)}
              </button>
            </span>
          ))}
        </p>
      )}

      {/*
        One line, not three.

        The card used to open with a meta row, then a twelve-pixel gap, then
        the words: a one-line note came to 110px tall of which 29 were the
        note. Everything above the sentence was chrome you had already read,
        held apart from the sentence it described — forehead.

        It is one row now. What the note *is* sits in a gutter to the left of
        the words, what you can *do* to it in a gutter to the right, and both
        gutters are exactly one line of body text tall, so a short note is a
        short card and forty of them fit where twenty did.
      */}
      {/*
        Three columns on a desktop, two rows on a phone.

        Measured on a 375px screen: the gutters took 110px, the buttons took
        74, and the sentence — the entire reason the card exists — was left
        with about a hundred, narrow enough that "wowcool.world" was clipped
        mid-word. There is no arrangement of three columns that fits there.

        So below 640px it wraps: the chrome and the actions share one short
        line, the words get the full width underneath. Above it, nothing
        changes. Flex order does the whole thing, so it is one DOM either way
        and the tab order stays the reading order.
      */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 sm:flex-nowrap">
        {/*
          A fixed gutter, so the sentences line up.

          Sized to a tickbox and two marks, which is what most notes carry, so
          the words start at the same x down the whole wall and the eye has one
          edge to run along instead of a ragged one. A note with a rank chip or
          four marks pushes past it — which is the right exception, because
          those are the ones meant to stand out.
        */}
        <span
          className={`label order-1 flex ${line} shrink-0 items-center gap-2 sm:min-w-[4.25rem] ${
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
              className="tap grid h-4 w-4 shrink-0 place-items-center border border-current text-[10px] leading-none"
            >
              {done ? "×" : ""}
            </button>
          )}

          {/* What it is, when it is not simply a note. */}
          {list ? (
            <span className="shrink-0">
              {note.listCadence ? `${note.listCadence} list` : "list"}{" "}
              {steps.length}
            </span>
          ) : project ? (
            <span
              className={`shrink-0 px-1.5 py-0.5 ${
                note.projectStatus === "active"
                  ? onColor
                    ? "bg-[var(--on)] text-[var(--on-inv)]"
                    : "bg-ink text-paper"
                  : "border border-current/35"
              }`}
            >
              project {note.projectStatus}
            </span>
          ) : (
            // Visibility is identical on every note until sharing ships, so
            // it earns its place on a card only when it is not the default.
            note.visibility !== "private" && (
              <span className="shrink-0">{note.visibility}</span>
            )
          )}

          {/*
            On a plain card the chip is the priority colour. On a coloured one
            it cannot be: a red NOW on a red card is red on red, and the same
            went for NEXT on orange. There it takes the card's own ink and
            carries the priority as a small block instead.
          */}
          {note.priority && (
            <span
              className={`flex shrink-0 items-center gap-1.5 px-1.5 py-0.5 ${
                onColor ? "bg-[var(--on)] text-[var(--on-inv)]" : ""
              }`}
              style={
                onColor
                  ? undefined
                  : {
                      backgroundColor: PRIORITY[note.priority].hex,
                      color: "#111111",
                    }
              }
            >
              {onColor && (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0"
                  style={{ backgroundColor: PRIORITY[note.priority].hex }}
                />
              )}
              {PRIORITY[note.priority].label}
            </span>
          )}

          {marks.map((m) => (
            <span key={m} title={markLabel(m)} className="flex shrink-0">
              <Icon name={m} size={heading ? 18 : 16} />
            </span>
          ))}
        </span>

        {editing ? (
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              // Escape and ⌘↵ both put it away; blurring does too. Editing
              // should never be a mode you have to hunt your way out of.
              if (e.key === "Escape") commit();
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") commit();
            }}
            rows={3}
          />
        ) : note.body.length > 0 ? (
          <p
            /*
             * Two ways in, one gesture each.
             *
             * Double-click where the hand already is, for anything with a
             * pointer. On a touch screen double-tap means zoom, so a single
             * tap on the words opens the editor instead — which is a target
             * the width of the card rather than a fourth 23px glyph crowding
             * the star and the menu. Decided at the tap, not at render, so
             * there is no hydration mismatch and it follows a keyboard being
             * plugged in.
             */
            onClick={() => {
              if (window.matchMedia("(hover: none)").matches) setEditing(true);
            }}
            onDoubleClick={() => setEditing(true)}
            className={`prose-note order-3 w-full min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap sm:order-2 sm:w-auto sm:flex-1 ${
              heading ? "text-[calc(24px*var(--type))] leading-tight sm:text-[calc(28px*var(--type))]" : ""
            } ${done ? "line-through opacity-55" : ""}`}
          >
            <Highlight text={note.body} query={query} />
          </p>
        ) : (
          <span className="order-3 flex-1 sm:order-2" />
        )}

        {/*
          Two controls, not four.

          This row was a star, a chevron, an Edit button and a menu — four
          targets inside seventy pixels, which on a phone means four 44px tap
          zones piled on top of each other, each stealing the next one's taps.
          Measured, not guessed: the star was 23px wide and a thumb landing
          fourteen pixels off its centre opened the card instead.

          Favouriting stays on the face because a favourite you cannot see is
          not a favourite. Opening and editing are one tap deeper, in the menu
          where the other nine actions already live. The gap widens on a
          touch screen, where the two hit areas are the size of a thumb.
        */}
        <span
          className={`label order-2 ml-auto flex ${line} shrink-0 items-center gap-1 sm:order-3 [@media(hover:none)]:gap-5 ${
            onColor ? "opacity-70" : "text-mute"
          }`}
        >
          {archived && <span>archived</span>}
          {/*
            Editing is a mode, so it gets the slot rather than a slot of its
            own. Blur, Escape and ⌘↵ all commit as well, but an editor with no
            visible way out reads as something you have broken — and on a
            phone "tap somewhere else" means tapping into another card.
          */}
          {editing ? (
            <Action onClick={() => setEditing(false)}>Done</Action>
          ) : (
            <button
              type="button"
              onClick={() => patchNote(note.id, { pinned: !note.pinned })}
              aria-pressed={note.pinned}
              aria-label={
                note.pinned ? "Remove from favourites" : "Add to favourites"
              }
              className={`tap grid place-items-center px-1.5 ${
                note.pinned ? "opacity-100" : "opacity-35 hover:opacity-100"
              }`}
            >
              <Icon name={note.pinned ? "starFilled" : "star"} size={15} />
            </button>
          )}
          <Action
            onClick={() => {
              setMenu((v) => !v);
              setRecolouring(false);
              setMoving(false);
            }}
            pressed={menu}
            label="More actions"
          >
            <Icon name="more" size={15} />
          </Action>
        </span>
      </div>

      {/*
        Everything else, once asked for.

        Nine actions used to sit in the header as nine underlined words, on
        every card, appearing together on hover: Edit Pin Colour Project List
        File Task Archive Del. That is not a card with actions, it is a toolbar
        with a note attached — and picking one meant reading all nine first.
      */}
      {menu && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border border-current/25 px-2 py-2">
          {!heading && onOpen && (
            <Action onClick={() => onOpen(note.id)}>
              {inside > 0 ? `Open · ${inside}` : "Open"}
            </Action>
          )}
          <Action
            onClick={() => {
              setEditing(true);
              setMenu(false);
            }}
          >
            Edit
          </Action>
          <Action
            onClick={() => {
              setRecolouring((v) => !v);
              setMoving(false);
              setMarking(false);
            }}
            pressed={recolouring}
          >
            Colour
          </Action>
          <Action
            onClick={() => {
              setMarking((v) => !v);
              setRecolouring(false);
              setMoving(false);
            }}
            pressed={marking}
          >
            Marks
          </Action>
          {PRIORITIES.map((level) => (
            <Action
              key={level}
              onClick={() =>
                patchNote(note.id, {
                  priority: note.priority === level ? null : level,
                })
              }
              pressed={note.priority === level}
            >
              {PRIORITY[level].label}
            </Action>
          ))}
          {!list && (
            <Action
              onClick={() =>
                patchNote(note.id, { projectStatus: project ? null : "idea" })
              }
            >
              {project ? "Unproject" : "Make a project"}
            </Action>
          )}
          {!project && (
            <Action onClick={() => patchNote(note.id, { isList: !list })}>
              {list ? "Unlist" : "Make a list"}
            </Action>
          )}
          {!project && targets.length > 0 && (
            <Action
              onClick={() => {
                setMoving((v) => !v);
                setRecolouring(false);
              }}
              pressed={moving}
            >
              Move
            </Action>
          )}
          {!project && (
            <Action
              onClick={() =>
                patchNote(note.id, { isTask: !note.isTask, doneAt: null })
              }
            >
              {note.isTask ? "Untask" : "Task"}
            </Action>
          )}
          {destination && (
            <Action
              onClick={() => {
                setSent("…");
                void send(destination, {
                  id: note.id,
                  ref: seqLabel(note.seq),
                  title: note.body.split("\n", 1)[0],
                  body: note.body,
                  marks,
                  tags: note.tags,
                  priority: note.priority,
                  done: done,
                  createdAt: note.createdAt,
                  url: `${window.location.origin}${window.location.pathname}#note-${note.id}`,
                }).then((r) => {
                  setSent(
                    r.ok
                      ? r.how === "opened"
                        ? "Opened"
                        : "Sent"
                      : r.how === "copied"
                        ? `Copied instead — ${r.why}`
                        : r.why,
                  );
                  window.setTimeout(() => setSent(null), 5000);
                });
              }}
            >
              {sent ?? `Send to ${destination.name}`}
            </Action>
          )}
          <Action
            onClick={() =>
              patchNote(note.id, {
                archivedAt: archived ? null : new Date().toISOString(),
              })
            }
          >
            {archived ? "Restore" : "Archive"}
          </Action>
          <Action
            onClick={() => {
              // Steps go with the project, so say so before it happens.
              if (
                steps.length > 0 &&
                !window.confirm(
                  list
                    ? `Delete this list and its ${steps.length} ${
                        steps.length === 1 ? "item" : "items"
                      }?`
                    : `Delete this project and its ${steps.length} ${
                        steps.length === 1 ? "step" : "steps"
                      }?`,
                )
              ) {
                return;
              }
              removeNote(note.id);
            }}
          >
            Delete
          </Action>
        </div>
      )}

      {marking && (
        <div className="mt-3 border border-current/25 p-2.5">
          {MARK_GROUPS.map((group) => (
            <div key={group.name} className="mb-2.5 last:mb-0">
              <p className="label mb-1 opacity-55">{group.name}</p>
              <div className="flex flex-wrap gap-1">
                {group.icons.map((mark) => {
                  const on = marks.includes(mark);
                  return (
                    <button
                      key={mark}
                      type="button"
                      // Stays open: marks are picked in twos and threes, and
                      // the drawer snapping shut after each one made adding a
                      // second mark feel like a mistake being undone.
                      onClick={() =>
                        patchNote(note.id, {
                          icons: toggleMark(note.icons, mark),
                        })
                      }
                      aria-pressed={on}
                      aria-label={markLabel(mark)}
                      className={`flex items-center gap-1.5 border px-1.5 py-1.5 ${
                        on
                          ? "border-current bg-current/15"
                          : "border-transparent hover:border-current/40"
                      }`}
                    >
                      <Icon name={mark} size={16} />
                      <span className="label">{markLabel(mark)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {recolouring && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Same twelve-by-three block as the compose box, so moving a note
              between folders looks like filing it in the first place. */}
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, Math.round(colors.length / 3))}, minmax(0, 1fr))`,
            }}
          >
            {colors.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  patchNote(note.id, {
                    colorId: c.id === note.colorId ? null : c.id,
                  });
                  setRecolouring(false);
                }}
                aria-label={`File in ${c.name ?? swatchName(i)}`}
                className={`h-6 w-6 border border-current/25 ${
                  c.id === note.colorId ? "ring-2 ring-inset ring-current" : ""
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              patchNote(note.id, { colorId: null });
              setRecolouring(false);
            }}
            className="label border border-current px-2 py-1.5 hover:bg-[var(--on)] hover:text-[var(--on-inv)]"
          >
            None
          </button>
        </div>
      )}

      {moving && (
        <Mover
          note={note}
          targets={targets}
          notes={notes}
          onPick={(parentId) => {
            // Deliberately not touching isTask. Filing something used to make
            // it a checkbox, which was fine when the only destination was a
            // project and the only thing you could file was a step.
            patchNote(note.id, { parentId });
            setMoving(false);
          }}
        />
      )}

      <NoteImages images={note.images} onOpen={setViewing} />

      {project && (
        <ProjectPanel
          project={note}
          steps={steps}
          onColor={onColor}
          showContents={!heading}
        />
      )}

      {list && (
        <ListPanel
          list={note}
          items={steps}
          onColor={onColor}
          showContents={!heading}
        />
      )}

      {/*
        The way in, on every card without exception.
        
        Showing it only where something was already inside meant an empty
        folder could never be filled — you could make "Cave Sniper" and then
        had no way to get into it. Every note can hold notes, so every note
        says so; an empty one says what it is for instead of a count.
      */}
      {/*
        A bar only when there is something behind it.

        Every card carried a full-width outlined Open row, so a wall of plain
        notes was a wall of identical empty bars — the loudest thing on a card
        that had nothing inside. A folder still gets the bar, with its count;
        everything else gets a quiet "Open" in the header row, which is always
        visible anyway and costs the layout nothing.
      */}
      {!heading && onOpen && inside > 0 && (
        <button
          type="button"
          onClick={() => onOpen(note.id)}
          className={`label mt-4 flex w-full items-center gap-2 border px-3 py-2.5 ${
            onColor
              ? `border-current/40 ${ON_COLOR_BUTTON}`
              : "border-rule hover:bg-ink hover:text-paper"
          }`}
        >
          <span>Open</span>
          <span className="tabular-nums opacity-70">{inside} inside</span>
          <Icon name="chevron" size={13} className="ml-auto" />
        </button>
      )}

      {/*
        Tags only, and no boxes.

        The world chip was the loudest thing down here and said the least: the
        card is already that colour, filling the whole thing, so a bordered
        button repeating its name was a label on a label. Tags stayed as
        outlined boxes for the same reason nothing else did — because they
        could be — and a card with four of them read as a form. They are words
        with a hash now, and the colour is reachable from the folder rail where
        it belongs.
      */}
      {note.tags.length > 0 && (
        <footer className="label mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {note.tags.map((t) =>
            onTag ? (
              <button
                key={t}
                type="button"
                onClick={() => onTag(t)}
                className={`underline decoration-1 underline-offset-2 hover:no-underline ${
                  onColor ? "opacity-65" : "text-mute"
                }`}
              >
                #{t}
              </button>
            ) : (
              <span key={t} className={onColor ? "opacity-65" : "text-mute"}>
                #{t}
              </span>
            ),
          )}
        </footer>
      )}

      {viewing !== null && (
        <Lightbox
          images={note.images}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </article>
  );
}

/**
 * Where to put this.
 *
 * The destination list is every live note that is not this one or underneath
 * it — anything can hold anything, so on a real wall that is hundreds of rows.
 * A flat wrap of hundreds of buttons is not a picker, so this is typed into,
 * and each row carries its path because "bugs" means nothing on its own when
 * three folders have one.
 */
function Mover({
  note,
  targets,
  notes,
  onPick,
}: {
  note: Note;
  targets: Note[];
  notes: Note[];
  onPick: (parentId: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const rows = targets
    .map((t) => ({ note: t, path: pathTo(notes, t.id) }))
    .filter(({ note: t, path }) =>
      needle
        ? [t, ...path].some((n) =>
            projectTitle(n).toLowerCase().includes(needle),
          )
        : true,
    )
    .slice(0, 40);

  return (
    <div className="mt-3 border border-current/25 p-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Put it in…"
          aria-label="Search for somewhere to put this"
          className="label min-w-0 flex-1 border border-current/40 bg-transparent px-2 py-1.5
                     outline-none placeholder:opacity-50"
        />
        {note.parentId && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="label shrink-0 border border-current px-2 py-1.5 hover:bg-[var(--on)] hover:text-[var(--on-inv)]"
          >
            Take it out
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="label mt-2 px-1 py-2 opacity-60">Nowhere by that name.</p>
      ) : (
        <ul className="mt-2 max-h-56 overflow-y-auto">
          {rows.map(({ note: t, path }) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t.id)}
                className="flex w-full items-baseline gap-2 px-1.5 py-1.5 text-left hover:bg-current/10"
              >
                <span className="prose-note min-w-0 flex-1 truncate text-[calc(15px*var(--type))]">
                  {projectTitle(t)}
                </span>
                {path.length > 0 && (
                  <span className="label shrink-0 max-w-40 truncate opacity-55">
                    in {projectTitle(path[path.length - 1])}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Action({
  onClick,
  children,
  pressed,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      className={`label px-2 py-1.5 ${
        pressed
          ? "bg-current/15"
          : "opacity-70 hover:bg-current/10 hover:opacity-100"
      }`}
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
