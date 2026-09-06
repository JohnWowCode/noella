"use client";

import { useEffect, useRef, useState } from "react";
import { seqLabel, stamp } from "@/lib/format";
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

  return (
    <article
      id={`note-${note.id}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addImages(imageFilesFrom(e.dataTransfer));
      }}
      className={`group scroll-mt-4 border px-6 py-5 ${
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

      <header
        className={`label flex flex-wrap items-center gap-x-2.5 gap-y-1.5 ${
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
            className="tap mr-1 grid h-4 w-4 place-items-center border border-current text-[10px] leading-none"
          >
            {done ? "×" : ""}
          </button>
        )}
        {/*
          NOTE 0007 is gone from the face of the card. It is a real handle —
          the MCP tools take it, and it is still in the data and the title
          attribute — but it opened every single card with four characters of
          machine noise you never once needed to read.
        */}
        {list ? (
          <>
            <span>
              {note.listCadence ? `${note.listCadence} list` : "list"} ·{" "}
              {steps.length}
            </span>
            <Dot />
          </>
        ) : project ? (
          <>
            <span
              className={
                note.projectStatus === "active"
                  ? onColor
                    ? "bg-[var(--on)] px-1.5 py-0.5 text-[var(--on-inv)]"
                    : "bg-ink px-1.5 py-0.5 text-paper"
                  : ""
              }
            >
              project · {note.projectStatus}
            </span>
            <Dot />
          </>
        ) : (
          // Visibility is identical on every note until sharing ships, so it
          // earns its place on a card only when it is *not* the default.
          note.visibility !== "private" && (
            <>
              <span>{note.visibility}</span>
              <Dot />
            </>
          )
        )}
        {/* Word count and image count both left. A number counting the words
            you can see, above the words you can see, is not information. */}
        {note.priority && (
          <>
            {/*
              On a plain card the chip is the priority colour. On a coloured
              one it cannot be: a red NOW on a red card is red on red, and the
              same went for NEXT on orange. There it takes the card's own ink
              and carries the priority as a small block instead, which reads
              at any pairing.
            */}
            <span
              className={`flex items-center gap-1.5 px-1.5 py-0.5 ${
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
            <Dot />
          </>
        )}
        {/*
          The marks, in the meta row.

          They spent one commit beside the body as a column, which on a
          one-line note put the second mark on a line of its own underneath —
          it read as a glyph that had fallen off the card. They belong up here
          anyway: this row is already everything the note *is* rather than
          anything it says, and four marks cost it no height at all.
        */}
        {marks.length > 0 && (
          <>
            <span className="flex items-center gap-1.5">
              {marks.map((m) => (
                <span key={m} title={markLabel(m)} className="flex">
                  <Icon name={m} size={heading ? 17 : 15} />
                </span>
              ))}
            </span>
            <Dot />
          </>
        )}
        {color && (
          <>
            <span
              aria-hidden
              title={color.name ?? swatchName(colors.indexOf(color))}
              className="h-2.5 w-2.5 shrink-0 border border-current/25"
              style={{ backgroundColor: "var(--accent)" }}
            />
            <Dot />
          </>
        )}
        <span title={seqLabel(note.seq)}>{stamp(note.createdAt)}</span>
        {archived && (
          <>
            <Dot />
            <span>archived</span>
          </>
        )}

        {/*
          Always visible, never on hover.

          Everything on a card used to appear only when the pointer was over
          it, which on a phone means never — and a favourite you cannot see is
          not a favourite. The star and the menu are simply here.
        */}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => patchNote(note.id, { pinned: !note.pinned })}
            aria-pressed={note.pinned}
            aria-label={
              note.pinned ? "Remove from favourites" : "Add to favourites"
            }
            className={`tap grid place-items-center px-1.5 py-1.5 ${
              note.pinned ? "opacity-100" : "opacity-35 hover:opacity-100"
            }`}
          >
            <Icon name={note.pinned ? "starFilled" : "star"} size={15} />
          </button>
          {!heading && onOpen && inside === 0 && (
            <Action onClick={() => onOpen(note.id)}>Open</Action>
          )}
          {/*
            Edit is a double-click on the words, which is where the hand
            already is — on a wall of forty, a button per card for a gesture
            nobody needs told about twice.

            Except on a touch screen, where double-tap means zoom and there is
            no hover to reveal anything. Shipping only the gesture made editing
            unreachable on a phone in one tap, so the button is still here when
            the device cannot hover. CSS decides, not JavaScript: no hydration
            mismatch, and it follows a keyboard being plugged in.
          */}
          {editing ? (
            <Action onClick={() => setEditing(false)}>Done</Action>
          ) : (
            <span className="hidden [@media(hover:none)]:inline">
              <Action onClick={() => setEditing(true)}>Edit</Action>
            </span>
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
      </header>

      {/*
        Everything else, once asked for.

        Nine actions used to sit in the header as nine underlined words, on
        every card, appearing together on hover: Edit Pin Colour Project List
        File Task Archive Del. That is not a card with actions, it is a toolbar
        with a note attached — and picking one meant reading all nine first.
      */}
      {menu && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border border-current/25 px-2 py-2">
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
          className="prose-note mt-3 block w-full resize-none border border-current
                     bg-transparent px-3 py-2 outline-none"
        />
      ) : (
        note.body.length > 0 && (
          <div onDoubleClick={() => setEditing(true)} className="mt-3">
            <p
              className={`prose-note min-w-0 flex-1 whitespace-pre-wrap ${
                heading ? "text-[24px] leading-tight sm:text-[28px]" : ""
              } ${done ? "line-through opacity-55" : ""}`}
            >
              <Highlight text={note.body} query={query} />
            </p>
          </div>
        )
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
                <span className="prose-note min-w-0 flex-1 truncate text-[15px]">
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

function Dot() {
  return <span aria-hidden>·</span>;
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
