"use client";

import { useEffect, useRef, useState } from "react";
import {
  blocksOn,
  clashes,
  clockOf,
  hoursShown,
  minutesNow,
  type Block,
} from "@/lib/day";
import { PRIORITY } from "@/lib/priority";
import { contentsOf } from "@/lib/rooms";
import { marksOf } from "@/lib/stickers";
import { useNoella } from "@/lib/store/provider";
import { useCarry } from "./DragProvider";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

/** A minute of clock per pixel would be a five-hundred pixel strip. */
const PX_PER_MIN = 1.05;

/**
 * The day, as a column of hours you can put things in.
 *
 * A list says what you owe and never says when, and "when" is the question
 * that decides whether any of it happens. A timetable works on people who
 * cannot hold a plan in their head precisely because the plan is not in their
 * head — it is on a wall, in rows, and the row you are in is the thing you are
 * doing. That is the whole idea, and it is why the line marking now is the
 * loudest thing here.
 *
 * Folded until you use it: an unplanned day drawn as sixteen empty rows is a
 * demand, not a plan. One line until there is something in it.
 */
export function Day({
  todayKey,
  onOpen,
}: {
  todayKey: string;
  onOpen: (id: string) => void;
}) {
  const { notes, patchNote } = useNoella();
  const carry = useCarry();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => minutesNow(new Date()));
  const scroller = useRef<HTMLDivElement>(null);
  /** Only the first time it appears: yanking it back mid-read would be rude. */
  const landed = useRef(false);

  /*
   * The line marking now moves on its own. A plan that shows the wrong time is
   * worse than one that shows none, and a minute is fine enough — this is a
   * day, not a stopwatch.
   */
  useEffect(() => {
    const tick = () => setNow(minutesNow(new Date()));
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Put the current hour in the middle, once, when the strip first exists.
  useEffect(() => {
    const el = scroller.current;
    if (!el || landed.current) return;
    const line = el.querySelector<HTMLElement>("[data-now]");
    if (!line) return;
    landed.current = true;
    el.scrollTop = Math.max(0, line.offsetTop - el.clientHeight / 2);
  });

  const blocks = blocksOn(notes, todayKey);

  const clashing = clashes(blocks);
  const showing = open || blocks.length > 0;

  if (!showing) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label mt-4 flex w-full items-center gap-2 border border-rule-soft bg-field px-4 py-2.5 text-mute hover:border-ink hover:text-ink"
      >
        <Icon name="clock" size={14} />
        Block out the day
      </button>
    );
  }

  const { from, to } = hoursShown(blocks, now);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const top = (minutes: number) => (minutes - from * 60) * PX_PER_MIN;

  return (
    <section
      aria-label="The day"
      /* `group/day`, declared. The hover-only controls inside name this group
        and without it they never appear on a desktop at all. */
      className="group/day mt-4 border border-rule bg-field"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 border-b border-rule-soft px-4 py-3">
        <h2 className="title">The day</h2>
        {/* The time is the point of the strip, blocked or not: an empty day
          that will not tell you what o'clock it is has no reason to be open. */}
        <span className="label text-mute">
          {blocks.length === 0
            ? `${clockOf(now)} now · nothing blocked out`
            : `${blocks.length} blocked · ${clockOf(now)} now`}
        </span>
        {blocks.length === 0 && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="label ml-auto text-mute hover:text-ink"
          >
            Put it away
          </button>
        )}
      </header>

      {/*
        Scrolls inside itself, and opens on now.

        A day drawn hour by hour is over a thousand pixels tall, which is more
        than the screen it is on — so the strip would push everything under it
        off the bottom and, worse, open at seven in the morning when it is
        four in the afternoon. It keeps its own scroll and starts where you
        are, which is the only place worth starting.
      */}
      <div
        ref={scroller}
        className="relative max-h-[55vh] overflow-y-auto px-4 py-2
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
      <div className="relative" style={{ height: (to - from) * 60 * PX_PER_MIN + 16 }}>
        {hours.map((h) => (
          <div
            key={h}
            /*
              The hour is the drop target, and it is the whole width of the
              strip rather than a sliver, because a thumb aiming at 3pm should
              not have to find 3pm exactly.
            */
            data-drop-id={`drop:hour:${h * 60}`}
            className={`absolute right-4 left-4 border-t ${
              carry.dragging && carry.over === `drop:hour:${h * 60}`
                ? "border-ink bg-ink/10"
                : "border-rule-soft"
            }`}
            style={{ top: top(h * 60) + 8, height: 60 * PX_PER_MIN }}
          >
            <Slot
              hour={h}
              todayKey={todayKey}
              onPut={(id) =>
                patchNote(id, { blockAt: h * 60, todayOn: todayKey })
              }
            />
          </div>
        ))}

        {/*
          Now, drawn under the blocks rather than over them.

          A red line across a card reads as a line through its words — the
          block you are actually in looked like the one thing you had crossed
          off. It shows in the empty hours, hides behind the cards, and the
          block containing this minute says so with its own heavy border.
        */}
        {now >= from * 60 && now <= to * 60 && (
          <div
            aria-hidden
            data-now
            className="pointer-events-none absolute right-4 left-4 border-t-2 border-[var(--now)]"
            style={{ top: top(now) + 8 }}
          >
            <span className="label absolute -top-2 -left-1 bg-field pr-1 text-[var(--now)]">
              ▸
            </span>
          </div>
        )}
        {blocks.map((b) => (
          <Card
            key={b.note.id}
            block={b}
            clashing={clashing.has(b.note.id)}
            live={now >= b.at && now < b.at + b.minutes}
            top={top(b.at) + 8}
            onOpen={() => onOpen(b.note.id)}
            onFree={() => patchNote(b.note.id, { blockAt: null })}
            press={carry.press}
            grabbed={carry.grab?.id === b.note.id}
          />
        ))}

      </div>
      </div>
    </section>
  );
}

