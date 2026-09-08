"use client";

import { titleOf } from "@/lib/rooms";
import { useNoella } from "@/lib/store/provider";
import { pathTo } from "@/lib/tree";

/**
 * Where a note lives, said quietly under it.
 *
 * The doing lists were amputating things from their rooms. "Capsule art at
 * all five sizes" is not a job you can pick up — five sizes of what? It sits
 * inside Steam page inside Cave Sniper, and the moment you can see that it is
 * a job again. The wall has always known this; the lists you actually work
 * from did not, which meant the one screen meant to get you moving was the
 * one screen with the least context on it.
 *
 * Only the last two rooms, because the point is what it belongs to and not
 * its full address, and each one opens.
 */
export function Where({
  id,
  onOpen,
}: {
  id: string;
  onOpen?: (id: string) => void;
}) {
  const { notes } = useNoella();
  const trail = pathTo(notes, id);
  if (trail.length === 0) return null;

  const near = trail.slice(-2);
  return (
    <span className="label flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-mute">
      {trail.length > near.length && <span aria-hidden>…</span>}
      {near.map((room, i) => (
        <span key={room.id} className="flex min-w-0 items-baseline gap-1.5">
          {i > 0 && <span aria-hidden>›</span>}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(room.id);
            }}
            className="max-w-44 truncate underline decoration-1 underline-offset-2 hover:text-ink hover:no-underline"
          >
            {titleOf(room)}
          </button>
        </span>
      ))}
    </span>
  );
}
