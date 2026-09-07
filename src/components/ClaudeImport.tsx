"use client";

import { useState } from "react";
import {
  HOME,
  bodyFor,
  noteFor,
  readExport,
  uuidOf,
  type Chat,
  type Plan,
} from "@/lib/claude/import";
import { NotAZip, readJsonFiles } from "@/lib/claude/zip";
import { contentsOf, titleOf } from "@/lib/rooms";
import { useNoella } from "@/lib/store/provider";
import type { NewNote } from "@/lib/types";
import { Popover } from "./Popover";

/**
 * Your Claude chats, as notes.
 *
 * Anthropic publishes no way to list what you have talked about — the Messages
 * API sends messages, it does not read your history, and Projects have no
 * endpoint at all. The account data export is the supported route, so this
 * takes the zip it hands you and turns it into rooms and notes.
 *
 * It is a two-step: read the file and say what is in it, then do it. An import
 * that quietly writes four hundred notes the moment you pick a file is not
 * something you can be confident about running a second time.
 */
export function ClaudeImport({ onOpen }: { onOpen?: (id: string) => void }) {
  const { notes, addNotes, patchNote } = useNoella();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(file: File) {
    setStatus("Reading…");
    setPlan(null);
    try {
      const files = file.name.toLowerCase().endsWith(".json")
        ? new Map([
            [file.name.split("/").pop() ?? file.name, await file.text()],
          ])
        : await readJsonFiles(file);
      const next = readExport(files);
      if (next.chats.length === 0) {
        setStatus(
          "No conversations in that file. It wants the export zip, or the conversations.json inside it.",
        );
        return;
      }
      setPlan(next);
      setStatus(null);
    } catch (error) {
      setStatus(
        error instanceof NotAZip
          ? error.message
          : "Could not read that. Try the .zip from Claude, or conversations.json out of it.",
      );
    }
  }

  async function apply() {
    if (!plan) return;
    setBusy(true);
    setStatus("Filing them…");

    // Everything already imported, by the chat it came from.
    const seen = new Map<string, string>();
    for (const n of notes) {
      const uuid = uuidOf(n);
      if (uuid) seen.set(uuid, n.id);
    }

    const home =
      notes.find((n) => n.archivedAt === null && titleOf(n) === HOME) ??
      (await addNotes([{ body: HOME, colorId: null }]))[0];

    const rooms = new Map<string, string>();
    for (const child of contentsOf(notes, home.id)) {
      rooms.set(titleOf(child), child.id);
    }

    // Rooms first, in one write, so the chats have somewhere to land.
    const missing = [...plan.rooms.keys()].filter((name) => !rooms.has(name));
    if (missing.length > 0) {
      const made = await addNotes(
        missing.map((name, i) => ({
          body: name,
          colorId: home.colorId,
          parentId: home.id,
          order: i,
        })),
      );
      made.forEach((note, i) => rooms.set(missing[i], note.id));
    }

    const fresh: NewNote[] = [];
    let refreshed = 0;
    const file = (chat: Chat, parentId: string, order: number) => {
      const existing = seen.get(chat.uuid);
      if (existing) {
        // Already here: leave where you put it, only bring the activity line
        // up to date so "most recent" stays true after a second export.
        patchNote(existing, { body: bodyFor(chat) });
        refreshed += 1;
        return;
      }
      fresh.push(noteFor(chat, parentId, order, home.colorId));
    };

    for (const [name, chats] of plan.rooms) {
      const parentId = rooms.get(name);
      if (!parentId) continue;
      chats.forEach((chat, i) => file(chat, parentId, i));
    }
    plan.loose.forEach((chat, i) => file(chat, home.id, i));

    if (fresh.length > 0) await addNotes(fresh);

    setBusy(false);
    setPlan(null);
    setStatus(
      `${fresh.length} brought in${refreshed > 0 ? `, ${refreshed} updated` : ""}.`,
    );
    onOpen?.(home.id);
  }

  return (
    <Popover
      label="Bring in your Claude chats"
      set={false}
      align="right"
      current={<span className="label px-1 py-1">Claude…</span>}
    >
      {() => (
        <span className="flex w-80 flex-col gap-2">
          <span className="label text-mute">Your chats, as notes</span>
          <p className="label normal-case tracking-normal text-mute">
            There is no way to read claude.ai chats live — no endpoint lists
            them. Export your data from claude.ai (Settings → Privacy → Export)
            and drop the zip here.
          </p>

          <label className="label cursor-pointer border border-rule px-3 py-2.5 text-center hover:bg-ink hover:text-paper">
            Choose the export
            <input
              type="file"
              accept=".zip,.json,application/zip,application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void read(file);
                e.target.value = "";
              }}
            />
          </label>

          {status && (
            <p className="label normal-case tracking-normal text-mute">
              {status}
            </p>
          )}

          {plan && (
            <span className="flex flex-col gap-2 border-t border-rule-soft pt-2">
              <p className="prose-note text-[calc(15px*var(--type))]">
                {plan.chats.length} chats
                {plan.rooms.size > 0
                  ? ` across ${plan.rooms.size} ${plan.rooms.size === 1 ? "project" : "projects"}`
                  : ""}
                .
              </p>
              <span className="label flex flex-col gap-0.5 text-mute">
                {plan.chats.slice(0, 4).map((c) => (
                  <span
                    key={c.uuid}
                    className="truncate normal-case tracking-normal"
                  >
                    {c.name}
                  </span>
                ))}
                {plan.chats.length > 4 && (
                  <span>and {plan.chats.length - 4} more</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => void apply()}
                disabled={busy}
                className="label border-2 border-ink bg-ink px-3 py-2.5 text-paper enabled:hover:bg-transparent enabled:hover:text-ink disabled:opacity-40"
              >
                Bring them in
              </button>
              <p className="label normal-case tracking-normal text-mute">
                Each chat gets a checkbox: tick it when it is finished, archive
                it when it is dead, leave it alone while it is ongoing.
                Importing again updates rather than duplicates.
              </p>
            </span>
          )}
        </span>
      )}
    </Popover>
  );
}
