"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  access,
  choose,
  drop,
  forget,
  readInbox,
  regrant,
  remembered,
  serialise,
  supported,
  writeWall,
  type Envelope,
  type Folder,
} from "@/lib/bridge/folder";
import { priorityOf } from "@/lib/priority";
import { todayKey } from "@/lib/clock";
import { useNoella } from "@/lib/store/provider";
import type { NewNote } from "@/lib/types";

/** How often a visible tab looks for changes Claude queued. */
const POLL_MS = 4000;

/** How long after you stop typing the wall is written out. */
const SETTLE_MS = 900;

type State = "off" | "needs-permission" | "on";

/**
 * Keeps a folder on disk in step with the wall, so the Noella MCP server can
 * read it and queue changes back.
 *
 * This component is the whole bridge — the file writing, the inbox draining
 * and the control that turns it on. It has to stay mounted for any of that to
 * happen, which is why it lives on the one screen rather than in a settings
 * page nobody keeps open.
 */
export function FolderLink() {
  const { ready, notes, colors, settings, addNote, patchNote } = useNoella();
  const [state, setState] = useState<State>("off");
  const [handle, setHandle] = useState<Folder | null>(null);
  const [applied, setApplied] = useState(0);
  const [name, setName] = useState<string | null>(null);

  // The last body written, so an unchanged wall is not rewritten on a timer.
  const lastWritten = useRef<string | null>(null);
  // Ops are applied through React state; a second pass must not re-apply one
  // that is still in flight, so ids are remembered until their file is gone.
  const inFlight = useRef(new Set<string>());

  // Pick the folder back up on load. The handle survives; its permission does
  // not, so a browser restart lands on "needs-permission" and one click fixes it.
  useEffect(() => {
    let live = true;
    void (async () => {
      const stored = await remembered();
      if (!live || !stored) return;
      const permission = await access(stored);
      if (!live) return;
      setHandle(stored);
      setName(stored.name);
      setState(permission === "granted" ? "on" : "needs-permission");
    })();
    return () => {
      live = false;
    };
  }, []);

  const applyOne = useCallback(
    (op: Envelope["op"]) => {
      switch (op.op) {
        case "add_note": {
          const input: NewNote = {
            body: op.body ?? "",
            colorId: op.colorId ?? null,
            // Nulled if the parent has since gone, so the note lands on the
            // top of the wall rather than being filed into nothing.
            parentId: op.parentId
              ? (notes.find((n) => n.id === op.parentId)?.id ?? null)
              : null,
            icons: op.icons ?? (op.icon ? [op.icon] : []),
            priority: priorityOf(op.priority),
          };
          // "project" and "list" were kinds; they are not any more. Anything
          // that holds things is a room, so an older server asking for one
          // just gets a note, which is what it will become the moment
          // something is put inside it.
          if (op.kind === "todo") input.isTask = true;
          addNote(input);
          return true;
        }
        case "add_step": {
          const parent = notes.find((n) => n.id === op.parentId);
          if (!parent) return true; // Its folder is gone; drop it quietly.
          addNote({
            body: op.body ?? "",
            colorId: parent.colorId,
            parentId: parent.id,
            // add_step means a checklist item; add_note with `inside` is how
            // you put a folder or a plain note into something.
            isTask: true,
          });
          return true;
        }
        case "complete":
          patchNote(op.noteId ?? "", { doneAt: new Date().toISOString() });
          return true;
        case "reopen":
          patchNote(op.noteId ?? "", { doneAt: null });
          return true;
        case "set_marks":
          patchNote(op.noteId ?? "", { icons: op.icons ?? [] });
          return true;
        case "set_priority":
          patchNote(op.noteId ?? "", { priority: priorityOf(op.priority) });
          return true;
        case "set_today":
          patchNote(op.noteId ?? "", {
            todayOn: op.today === false ? null : todayKey(),
          });
          return true;
        default:
          // A newer server queued something this build does not know. Leaving
          // it in place would jam the queue forever, so it is dropped.
          return true;
      }
    },
    [notes, addNote, patchNote],
  );

  // Drain what the server queued, then write the wall back out.
  useEffect(() => {
    if (state !== "on" || !handle || !ready) return;
    let live = true;

    const drain = async () => {
      const queued = await readInbox(handle);
      if (!live) return;
      let count = 0;
      for (const entry of queued) {
        if (inFlight.current.has(entry.op.id)) continue;
        inFlight.current.add(entry.op.id);
        if (applyOne(entry.op)) {
          await drop(handle, entry.file);
          inFlight.current.delete(entry.op.id);
          count += 1;
        }
      }
      if (live && count > 0) setApplied((n) => n + count);
    };

    void drain();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void drain();
    }, POLL_MS);
    window.addEventListener("focus", drain);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", drain);
    };
  }, [state, handle, ready, applyOne]);

  // Write the wall out once things settle. Serialising is the expensive part,
  // so it happens once per settle rather than once per keystroke.
  useEffect(() => {
    if (state !== "on" || !handle || !ready) return;
    const timer = window.setTimeout(() => {
      const body = serialise({ notes, colors, settings });
      // writtenAt changes every call, so compare everything but that line.
      const same =
        lastWritten.current !== null &&
        stripStamp(lastWritten.current) === stripStamp(body);
      if (same) return;
      void writeWall(handle, body).then(() => {
        lastWritten.current = body;
      });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [state, handle, ready, notes, colors, settings]);

  if (!supported()) {
    return (
      <p className="label max-w-md text-mute">
        Connecting Claude needs Chrome, Edge or another Chromium browser —
        Firefox and Safari cannot let a page hold onto a folder. Export still
        works everywhere.
      </p>
    );
  }

  if (state === "off") {
    return (
      <button
        type="button"
        onClick={async () => {
          const picked = await choose();
          if (!picked) return;
          setHandle(picked);
          setName(picked.name);
          setState("on");
        }}
        className="label border border-rule px-3 py-2 hover:bg-ink hover:text-paper"
      >
        Connect a folder
      </button>
    );
  }

  if (state === "needs-permission") {
    return (
      <button
        type="button"
        onClick={async () => {
          if (!handle) return;
          const granted = await regrant(handle);
          setState(granted === "granted" ? "on" : "needs-permission");
        }}
        className="label border-2 border-ink px-3 py-2 hover:bg-ink hover:text-paper"
      >
        Reconnect {name ?? "folder"}
      </button>
    );
  }

  return (
    <span className="label flex flex-wrap items-center gap-x-3 gap-y-1.5 text-mute">
      <span className="text-ink">Claude can read {name}</span>
      {applied > 0 && (
        <span className="tabular-nums">
          {applied} change{applied === 1 ? "" : "s"} pulled in
        </span>
      )}
      <button
        type="button"
        onClick={async () => {
          await forget();
          setHandle(null);
          setName(null);
          setState("off");
          lastWritten.current = null;
        }}
        className="border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
      >
        Disconnect
      </button>
    </span>
  );
}

/** Everything but the timestamp, which changes on every serialise by design. */
function stripStamp(body: string): string {
  return body.replace(/^\s*"writtenAt":.*$/m, "");
}
