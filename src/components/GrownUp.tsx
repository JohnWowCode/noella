"use client";

import { useMemo, useState } from "react";
import { fromKey } from "@/lib/clock";
import { grownUp, household, LIFE_MARKS, marked, openIn } from "@/lib/grownup";
import { CADENCES, daysLeftInPeriod, isSettled } from "@/lib/recurrence";
import { titleOf } from "@/lib/rooms";
import { markLabel, marksOf } from "@/lib/stickers";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { Icon } from "./Icon";
import { Popover } from "./Popover";
import { Where } from "./Where";

/**
 * The grown-up half: the shopping, the bins, the renewals.
 *
 * Deliberately the plainest screen in the app. No ranks, no estimates, no
 * clock, no jester — you do not need to decide how much the bins matter, and
 * being asked would be its own small insult. What is owed, what it lives in,
 * and a box to add the next thing.
 *
 * A list that repeats empties itself when the week turns, which is not a
 * feature written for this screen: an item stores the moment it was ticked and
 * "done" simply stops being true when the period rolls. The machinery has been
 * in the app for weeks with nowhere to be seen.
 */
export function GrownUp({
  todayKey,
  onOpen,
}: {
  todayKey: string;
  onOpen: (id: string) => void;
}) {
  const { notes, addNote, patchNote } = useNoella();
  const today = useMemo(
    () => (todayKey ? fromKey(todayKey) : new Date()),
    [todayKey],
  );

  const mine = useMemo(() => household(notes), [notes]);
  const owed = useMemo(() => openIn(notes, mine, today), [notes, mine, today]);

  /** The rooms: a shopping list, a chores list, a renewals list. */
  const lists = useMemo(
    () =>
      mine
        .filter((n) => notes.some((c) => c.parentId === n.id))
        .filter((n) => !grownUp(notes, { ...n, icons: [] }) || marked(n))
        .sort((a, b) => a.order - b.order || titleOf(a).localeCompare(titleOf(b))),
    [mine, notes],
  );
  const listIds = new Set(lists.map((l) => l.id));

  /** Loose jobs: the ones that belong to no list. */
  const loose = owed.filter(
    (n) => !n.parentId || !listIds.has(n.parentId),
  );

  if (mine.length === 0) return <Nothing />;

  return (
    <>
      {/*
        One line, not a second copy of the screen.

        This opened with a "Needs doing" list of everything owed, and then the
        lists underneath said all of it again — eight items twice on one
        screen, which reads as twice as much to do. The lists are the screen;
        this is only the total, because the useful glance is "is the house
        square with me" and the useful detail is already three inches down.
      */}
      <p className="label mt-4 flex flex-wrap items-baseline gap-x-2 text-mute">
        {owed.length === 0 ? (
          "The house is square with you."
        ) : (
          <>
            The house wants {owed.length}{" "}
            {owed.length === 1 ? "thing" : "things"}.
          </>
        )}
      </p>

      {lists.map((list) => (
        <List
          key={list.id}
          list={list}
          today={today}
          onOpen={onOpen}
          onAdd={(body) =>
            void addNote({
              body,
              colorId: list.colorId,
              parentId: list.id,
              isTask: true,
            })
          }
        />
      ))}

      {/*
        The ones that belong to no list: the dentist, the thing you thought of
        in the car. They are not worth a list of their own and they must not
        fall down the back of one.
      */}
      {loose.length > 0 && (
        <section
          aria-label="Loose ends"
          className="mt-4 border border-rule bg-field"
        >
          <header className="flex flex-wrap items-baseline gap-x-3 border-b border-rule-soft px-4 py-3">
            <h2 className="title">Loose ends</h2>
            <span className="label text-mute">
              {loose.length} {loose.length === 1 ? "thing" : "things"}
            </span>
          </header>
          <ul className="flex flex-col">
            {loose.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 border-b border-rule-soft px-4 py-2.5 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    patchNote(n.id, {
                      doneAt: new Date().toISOString(),
                      isTask: true,
                    })
                  }
                  aria-label="Done"
                  className="tap mt-[6px] grid h-4 w-4 shrink-0 place-items-center border border-mute hover:border-ink"
                />
                <span className="mt-[5px] flex shrink-0 items-center gap-1.5 text-mute">
                  {marksOf(n).map((m) => (
                    <span key={m} title={markLabel(m)} className="flex">
                      <Icon name={m} size={15} />
                    </span>
                  ))}
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  <button
                    type="button"
                    onClick={() => onOpen(n.id)}
                    className="prose-note w-full text-left text-[calc(17px*var(--type))] leading-snug"
                  >
                    {n.body.split("\n", 1)[0]}
                  </button>
                  <Where id={n.id} onOpen={onOpen} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * One list, ticked down.
 *
 * The reset is the point. A shopping list you have to empty by hand is a
 * shopping list you stop using in week three, so a list with a cadence lets
 * every tick lapse when the period turns — and says how long that is, because
 * "resets in 2 days" is the difference between trusting it and checking it.
 */
function List({
  list,
  today,
  onOpen,
  onAdd,
}: {
  list: Note;
  today: Date;
  onOpen: (id: string) => void;
  onAdd: (body: string) => void;
}) {
  const { notes, patchNote } = useNoella();
  const [line, setLine] = useState("");
  const items = notes
    .filter((n) => n.parentId === list.id && n.archivedAt === null)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const done = items.filter((i) => isSettled(i, list.repeats, today));
  const left = items.length - done.length;

  return (
    <section
      aria-label={titleOf(list)}
      className="mt-4 border border-rule bg-field"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule-soft px-4 py-3">
        <button
          type="button"
          onClick={() => onOpen(list.id)}
          className="title text-left"
        >
          {titleOf(list)}
        </button>
        <span className="label text-mute">
          {left === 0 ? "all in" : `${left} left`}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {list.repeats && (
            <span className="label text-mute">
              back in {daysLeftInPeriod(list.repeats, today)}d
            </span>
          )}
          <Popover
            label="How often it comes back"
            set={list.repeats !== null}
            align="right"
            trigger={`label border px-2 py-1 ${
              list.repeats
                ? "border-ink"
                : "border-rule text-mute hover:border-ink"
            }`}
            current={list.repeats ?? "Repeat?"}
          >
            {(close) => (
              <span className="flex flex-col gap-1">
                {CADENCES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      patchNote(list.id, {
                        repeats: list.repeats === c ? null : c,
                      });
                      close();
                    }}
                    className={`label px-2 py-2 text-left ${
                      list.repeats === c ? "bg-ink text-paper" : "hover:bg-ink/10"
                    }`}
                  >
                    Every {c.replace("ly", "")}
                  </button>
                ))}
                {list.repeats && (
                  <button
                    type="button"
                    onClick={() => {
                      patchNote(list.id, { repeats: null });
                      close();
                    }}
                    className="label px-2 py-2 text-left hover:bg-ink/10"
                  >
                    Never
                  </button>
                )}
              </span>
            )}
          </Popover>
        </span>
      </header>

      <ul className="flex flex-col">
        {items.map((item) => {
          const settled = isSettled(item, list.repeats, today);
          return (
            <li
              key={item.id}
              className="flex items-start gap-3 border-b border-rule-soft px-4 py-2 last:border-b-0"
            >
              <button
                type="button"
                onClick={() =>
                  patchNote(item.id, {
                    doneAt: settled ? null : new Date().toISOString(),
                    isTask: true,
                  })
                }
                aria-label={settled ? "Not done after all" : "Done"}
                className="tap mt-[5px] grid h-4 w-4 shrink-0 place-items-center border border-mute text-[11px] leading-none hover:border-ink"
              >
                {settled ? "×" : ""}
              </button>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className={`prose-note min-w-0 flex-1 text-left text-[calc(16px*var(--type))] leading-snug ${
                  settled ? "text-mute line-through" : ""
                }`}
              >
                {item.body.split("\n", 1)[0]}
              </button>
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body = line.trim();
          if (!body) return;
          onAdd(body);
          setLine("");
        }}
        className="flex items-center gap-2 border-t border-rule-soft px-4 py-2.5"
      >
        <input
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder="And then?"
          aria-label={`Add to ${titleOf(list)}`}
          className="prose-note min-w-0 flex-1 border border-rule bg-paper px-2.5 py-2 text-[calc(16px*var(--type))] outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={!line.trim()}
          aria-label="Add it"
          className="label grid h-9 w-9 place-items-center border border-rule enabled:hover:bg-ink enabled:hover:text-paper disabled:opacity-40 [@media(hover:none)]:h-11 [@media(hover:none)]:w-11"
        >
          <Icon name="plus" size={15} />
        </button>
      </form>
    </section>
  );
}

/** Empty, and saying how to fill it — not standing there blank. */
function Nothing() {
  return (
    <section className="mt-4 border border-rule bg-field px-6 py-10">
      <p className="display text-[calc(22px*var(--type))] sm:text-[calc(26px*var(--type))]">
        Nothing grown-up yet.
      </p>
      <p className="prose-note mt-3 max-w-md text-[calc(16px*var(--type))] text-mute">
        Anything you mark{" "}
        <span className="inline-flex items-baseline gap-1.5">
          {LIFE_MARKS.map((m) => (
            <span key={m} className="inline-flex translate-y-0.5">
              <Icon name={m} size={15} />
            </span>
          ))}
        </span>{" "}
        lands here instead of in the middle of your work — shopping, bins,
        renewals, the dentist. Mark a folder and everything you put in it comes
        too, so a Groceries list only has to be said once.
      </p>
    </section>
  );
}
