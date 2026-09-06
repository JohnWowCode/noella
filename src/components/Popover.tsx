"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One button, and a panel that is not there until you ask.
 *
 * The compose box had grown to forty-seven controls on an empty wall — thirty
 * six of them colours — which is not a box you write in, it is a control panel
 * you operate. Everything still reachable, none of it standing there. The
 * trigger keeps showing the current value, so nothing is hidden, only folded.
 */
/**
 * Drag a panel back inside the window if it opened past the edge.
 *
 * These triggers sit in a row, so the third one along on a 390px phone opens a
 * panel that starts 122px in and is 276px wide — eight pixels over, which does
 * not clip, it makes the whole page scroll sideways. There is no CSS for "stay
 * in the viewport" that also knows where its trigger is, so it is measured.
 *
 * Done on the node itself rather than through state: the panel is measured the
 * moment React hands it over, before a frame is painted, so it never appears
 * in the wrong place first and then jumps.
 */
function keepInView(el: HTMLElement | null) {
  if (!el) return;
  el.style.transform = "";
  const margin = 8;
  const rect = el.getBoundingClientRect();
  /*
   * clientWidth, not innerWidth. On a phone the two are different numbers —
   * an emulated 390px screen reports an innerWidth of 462 — and measuring
   * against the larger one is how a panel gets declared "on screen" while
   * sixty pixels of it sit past the right edge with nothing to scroll to.
   */
  const over = rect.right - (document.documentElement.clientWidth - margin);
  if (over <= 0) return;
  el.style.transform = `translateX(${-Math.min(over, Math.max(0, rect.left - margin))}px)`;
}

export function Popover({
  label,
  current,
  set,
  align = "left",
  children,
}: {
  /** For screen readers and the tooltip. The trigger itself shows `current`. */
  label: string;
  /** What is chosen right now, drawn on the button. */
  current: React.ReactNode;
  /** Whether something is chosen, which is all the trigger needs to say. */
  set: boolean;
  align?: "left" | "right";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Capture, so a click on something that stops propagation still closes it.
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        // Holds the caret in the textarea, so opening this never costs the
        // click that follows it.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        /*
         * Nine rem-units is a comfortable mouse target and an uncomfortable
         * thumb one. It grows on a device that has no pointer, where the same
         * button is being hit with a finger and there is more room going
         * spare than there is patience.
         */
        className={`grid h-9 min-w-9 place-items-center border px-2 text-[16px] leading-none [@media(hover:none)]:h-11 [@media(hover:none)]:min-w-11 ${
          set || open ? "border-ink" : "border-rule text-mute hover:border-ink"
        }`}
      >
        {current}
      </button>
      {open && (
        <span
          ref={keepInView}
          /*
           * Downward. These triggers sit in a row near the top of the page, so
           * a panel opening upward — a thirty-six swatch grid especially —
           * would run off the top of the viewport with no way to scroll to it.
           */
          className={`absolute top-full z-30 mt-1 w-max max-w-[min(22rem,calc(100vw-1rem))] border-2 border-ink bg-paper p-2 text-ink shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </span>
      )}
    </span>
  );
}