/**
 * An empty hour, and the way to fill it without dragging.
 *
 * Dragging is the good gesture and it is not the only one anybody has: on a
 * phone, mid-thought, a tap and a list is faster. It offers what is already
 * on today first, because the day is made of things you already promised.
 */
function Slot({
  hour,
  todayKey,
  onPut,
}: {
  hour: number;
  todayKey: string;
  onPut: (id: string) => void;
}) {
  const { notes } = useNoella();
  const free = notes.filter(
    (n) =>
      n.archivedAt === null &&
      n.doneAt === null &&
      n.blockAt === null &&
      contentsOf(notes, n.id).length === 0 &&
      (n.todayOn === todayKey || n.priority !== null || n.isTask),
  );
  const promised = free.filter((n) => n.todayOn === todayKey);
  const rest = free.filter((n) => n.todayOn !== todayKey).slice(0, 20);

  return (
    <span className="label absolute top-0 left-0 flex items-baseline gap-2 text-mute">
      <span className="w-14 shrink-0 tabular-nums opacity-70">
        {clockOf(hour * 60)}
      </span>
      {free.length > 0 && (
        <Popover
          label={`Put something at ${clockOf(hour * 60)}`}
          set={false}
          trigger="label px-1 opacity-0 group-hover/day:opacity-60 hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-40"
          current={<Icon name="plus" size={12} />}
        >
          {(close) => (
            <div className="flex max-h-64 w-56 flex-col gap-1 overflow-y-auto sm:w-64">
              {promised.length > 0 && (
                <p className="label text-mute">On today</p>
              )}
              {[...promised, ...rest].map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    onPut(n.id);
                    close();
                  }}
                  className="prose-note truncate px-2 py-2 text-left text-[calc(15px*var(--type))] hover:bg-ink/10"
                >
                  {n.body.split("\n", 1)[0] || "a note"}
                </button>
              ))}
              {rest.length > 0 && promised.length > 0 && (
                <p className="label mt-1 text-mute">Everything else</p>
              )}
            </div>
          )}
        </Popover>
      )}
    </span>
  );
}

/** One thing, at the time you said, for as long as you said. */
function Card({
  block,
  clashing,
  live,
  top,
  onOpen,
  onFree,
  press,
  grabbed,
}: {
  block: Block;
  clashing: boolean;
  live: boolean;
  top: number;
  onOpen: () => void;
  onFree: () => void;
  press: (id: string, e: React.PointerEvent) => void;
  grabbed: boolean;
}) {
  const { note, minutes } = block;
  const done = note.doneAt !== null;
  const marks = marksOf(note);
  return (
    <div
      onPointerDown={(e) => press(note.id, e)}
      style={{
        top,
        height: Math.max(26, minutes * PX_PER_MIN - 3),
        ...(note.priority
          ? { borderLeft: `4px solid ${PRIORITY[note.priority].hex}` }
          : null),
      }}
      className={`absolute right-4 left-[4.75rem] flex touch-none items-start gap-2 overflow-hidden border px-2 py-1 ${
        done
          ? "border-rule-soft bg-paper text-mute"
          : live
            ? "border-2 border-ink bg-paper"
            : "border-rule bg-paper"
      } ${clashing ? "outline-2 -outline-offset-2 outline-[var(--now)]" : ""} ${
        grabbed ? "opacity-35" : ""
      }`}
    >
      {marks.slice(0, 1).map((m) => (
        <span key={m} className="mt-[3px] shrink-0 text-mute">
          <Icon name={m} size={13} />
        </span>
      ))}
      <button
        type="button"
        data-nodrag
        onClick={onOpen}
        className={`prose-note min-w-0 flex-1 truncate text-left text-[calc(15px*var(--type))] ${
          done ? "line-through" : ""
        }`}
      >
        {note.body.split("\n", 1)[0] || "a note"}
      </button>
      <span className="label mt-[3px] shrink-0 text-mute tabular-nums">
        {minutes}m
      </span>
      <button
        type="button"
        data-nodrag
        onClick={onFree}
        aria-label="Take it off the day"
        className="tap mt-[2px] shrink-0 px-0.5 text-mute opacity-0 group-hover/day:opacity-70 hover:opacity-100 [@media(hover:none)]:opacity-50"
      >
        <Icon name="blocked" size={12} />
      </button>
    </div>
  );
}
