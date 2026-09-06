"use client";

import { useState } from "react";
import { todayKey } from "@/lib/clock";
import { PRIORITIES, PRIORITY } from "@/lib/priority";
import { titleOf } from "@/lib/rooms";
import { MARK_GROUPS, markLabel, type MarkGroup } from "@/lib/stickers";
import { swatchName } from "@/lib/store/defaults";
import { useNoella } from "@/lib/store/provider";
import { descendantsOf } from "@/lib/tree";
import type { Note } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Doing one thing to several notes.
 *
 * Capture in this app is a burst — you type six things in twenty seconds and
 * that is the point. Organising them was not: colouring five notes meant five
 * trips through a card menu, and putting five notes into a new room meant
 * making the room, then moving each one, one at a time, through a typed
 * destination picker. So the tidying never happened, and a wall that is easy
 * to add to and hard to tidy fills with sediment.
 *
 * Select, then act once. The selection bar sits at the bottom of the screen
 * where a thumb is, says how many it has, and every action on it is one the
 * card menu already offers — this adds no new concepts, only a way to mean
 * them about more than one thing.
 */
export function SelectionBar({
  selected,
  notes,
  onClear,
  onOpen,
}: {
  selected: Set<string>;
  notes: Note[];
  onClear: () => void;
  onOpen: (id: string) => void;
}) {
  const { colors, addNote, patchNote, removeNote } = useNoella();
  const [panel, setPanel] = useState<"none" | "room" | "colour" | "mark">(
    "none",
  );
  const [roomName, setRoomName] = useState("");

  const picked = notes.filter((n) => selected.has(n.id));
  if (picked.length === 0) return null;

  const each = (patch: Partial<Note>) => {
    for (const n of picked) patchNote(n.id, patch);
    onClear();
  };

  /*
   * Everything selected goes into one new note, which by being a container is
   * a room. Anything that was already inside another selected note is left
   * where it is — moving both a room and its contents would flatten the room
   * you were trying to keep.
   */
  async function makeRoom() {
    const name = roomName.trim();
    if (!name) return;
    const inner = new Set(
      picked.flatMap((n) => descendantsOf(notes, n.id).map((d) => d.id)),
    );
    const top = picked.filter((n) => !inner.has(n.id));
    const room = await addNote({
      body: name,
      colorId: top[0]?.colorId ?? null,
      parentId: top[0]?.parentId ?? null,
    });
    top.forEach((n, i) => patchNote(n.id, { parentId: room.id, order: i }));
    setRoomName("");
    setPanel("none");
    onClear();
    onOpen(room.id);
  }

  return (
    <div
      role="region"
      aria-label="Selected notes"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
        {panel === "room" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void makeRoom();
            }}
            className="mb-3 flex flex-wrap items-center gap-2"
          >
            <input
              autoFocus
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder={`Call it something — ${picked.length} things go in`}
              aria-label="Name the room"
              className="prose-note min-w-0 flex-1 border border-rule bg-field px-3 py-2 text-[calc(16px*var(--type))] outline-none"
            />
            <button
              type="submit"
              disabled={!roomName.trim()}
              className="label border-2 border-ink bg-ink px-3 py-2.5 text-paper enabled:hover:bg-transparent enabled:hover:text-ink disabled:opacity-40 [@media(hover:none)]:min-h-11"
            >
              Make it
            </button>
          </form>
        )}

        {panel === "colour" && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {colors.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => each({ colorId: c.id })}
                title={c.name ?? swatchName(i)}
                className="h-8 w-8 border border-rule-soft hover:border-ink [@media(hover:none)]:h-11 [@media(hover:none)]:w-11"
                style={{ backgroundColor: c.hex }}
              >
                <span className="sr-only">{c.name ?? swatchName(i)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => each({ colorId: null })}
              className="label border border-rule px-2 py-1.5 text-mute hover:text-ink [@media(hover:none)]:min-h-11 [@media(hover:none)]:px-3"
            >
              No folder
            </button>
          </div>
        )}

        {panel === "mark" && (
          <div className="mb-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
            {MARK_GROUPS.flatMap((g: MarkGroup) => g.icons).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => each({ icons: [m] })}
                className="flex items-center gap-1.5 border border-transparent px-1.5 py-1.5 hover:border-rule [@media(hover:none)]:min-h-11"
              >
                <Icon name={m} size={15} />
                <span className="label truncate">{markLabel(m)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label mr-1 tabular-nums">
            {picked.length} picked
          </span>

          <Act
            on={panel === "room"}
            onClick={() => setPanel(panel === "room" ? "none" : "room")}
          >
            Into a new room
          </Act>
          <Act
            on={panel === "colour"}
            onClick={() => setPanel(panel === "colour" ? "none" : "colour")}
          >
            Folder
          </Act>
          <Act
            on={panel === "mark"}
            onClick={() => setPanel(panel === "mark" ? "none" : "mark")}
          >
            Mark
          </Act>
          <Act onClick={() => each({ todayOn: todayKey() })}>Today</Act>
          {PRIORITIES.map((level) => (
            <Act key={level} onClick={() => each({ priority: level })}>
              {PRIORITY[level].label}
            </Act>
          ))}
          <Act onClick={() => each({ archivedAt: new Date().toISOString() })}>
            Archive
          </Act>
          <Act
            onClick={() => {
              if (
                !window.confirm(
                  `Delete ${picked.length} ${picked.length === 1 ? "note" : "notes"}, and anything inside them?`,
                )
              ) {
                return;
              }
              for (const n of picked) removeNote(n.id);
              onClear();
            }}
          >
            Delete
          </Act>

          <button
            type="button"
            onClick={onClear}
            className="label ml-auto border border-rule px-2.5 py-2 text-mute hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11 [@media(hover:none)]:px-3"
          >
            Done
          </button>
        </div>

        {picked.length <= 3 && (
          <p className="label mt-2 truncate text-mute">
            {picked.map((n) => titleOf(n)).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

function Act({
  on = false,
  onClick,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      /* 32px is a comfortable mouse target and a coin toss for a thumb, and
         this bar is the one thing in the app that is only ever used with one. */
      className={`label border px-2.5 py-2 [@media(hover:none)]:min-h-11 [@media(hover:none)]:px-3 ${
        on ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
