"use client";

import { useState } from "react";
import { titleOf } from "@/lib/rooms";
import { pathTo } from "@/lib/tree";
import type { Note } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Somewhere to put a thing: your own shelves, walked.
 *
 * This used to be a search box over a flat list of every note you own with
 * its path printed after it, which is a database query rather than a place —
 * and you remember where a folder sits far better than what you called it. So
 * it is the same tree as everywhere else: top level, unfold, choose. The
 * search stays, because at four hundred notes it is quicker.
 *
 * It was private to the card menu, which meant the writing box had no way to
 * say where a new note should go.
 */
export function Mover({
  targets,
  notes,
  canClear,
  clearLabel = "Take it out",
  onPick,
}: {
  /** Everywhere this thing is allowed to go. */
  targets: Note[];
  notes: Note[];
  /** Whether "out of everything" is a move worth offering. */
  canClear: boolean;
  clearLabel?: string;
  onPick: (parentId: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const needle = q.trim().toLowerCase();
  const allowed = new Set(targets.map((t) => t.id));

  const kids = (parentId: string | null) =>
    notes
      .filter(
        (n) =>
          n.parentId === parentId && n.archivedAt === null && allowed.has(n.id),
      )
      .sort(
        (a, b) => a.order - b.order || titleOf(a).localeCompare(titleOf(b)),
      );

  const found = needle
    ? targets
        .filter((t) => titleOf(t).toLowerCase().includes(needle))
        .slice(0, 30)
    : [];

  const Row = ({ item, depth }: { item: Note; depth: number }) => {
    const children = kids(item.id);
    const unfolded = open.has(item.id);
    return (
      <>
        <li className="flex items-center">
          <button
            type="button"
            onClick={() =>
              setOpen((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
              })
            }
            disabled={children.length === 0}
            aria-label={unfolded ? "Fold" : "Unfold"}
            style={{ marginLeft: `${depth * 16}px` }}
            className="tap grid h-7 w-6 shrink-0 place-items-center opacity-60 disabled:opacity-0"
          >
            <span className={unfolded ? "rotate-90" : ""}>
              <Icon name="chevron" size={11} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => onPick(item.id)}
            className="min-w-0 flex-1 truncate px-1.5 py-2 text-left text-[calc(15px*var(--type))] hover:bg-current/10"
          >
            {titleOf(item)}
          </button>
        </li>
        {unfolded &&
          children.map((c) => <Row key={c.id} item={c} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div className="mt-3 border border-current/25 p-2">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Put it in…"
          aria-label="Search for somewhere to put this"
          className="label min-w-0 flex-1 border border-current/40 bg-transparent px-2 py-1.5
                     outline-none placeholder:opacity-50"
        />
        {canClear && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="label shrink-0 border border-current px-2 py-1.5 hover:bg-[var(--on)] hover:text-[var(--on-inv)]"
          >
            {clearLabel}
          </button>
        )}
      </div>

      <ul className="mt-2 max-h-64 overflow-y-auto">
        {needle ? (
          found.length === 0 ? (
            <li className="label px-1 py-2 opacity-60">
              Nowhere by that name.
            </li>
          ) : (
            found.map((t) => (
              <li key={t.id} className="flex items-baseline gap-2">
                <button
                  type="button"
                  onClick={() => onPick(t.id)}
                  className="flex min-w-0 flex-1 items-baseline gap-2 px-1.5 py-2 text-left hover:bg-current/10"
                >
                  <span className="min-w-0 flex-1 truncate text-[calc(15px*var(--type))]">
                    {titleOf(t)}
                  </span>
                  <span className="label shrink-0 truncate opacity-50">
                    {pathTo(notes, t.id)
                      .map((n) => titleOf(n))
                      .join(" › ")}
                  </span>
                </button>
              </li>
            ))
          )
        ) : kids(null).length === 0 ? (
          <li className="label px-1 py-2 opacity-60">
            Nothing else at the top level yet.
          </li>
        ) : (
          kids(null).map((t) => <Row key={t.id} item={t} depth={0} />)
        )}
      </ul>
    </div>
  );
}
