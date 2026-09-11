"use client";

import { useEffect, useRef, useState } from "react";
import { dayStamp } from "@/lib/format";
import {
  isLink,
  readDestination,
  writeDestination,
  type Destination,
} from "@/lib/send";
import { useNoella } from "@/lib/store/provider";
import type { Backup } from "@/lib/store/types";
import { Popover } from "./Popover";

/**
 * The wall lives in one browser. Without a way out, a cleared cache is the end
 * of it — so export writes a single self-contained JSON file, images inlined.
 */
export function DataMenu() {
  const { exportBackup, importBackup, mergeBackup, notes } = useNoella();
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /*
   * Which of the two things a file is for, decided before the file is picked.
   *
   * There was one button, and it replaced the wall. That is right for the one
   * case it was built for — a backup, restored onto a browser that has lost
   * everything — and catastrophic for the far more common one, which is
   * somebody handing you a file of notes to keep. The difference cannot be
   * guessed from the file, both are the same format, so it is asked before
   * rather than confirmed after: a dialog that appears once the file is chosen
   * is read as "yes, that is the file I meant" and clicked through.
   */
  const [mode, setMode] = useState<"add" | "replace">("add");

  async function download() {
    setStatus("Packing…");
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noella-${dayStamp(backup.exportedAt)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`${backup.notes.length} rows written`);
    } catch {
      setStatus("Export failed");
    }
  }

  async function take(file: File) {
    let backup: Backup;
    try {
      backup = JSON.parse(await file.text()) as Backup;
    } catch {
      setStatus("Not a Noella backup");
      return;
    }

    if (mode === "add") {
      setStatus("Adding…");
      try {
        const added = await mergeBackup(backup);
        setStatus(
          added === 0
            ? "Nothing new in that file"
            : `${added} added · nothing removed`,
        );
      } catch {
        setStatus("Not a Noella backup");
      }
      return;
    }

    // Replacing is the destructive one, so it is the one that asks.
    const ok = window.confirm(
      `Replace all ${notes.length} notes on this wall with the contents of ${file.name}? What is here now will be gone.`,
    );
    if (!ok) {
      setStatus(null);
      return;
    }
    setStatus("Restoring…");
    try {
      await importBackup(backup);
      setStatus(`${backup.notes?.length ?? 0} rows restored`);
    } catch {
      setStatus("Not a Noella backup");
    }
  }

  function pick(next: "add" | "replace") {
    setMode(next);
    setStatus(null);
    fileRef.current?.click();
  }

  return (
    <span className="label flex flex-wrap items-center gap-2">
      {status && <span className="text-mute">{status}</span>}
      <SendTo />
      <button
        type="button"
        onClick={download}
        className="label border border-rule px-3 py-2.5 hover:bg-ink hover:text-paper"
      >
        Export
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void take(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => pick("add")}
        title="Add a file's notes to this wall, keeping everything already here"
        className="label border border-rule px-3 py-2.5 hover:bg-ink hover:text-paper"
      >
        Add a file
      </button>
      <button
        type="button"
        onClick={() => pick("replace")}
        title="Throw this wall away and restore a backup in its place"
        className="label border border-rule px-3 py-2.5 text-mute hover:bg-ink hover:text-paper"
      >
        Restore
      </button>
    </span>
  );
}

/**
 * Where "Send to …" sends things.
 *
 * One field, because the shape of the URL already says what to do with it: put
 * {text} in it and Noella opens it in a tab, leave it plain and Noella posts
 * the note as JSON. The link form needs nothing built on the other end, which
 * is why it is offered first.
 */
function SendTo() {
  const [draft, setDraft] = useState<Destination | null>(null);

  useEffect(() => {
    let live = true;
    const stored = readDestination();
    Promise.resolve().then(() => {
      if (live) setDraft(stored);
    });
    return () => {
      live = false;
    };
  }, []);

  function set(patch: Partial<Destination>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      writeDestination(next);
      return next;
    });
  }

  if (!draft) return null;

  return (
    <Popover
      label="Send notes somewhere"
      set={draft.url.trim().length > 0}
      align="right"
      current={<span className="label px-1 py-1">Send to…</span>}
    >
      {() => (
        <span className="flex w-72 flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="label text-mute">Call it</span>
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="JSpace"
              className="prose-note border border-rule bg-field px-2 py-1.5 text-[calc(15px*var(--type))] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label text-mute">Where</span>
            <input
              value={draft.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://jspace.example/new?text={text}"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="prose-note border border-rule bg-field px-2 py-1.5 text-[calc(15px*var(--type))] outline-none"
            />
          </label>
          <p className="label normal-case tracking-normal text-mute">
            {draft.url.trim() === ""
              ? "Put {text}, {title} or {url} in it and Noella opens it in a tab — nothing to build on the other end. A plain address gets the note posted as JSON instead."
              : isLink(draft)
                ? "Opens in a new tab with the note filled in."
                : "Posts the note as JSON. The far end has to allow this origin, or the note goes to your clipboard instead."}
          </p>
          {!isLink(draft) && draft.url.trim() !== "" && (
            <label className="flex flex-col gap-1">
              <span className="label text-mute">Token, if it needs one</span>
              <input
                value={draft.token}
                onChange={(e) => set({ token: e.target.value })}
                type="password"
                autoComplete="off"
                className="prose-note border border-rule bg-field px-2 py-1.5 text-[calc(15px*var(--type))] outline-none"
              />
            </label>
          )}
        </span>
      )}
    </Popover>
  );
}
