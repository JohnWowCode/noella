"use client";

import { useEffect, useState } from "react";
import { spellMinutes } from "@/lib/minutes";
import { agoWords, clearLast, GAP_MS, readLast } from "@/lib/lastseen";
import { useNoella } from "@/lib/store/provider";
import { Where } from "./Where";

/**
 * The way back in.
 *
 * This is the one thing the app owed a person who loses the thread. You stop
 * mid-thought on a Tuesday and open Noella on a Thursday, and what you get is
 * everything you have ever written — so you read the whole wall, feel all of
 * it at once, and start none of it. The hardest part was never choosing; it
 * was remembering where your hands were.
 *
 * So it says. One line, one button, and the minutes you had already put in —
 * because twelve minutes already spent is the cheapest argument there is for
 * doing the thirteenth.
 *
 * It waits for a real gap. Nothing here nags you about a note you closed four
 * minutes ago, and nothing here says a word about the days you were away.
 */
export function LeftOff({ onStart }: { onStart: (id: string) => void }) {
  const { notes } = useNoella();
  /*
   * The gap is measured once, when the screen opens, and kept as words. Asking
   * the clock during render is both forbidden and wrong: this line should say
   * the same thing all morning rather than quietly ticking over to "Yesterday"
   * while you are looking at it.
   */
  const [seen, setSeen] = useState<{ id: string; ago: string } | null>(null);
  const [gone, setGone] = useState(false);

  // Read after mount: the server has no idea where this device left off, and
  // rendering a guess would flash the wrong answer.
  useEffect(() => {
    const last = readLast();
    const now = Date.now();
    Promise.resolve().then(() => {
      if (last && now - last.at > GAP_MS) {
        setSeen({ id: last.id, ago: agoWords(last.at, now) });
      }
    });
  }, []);

  if (!seen || gone) return null;
  const note = notes.find((n) => n.id === seen.id);
  if (!note || note.doneAt !== null || note.archivedAt !== null) return null;

  const words = note.body.split("\n", 1)[0] || "a note";
  const spent = note.actualMinutes ?? 0;

  return (
    <section
      aria-label="Where you left off"
      className="mt-4 border-2 border-ink bg-field"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3.5">
        <p className="label text-mute">
          {seen.ago} you were on this
        </p>
        {spent > 0 && (
          <p className="label text-mute tabular-nums">
            {spellMinutes(spent)} in already
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            clearLast();
            setGone(true);
          }}
          className="label ml-auto text-mute hover:text-ink"
        >
          Not that
        </button>
      </div>

      <p className="display px-4 pt-1.5 text-[calc(21px*var(--type))] sm:text-[calc(25px*var(--type))]">
        {words}
      </p>

      <div className="px-4 pt-1.5">
        <Where id={note.id} />
      </div>

      <div className="mt-3 px-4 pb-4">
        <button
          type="button"
          onClick={() => {
            // Asked and answered. Coming back out of the one-thing view to
            // find the same question still waiting is the app forgetting that
            // you just did the thing it asked for.
            setGone(true);
            onStart(note.id);
          }}
          className="label border border-ink bg-ink px-3 py-2.5 text-paper hover:bg-transparent hover:text-ink"
        >
          Pick it back up
        </button>
      </div>
    </section>
  );
}
