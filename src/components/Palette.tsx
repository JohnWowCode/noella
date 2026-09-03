"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seqLabel } from "@/lib/format";
import { isProject, projectTitle, projectsOf, stepsOf, nextActionOf } from "@/lib/projects";
import { reorder } from "@/lib/order";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";

interface Item {
  id: string;
  group: "Go" | "Do" | "Projects" | "Notes";
  label: string;
  hint?: string;
  /** Flat block of the note's world, so results are scannable by colour. */
  swatch?: string | null;
  run: () => void;
}

const MAX_NOTES = 6;

/**
 * One keystroke to anything.
 *
 * Every screen used to need its own visible control for every action, which is
 * how chrome accumulates. A palette lets the screens stay quiet: search from
 * anywhere, jump anywhere, and act on the top of the priority list without
 * navigating to it first.
 */
export function Palette() {
  const router = useRouter();
  const { ready, notes, patchNote, exportBackup } = useNoella();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setCursor(0);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const active = useMemo(
    () => projectsOf(notes).filter((p) => p.projectStatus === "active"),
    [notes],
  );
  const todaysStep = useMemo(
    () => (active[0] ? nextActionOf(stepsOf(notes, active[0].id)) : null),
    [notes, active],
  );

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const hit = (s: string) => s.toLowerCase().includes(needle);
    const out: Item[] = [];

    const go = (label: string, href: string, hint: string) => ({
      id: `go:${href}`,
      group: "Go" as const,
      label,
      hint,
      run: () => {
        router.push(href);
        close();
      },
    });
    out.push(go("Home", "/", "everything, one screen"));

    if (todaysStep && active[0]) {
      out.push({
        id: "do:done",
        group: "Do",
        label: `Done: ${todaysStep.body}`,
        hint: projectTitle(active[0]),
        run: () => {
          patchNote(todaysStep.id, { doneAt: new Date().toISOString() });
          close();
        },
      });
    }
    out.push({
      id: "do:export",
      group: "Do",
      label: "Export a backup",
      hint: "json, images inlined",
      run: () => {
        void exportBackup().then((backup) => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(backup)], { type: "application/json" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = `noella-${backup.exportedAt.slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
        close();
      },
    });

    // Make any project today's, from anywhere.
    for (const p of projectsOf(notes)) {
      out.push({
        id: `proj:${p.id}`,
        group: "Projects",
        label: projectTitle(p),
        hint: `${p.projectStatus} — make it today's`,
        swatch: p.colorId,
        run: () => {
          for (const patch of reorder(active, p.id, -1)) {
            patchNote(patch.id, { order: patch.order });
          }
          patchNote(p.id, { projectStatus: "active", order: -1 });
          router.push("/");
          close();
        },
      });
    }

    if (needle) {
      const found = notes
        .filter(
          (n) =>
            n.archivedAt === null &&
            !isProject(n) &&
            (hit(n.body) || n.tags.some((t) => hit(t))),
        )
        .slice(0, MAX_NOTES);
      for (const n of found) {
        out.push({
          id: `note:${n.id}`,
          group: "Notes",
          label: n.body.split("\n")[0].slice(0, 90) || seqLabel(n.seq),
          hint: seqLabel(n.seq),
          swatch: n.colorId,
          run: () => {
            router.push(`/#note-${n.id}`);
            close();
          },
        });
      }
    }

    return needle
      ? out.filter((i) => hit(i.label) || hit(i.hint ?? "") || i.group === "Notes")
      : out.filter((i) => i.group !== "Notes");
  }, [q, notes, active, todaysStep, router, patchNote, exportBackup, close]);

  // Same adjust-during-render trick: a new query must not keep the old row
  // highlighted for a frame.
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setCursor(0);
  }

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!ready || !open) return null;

  const groups = ["Go", "Do", "Projects", "Notes"] as const;
  let index = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-60 flex items-start justify-center bg-ink/40 px-4 pt-[12vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden border border-rule bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, items.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              items[cursor]?.run();
            }
          }}
          placeholder="Search, jump, or do…"
          aria-label="Search commands and notes"
          className="prose-note w-full border-b border-rule bg-transparent px-5 py-4 text-[18px]
                     outline-none placeholder:text-mute"
        />

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto">
          {items.length === 0 && (
            <p className="label px-5 py-8 text-center text-mute">Nothing by that name.</p>
          )}
          {groups.map((g) => {
            const rows = items.filter((i) => i.group === g);
            if (rows.length === 0) return null;
            return (
              <section key={g}>
                <h3 className="label border-b border-rule-soft bg-field px-5 py-2 text-mute">
                  {g}
                </h3>
                {rows.map((item) => {
                  index += 1;
                  const on = index === cursor;
                  const at = index;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-active={on}
                      onMouseEnter={() => setCursor(at)}
                      onClick={item.run}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left ${
                        on ? "bg-ink text-paper" : "hover:bg-field"
                      }`}
                    >
                      {item.swatch !== undefined && (
                        <Dot colorId={item.swatch} />
                      )}
                      <span className="prose-note flex-1 truncate text-[15px]">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="label shrink-0 opacity-60">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>

        <p className="label flex items-center gap-3 border-t border-rule-soft bg-field px-5 py-3 text-mute">
          <span>↑↓ move</span>
          <span>↵ select</span>
          <span>esc close</span>
          <span className="ml-auto">⌘K</span>
        </p>
      </div>
    </div>
  );
}

function Dot({ colorId }: { colorId: string | null }) {
  const { colors } = useNoella();
  const hex = colors.find((c) => c.id === colorId)?.hex ?? null;
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 border border-current/40"
      style={{ backgroundColor: hex ?? "transparent" }}
    />
  );
}

/** Sits under everything, offering the last delete back. */
export function UndoBar() {
  const { undo, dismissUndo } = useNoella();

  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(dismissUndo, 8000);
    return () => window.clearTimeout(t);
  }, [undo, dismissUndo]);

  if (!undo) return null;

  return (
    <div
      role="status"
      className="label fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4
                 border border-rule bg-ink px-4 py-3 text-paper sm:bottom-8"
    >
      <span>{undo.label}</span>
      <button
        type="button"
        onClick={undo.run}
        className="label border border-current px-2 py-1 hover:bg-paper hover:text-ink"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={dismissUndo}
        aria-label="Dismiss"
        className="label px-1 opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

export type { Note };
