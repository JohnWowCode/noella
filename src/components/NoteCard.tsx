"use client";

import { useEffect, useRef, useState } from "react";
import { seqLabel, stamp } from "@/lib/format";
import { imageFilesFrom } from "@/lib/images";
import { wordCount } from "@/lib/notes";
import { fromKey, useTodayKey } from "@/lib/clock";
import { formatMoney, isBill, newBill } from "@/lib/money";
import { isProject, projectTitle, stepsOf } from "@/lib/projects";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Lightbox, NoteImages } from "./NoteImages";
import { BillPanel } from "./BillPanel";
import { ProjectPanel } from "./ProjectPanel";

interface Props {
  note: Note;
  /** Highlight terms from the live query. */
  query?: string;
  onEnterWorld?: (colorId: string) => void;
  onTag?: (tag: string) => void;
}

export function NoteCard({ note, query = "", onEnterWorld, onTag }: Props) {
  const {
    notes,
    colors,
    colorOf,
    patchNote,
    removeNote,
    attachImage,
    settings,
  } = useNoella();
  const todayKey = useTodayKey();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [viewing, setViewing] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [recolouring, setRecolouring] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const color = colorOf(note);
  const done = note.doneAt !== null;
  const archived = note.archivedAt !== null;
  const project = isProject(note);
  const bill = isBill(note) ? note.bill : null;
  const steps = project ? stepsOf(notes, note.id) : [];
  // Other projects this note could be filed under.
  const targets = notes.filter(
    (n) => isProject(n) && n.id !== note.id && n.archivedAt === null,
  );

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

  // Colour is a flat full fill, and #111 always clears contrast on it.
  const onColor = color !== null;
  const surface = onColor
    ? { backgroundColor: color.hex, color: "#111111" }
    : undefined;

  return (
    <article
      id={`note-${note.id}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addImages(imageFilesFrom(e.dataTransfer));
      }}
      className={`group scroll-mt-4 border border-rule px-6 py-5 ${
        onColor ? "" : "bg-field"
      } ${archived ? "opacity-60" : ""}`}
      style={surface}
    >
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
            className="mr-1 grid h-4 w-4 place-items-center border border-current text-[10px] leading-none"
          >
            {done ? "×" : ""}
          </button>
        )}
        <span>{seqLabel(note.seq)}</span>
        <Dot />
        {bill ? (
          <>
            <span>
              bill · {formatMoney(bill.amount, settings.currency)}
            </span>
            <Dot />
          </>
        ) : project ? (
          <>
            <span
              className={
                note.projectStatus === "active"
                  ? onColor
                    ? "bg-[#111] px-1.5 py-0.5 text-white"
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
        {/* A word count says something about a paragraph of thinking and
            nothing at all about a project title or a bill. */}
        {!project && !bill && wordCount(note.body) > 3 && (
          <>
            <span>{wordCount(note.body)} words</span>
            <Dot />
          </>
        )}
        {note.images.length > 0 && (
          <>
            <span>
              {note.images.length} {note.images.length === 1 ? "image" : "images"}
            </span>
            <Dot />
          </>
        )}
        <span>{stamp(note.createdAt)}</span>
        {note.pinned && (
          <>
            <Dot />
            <span>pinned</span>
          </>
        )}
        {archived && (
          <>
            <Dot />
            <span>archived</span>
          </>
        )}

        <span
          data-card-actions
          className="ml-auto flex items-center gap-2.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        >
          <Action onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </Action>
          <Action onClick={() => patchNote(note.id, { pinned: !note.pinned })}>
            {note.pinned ? "Unpin" : "Pin"}
          </Action>
          <Action onClick={() => setRecolouring((v) => !v)}>Colour</Action>
          {!bill && (
            <Action
              onClick={() =>
                patchNote(note.id, {
                  projectStatus: project ? null : "idea",
                })
              }
            >
              {project ? "Unproject" : "Project"}
            </Action>
          )}
          {!project && (
            <Action
              onClick={() =>
                patchNote(note.id, { bill: bill ? null : newBill() })
              }
            >
              {bill ? "Unbill" : "Bill"}
            </Action>
          )}
          {!project && targets.length > 0 && (
            <Action onClick={() => setMoving((v) => !v)}>
              {note.parentId ? "Unfile" : "File"}
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
                  `Delete this project and its ${steps.length} ${
                    steps.length === 1 ? "step" : "steps"
                  }?`,
                )
              ) {
                return;
              }
              removeNote(note.id);
            }}
          >
            Del
          </Action>
        </span>
      </header>

      {recolouring && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
              aria-label={`File in ${c.name ?? `World ${i + 1}`}`}
              className={`h-7 w-7 border border-rule ${
                c.id === note.colorId ? "ring-2 ring-inset ring-ink" : ""
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              patchNote(note.id, { colorId: null });
              setRecolouring(false);
            }}
            className="label border border-current px-2 py-1.5 hover:bg-[#111] hover:text-white"
          >
            None
          </button>
        </div>
      )}

      {moving && (
        <div className="label mt-3 flex flex-wrap items-center gap-2">
          <span className="opacity-60">File under</span>
          {note.parentId && (
            <button
              type="button"
              onClick={() => {
                patchNote(note.id, { parentId: null });
                setMoving(false);
              }}
              className="border border-current px-2 py-1 hover:bg-[#111] hover:text-white"
            >
              Nothing
            </button>
          )}
          {targets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                patchNote(note.id, { parentId: p.id, isTask: true });
                setMoving(false);
              }}
              className="max-w-56 truncate border border-current px-2 py-1 normal-case tracking-normal hover:bg-[#111] hover:text-white"
            >
              {projectTitle(p)}
            </button>
          ))}
        </div>
      )}

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
          className="prose-note mt-3 block w-full resize-none border border-current
                     bg-transparent px-3 py-2 outline-none"
        />
      ) : (
        note.body.length > 0 && (
          <p
            className={`prose-note mt-3 whitespace-pre-wrap ${
              done ? "line-through opacity-55" : ""
            }`}
          >
            <Highlight text={note.body} query={query} />
          </p>
        )
      )}

      <NoteImages images={note.images} onOpen={setViewing} />

      {project && (
        <ProjectPanel project={note} steps={steps} onColor={onColor} />
      )}

      {bill && todayKey && (
        <BillPanel
          note={note}
          bill={bill}
          today={fromKey(todayKey)}
          onColor={onColor}
        />
      )}

      {(note.tags.length > 0 || color !== null) && (
        <footer className="label mt-4 flex flex-wrap items-center gap-2">
          {color !== null && onEnterWorld && (
            <button
              type="button"
              onClick={() => onEnterWorld(color.id)}
              className="border border-current px-2 py-1.5 hover:bg-[#111] hover:text-white"
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
                className={`border border-current px-2 py-1.5 hover:bg-[#111] hover:text-white ${
                  onColor ? "opacity-70" : "text-mute"
                }`}
              >
                #{t}
              </button>
            ) : (
              <span
                key={t}
                className={`border border-current px-2 py-1.5 ${
                  onColor ? "opacity-70" : "text-mute"
                }`}
              >
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
