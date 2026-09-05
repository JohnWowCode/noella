"use client";

import { useMemo, useState } from "react";
import type { Note } from "@/lib/types";

/**
 * Six, not twelve.
 *
 * Tags are the cross-cut, not the spine — the folders above already carry the
 * structure. Twelve outlined boxes under them was a second navigation bar
 * competing with the first, and the tail of it was always the tags used once.
 */
const COLLAPSED = 6;

/**
 * Every tag on the wall, heaviest first. Colour is the spine; this is the
 * cross-cut, and it is the only place you can see the whole cross-cut at once.
 */
export function TagIndex({
  notes,
  active,
  onPick,
}: {
  notes: Note[];
  active: string | null;
  onPick: (tag: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      if (n.archivedAt !== null) continue;
      for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [notes]);

  if (tags.length === 0) return null;

  const shown = expanded ? tags : tags.slice(0, COLLAPSED);
  const hidden = tags.length - shown.length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {shown.map(([tag, count]) => (
        <button
          key={tag}
          type="button"
          onClick={() => onPick(active === tag ? null : tag)}
          aria-pressed={active === tag}
          className={`label ${
            active === tag
              ? "bg-ink px-1.5 py-0.5 text-paper"
              : "text-mute underline decoration-1 underline-offset-2 hover:text-ink hover:no-underline"
          }`}
        >
          #{tag}
          <span className="ml-1 opacity-55 tabular-nums">{count}</span>
        </button>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="label text-mute underline decoration-1 underline-offset-2 hover:text-ink"
        >
          +{hidden} more
        </button>
      )}
      {expanded && tags.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="label text-mute underline decoration-1 underline-offset-2 hover:text-ink"
        >
          Fewer
        </button>
      )}
    </div>
  );
}
