"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useNoella } from "@/lib/store/provider";

const DAY_MS = 86_400_000;

// The clock is an external system, so the impure read belongs in a snapshot
// rather than in render. It never changes within a session.
const neverChanges = () => () => {};
const dayOnClient = () => Math.floor(Date.now() / DAY_MS);
const dayOnServer = () => 0;
import { Footer, Header, NavLink } from "./Chrome";
import { NoteCard } from "./NoteCard";
import { ThemeToggle } from "./ThemeToggle";

export function Today() {
  const { ready, notes } = useNoella();

  const open = useMemo(
    () =>
      notes
        .filter((n) => n.isTask && n.doneAt === null && n.archivedAt === null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [notes],
  );

  const pinned = useMemo(
    () => notes.filter((n) => n.pinned && n.archivedAt === null),
    [notes],
  );

  const day = useSyncExternalStore(neverChanges, dayOnClient, dayOnServer);

  // One old note, chosen by the day so it stays put until tomorrow.
  const resurfaced = useMemo(() => {
    const older = notes.filter((n) => n.archivedAt === null && !n.pinned);
    if (older.length === 0) return null;
    return older[day % older.length];
  }, [notes, day]);

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <NavLink href="/">Wall</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 sm:px-6">
        {!ready ? (
          <p className="label border border-rule bg-field px-6 py-14 text-center text-mute">
            Reading local store…
          </p>
        ) : (
          <>
            <Block title="Open" count={open.length} empty="Nothing open.">
              {open.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </Block>

            <Block
              title="Pinned"
              count={pinned.length}
              empty="Nothing pinned."
            >
              {pinned.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </Block>

            <Block
              title="Resurfaced"
              count={resurfaced ? 1 : 0}
              empty="Nothing to resurface yet."
            >
              {resurfaced && <NoteCard note={resurfaced} />}
            </Block>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Block({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-11">
      <h2 className="label mb-3 flex items-center gap-2 text-mute">
        <span>{title}</span>
        <span aria-hidden>·</span>
        <span>{count}</span>
      </h2>
      {count === 0 ? (
        <p className="label border border-rule bg-field px-6 py-12 text-center text-mute">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  );
}
