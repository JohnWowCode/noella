"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { dropAt, type Drop, type Grab } from "@/lib/drag";
import { useDrag } from "./useDrag";

/**
 * One drag for the whole wall.
 *
 * The tree inside a card and the cards themselves are the same kind of thing —
 * a note with a place — so carrying one has to be one gesture, not two systems
 * that happen to look alike. With a hook per list, pressing a row inside a card
 * armed both the row's drag and the card's, and you could never drag a row out
 * of one card and into another because neither knew about the other.
 *
 * So the gesture lives once, above everything, and every list borrows it. What
 * a drop *means* still belongs to whoever owns the data — this only says what
 * is being carried and what it is over.
 */
export interface DragState {
  grab: Grab | null;
  over: string | null;
  /** Where a drop on the hovered target would land, once measured. */
  where: Drop;
  press: (id: string, e: React.PointerEvent) => void;
  wasDrag: () => boolean;
  dragging: boolean;
  /**
   * The note something was last dropped into, and a counter that changes even
   * when it is the same note twice.
   *
   * A list that holds the thing you just dropped has to open, or the drop
   * looks like a deletion. The lists own their own folded state, so rather
   * than reaching into them, this says where the last one landed and they
   * decide what to do about it.
   */
  landedIn: string | null;
  landedAt: number;
}

const Idle: DragState = {
  grab: null,
  over: null,
  where: "into",
  press: () => {},
  wasDrag: () => false,
  dragging: false,
  landedIn: null,
  landedAt: 0,
};

const Ctx = createContext<DragState>(Idle);

export function useCarry(): DragState {
  return useContext(Ctx);
}

export function DragProvider({
  onDrop,
  children,
}: {
  /** `where` is measured against the target's own box at the moment of the drop. */
  onDrop: (id: string, overId: string | null, where: Drop) => void;
  children: React.ReactNode;
}) {
  const [landed, setLanded] = useState<{ id: string | null; at: number }>({
    id: null,
    at: 0,
  });

  const drag = useDrag((id, overId, y) => {
    const where = whereFor(overId, y);
    onDrop(id, overId, where);
    if (overId && overId !== id) {
      const el = document.querySelector(
        `[data-drop-id="${CSS.escape(overId)}"]`,
      );
      setLanded({
        id:
          where === "into" ? overId : (el?.getAttribute("data-parent") ?? null),
        at: Date.now(),
      });
    }
  });

  const value = useMemo<DragState>(
    () => ({
      grab: drag.grab,
      over: drag.over,
      where: whereFor(drag.over, drag.grab?.y ?? 0),
      press: drag.press,
      wasDrag: drag.wasDrag,
      dragging: drag.dragging,
      landedIn: landed.id,
      landedAt: landed.at,
    }),
    [
      drag.grab,
      drag.over,
      drag.press,
      drag.wasDrag,
      drag.dragging,
      landed.id,
      landed.at,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Reads the target's box out of the DOM rather than tracking every row's
 * geometry in state. One measurement, at the moment it is needed.
 */
function whereFor(overId: string | null, y: number): Drop {
  if (!overId || typeof document === "undefined") return "into";
  const el = document.querySelector(`[data-drop-id="${CSS.escape(overId)}"]`);
  if (!el) return "into";
  return dropAt(el.getBoundingClientRect(), y);
}
