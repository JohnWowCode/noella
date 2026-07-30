"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { matches } from "@/lib/notes";
import { colorLabel, useNoella } from "@/lib/store/provider";
import { Footer, Header, NavLink } from "./Chrome";
import { Compose } from "./Compose";
import { NoteCard } from "./NoteCard";
import { Swatch } from "./Swatch";
import { ThemeToggle } from "./ThemeToggle";

export function Wall() {
  const { ready, notes, colors, patchColor } = useNoella();
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState<string | null>(null);
  const [composeColor, setComposeColor] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);

  const composeRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;

      if (e.key === "Escape" && !typing) {
        setQuery("");
        setWorld(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n") {
        e.preventDefault();
        composeRef.current?.focus();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (/^[1-8]$/.test(e.key)) {
        const target = colors[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          setComposeColor(target.id);
          composeRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [colors]);

  const visible = useMemo(() => {
    const rows = notes.filter(
      (n) =>
        n.archivedAt === null &&
        (world === null || n.colorId === world) &&
        (!onlyOpen || (n.isTask && n.doneAt === null)) &&
        matches(n, query),
    );
    // Pinned float, then reverse-chron. Nothing else reorders the wall.
    return rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes, world, onlyOpen, query]);

  const activeWorld = colors.find((c) => c.id === world) ?? null;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) {
      if (n.colorId) m.set(n.colorId, (m.get(n.colorId) ?? 0) + 1);
    }
    return m;
  }, [notes]);

  return (
    <div className="flex min-h-full flex-col">
      <Header
        right={
          <>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search  /"
              aria-label="Search notes"
              className="label w-28 border border-rule bg-field px-2 py-1.5
                         outline-none placeholder:text-mute focus:w-44"
            />
            <NavLink href="/today">Today</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5">
        <Compose
          colorId={composeColor}
          onColorId={setComposeColor}
          inputRef={composeRef}
        />

        {/* Filter row. Tap a swatch to enter that world. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="label text-mute">Filter</span>
          <div className="flex items-center gap-1.5">
            {colors.map((c, i) => (
              <Swatch
                key={c.id}
                color={c}
                index={i}
                selected={c.id === world}
                onSelect={() => setWorld(c.id === world ? null : c.id)}
                purpose="filter"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOnlyOpen((v) => !v)}
            aria-pressed={onlyOpen}
            className={`label border border-rule px-2 py-1.5 ${
              onlyOpen ? "bg-ink text-paper" : "text-mute hover:text-ink"
            }`}
          >
            Open tasks
          </button>
          {(world !== null || query || onlyOpen) && (
            <button
              type="button"
              onClick={() => {
                setWorld(null);
                setQuery("");
                setOnlyOpen(false);
              }}
              className="label ml-auto border border-rule px-2 py-1.5 hover:bg-ink hover:text-paper"
            >
              Clear · esc
            </button>
          )}
        </div>

        {/* Entering a world: the app takes on its identity. */}
        {activeWorld && (
          <WorldBand
            hex={activeWorld.hex}
            name={colorLabel(activeWorld, colors)}
            count={counts.get(activeWorld.id) ?? 0}
            onRename={(name) =>
              patchColor(activeWorld.id, { name: name || null })
            }
            onExit={() => setWorld(null)}
          />
        )}

        <section className="mt-4 border border-rule">
          {!ready ? (
            <Empty>Reading local store…</Empty>
          ) : visible.length === 0 ? (
            <Empty>
              {notes.length === 0
                ? "No rows. The wall is empty."
                : "No rows match this filter."}
            </Empty>
          ) : (
            visible.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                query={query}
                onEnterWorld={setWorld}
                onTag={(t) => setQuery(`#${t}`)}
              />
            ))
          )}
        </section>

        {ready && visible.length > 0 && (
          <p className="label mt-3 text-mute">
            {visible.length} of {notes.length} shown
          </p>
        )}
      </main>

      <Footer />
    </div>
  );
}

function WorldBand({
  hex,
  name,
  count,
  onRename,
  onExit,
}: {
  hex: string;
  name: string;
  count: number;
  onRename: (name: string) => void;
  onExit: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-rule px-4 py-3"
      style={{ backgroundColor: hex, color: "#111111" }}
    >
      <span className="label">World</span>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRename(value.trim());
            setEditing(false);
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              onRename(value.trim());
              setEditing(false);
            }}
            placeholder="Name it"
            aria-label="World name"
            className="label border border-current bg-transparent px-2 py-1
                       outline-none placeholder:opacity-60"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setValue(name.startsWith("WORLD ") ? "" : name);
            setEditing(true);
          }}
          className="font-mono text-[15px] tracking-[0.12em] underline decoration-1 underline-offset-4 hover:no-underline"
        >
          {name}
        </button>
      )}
      <span className="label opacity-70">{count} notes</span>
      <button
        type="button"
        onClick={onExit}
        className="label ml-auto border border-current px-2 py-1 hover:bg-[#111] hover:text-white"
      >
        Exit
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="label bg-field px-4 py-10 text-center text-mute">{children}</p>
  );
}
