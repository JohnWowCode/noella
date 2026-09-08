"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HOLD_MS, SLOP, type Grab } from "@/lib/drag";

/**
 * One thing being carried, and where the pointer is.
 *
 * The whole gesture lives here so every list in the app picks things up the
 * same way: a press that holds still is a drag, a press that lets go quickly
 * is a tap, and a press that slides straight away is a scroll.
 *
 * The listeners are attached the moment you press, not from an effect keyed on
 * state. That is not a style preference — the first version watched for
 * movement only after something had been lifted, so the "you were scrolling"
 * escape hatch could never fire, and dragging a finger up a list on a phone
 * picked a row up every time.
 */
export function useDrag(
  onDrop: (id: string, overId: string | null, y: number) => void,
) {
  const [grab, setGrab] = useState<Grab | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const timer = useRef(0);
  const start = useRef<{ x: number; y: number; id: string } | null>(null);
  const held = useRef(false);
  const overRef = useRef<string | null>(null);
  const endedAt = useRef(0);
  // Kept in a ref so the listeners never close over a stale handler. Written
  // in an effect rather than during render, which React forbids.
  const drop = useRef(onDrop);
  useEffect(() => {
    drop.current = onDrop;
  }, [onDrop]);

  const teardown = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    document.body.style.removeProperty("user-select");
    start.current = null;
    held.current = false;
    overRef.current = null;
    setGrab(null);
    setOver(null);
    teardown.current?.();
    teardown.current = null;
  }, []);

  const press = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      teardown.current?.();
      start.current = { x: e.clientX, y: e.clientY, id };
      held.current = false;

      const move = (ev: PointerEvent) => {
        const from = start.current;
        if (!from) return;
        if (!held.current) {
          // Moved before the hold finished: a scroll, not a drag.
          if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > SLOP) {
            window.clearTimeout(timer.current);
            start.current = null;
          }
          return;
        }
        ev.preventDefault();
        setGrab({ id: from.id, x: ev.clientX, y: ev.clientY });
        const el = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest("[data-drop-id]");
        const next = el?.getAttribute("data-drop-id") ?? null;
        overRef.current = next;
        setOver(next);
      };

      const up = (ev: PointerEvent) => {
        const from = start.current;
        if (held.current && from) {
          // The drop carries the point it happened at, so nothing downstream
          // has to read a position back out of render state.
          drop.current(from.id, overRef.current, ev.clientY);
          endedAt.current = Date.now();
        }
        cancel();
      };

      // Dragging a note's words leaves those words selected. Press them again
      // and the browser starts its own drag of the selection, which fires
      // pointercancel and swallows the drop — so the second drag in a row did
      // nothing at all. The browser's drag is never wanted here.
      const noNative = (ev: Event) => ev.preventDefault();

      // Not passive: preventDefault is the only thing stopping the page
      // scrolling underneath a drag on a touch screen.
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
      document.addEventListener("dragstart", noNative);
      teardown.current = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        document.removeEventListener("dragstart", noNative);
      };

      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (!start.current) return;
        held.current = true;
        // Let go of any words the press highlighted, and stop the browser
        // highlighting more as you go. Without this, carrying a note dragged a
        // selection across everything the pointer crossed, so half the screen
        // came up black behind the thing you were trying to place.
        window.getSelection()?.removeAllRanges();
        document.body.style.userSelect = "none";
        setGrab({ id, x: start.current.x, y: start.current.y });
        // A short buzz where the hardware has one, so a long press on a phone
        // announces itself rather than just happening.
        navigator.vibrate?.(8);
      }, HOLD_MS);
    },
    [cancel],
  );

  // Nothing should survive the component going away mid-gesture.
  useEffect(() => cancel, [cancel]);

  /** True for a moment after a drag, so the click it caused can be ignored. */
  const wasDrag = useCallback(() => Date.now() - endedAt.current < 250, []);

  return { grab, over, press, cancel, wasDrag, dragging: grab !== null };
}
