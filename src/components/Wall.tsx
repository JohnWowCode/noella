"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { matches } from "@/lib/notes";
import { isProject } from "@/lib/projects";
import { colorLabel, useNoella } from "@/lib/store/provider";
import { Footer, Header, NavLink } from "./Chrome";
import { Compose } from "./Compose";
import { DataMenu } from "./DataMenu";
import { NoteCard } from "./NoteCard";
import { Swatch } from "./Swatch";
import { TagIndex } from "./TagIndex";
import { ThemeToggle } from "./ThemeToggle";

export function Wall() {
  const { ready, notes, colors, patchColor } = useNoella();
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [composeColor, setComposeColor] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyProjects, setOnlyProjects] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

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
        setTag(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n") {
        e.preventDefault();
        composeRef.current?.focus();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (/^[1-9]$/.test(e.key)) {
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
        (showArchive ? n.archivedAt !== null : n.archivedAt === null) &&
        // Steps are shown inside their project's card, not loose on the wall.
        n.parentId === null &&
        (world === null || n.colorId === world) &&
        (tag === null || n.tags.includes(tag)) &&
        (!onlyOpen || (n.isTask && n.doneAt === null)) &&
        (!onlyProjects || isProject(n)) &&
        matches(n, query),
    );
    // Pinned float, then reverse-chron. Nothing else reorders the wall.
    return rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes, world, tag, onlyOpen, onlyProjects, query, showArchive]);

  const activeWorld = colors.find((c) => c.id === world) ?? null;
  // Top-level rows: steps are counted with their project, not against the wall.
  const live = useMemo(
    () => notes.filter((n) => n.archivedAt === null && n.parentId === null),
    [notes],
  );
  const projectCount = useMemo(() => live.filter(isProject).length, [live]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of live) {
      if (n.colorId) m.set(n.colorId, (m.get(n.colorId) ?? 0) + 1);
    }
    return m;
  }, [live]);
  const archivedCount = notes.filter((n) => n.archivedAt !== null).length;
  const filtered =
    world !== null || tag !== null || query !== "" || onlyOpen || onlyProjects;

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
              className="label w-32 border border-rule bg-field px-2.5 py-2
                         outline-none placeholder:text-mute focus:w-48"
            />
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/money">Bills</NavLink>
            <NavLink href="/today">Today</NavLink>
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 sm:px-6">
        <Compose
          colorId={composeColor}
          onColorId={setComposeColor}
          inputRef={composeRef}
        />

        {/* Filter row. Tap a swatch to enter that world; the count is its weight. */}
        <div className="mt-7 flex flex-wrap items-start gap-x-4 gap-y-3">
          <span className="label mt-2.5 text-mute">Filter</span>
          <div className="flex flex-wrap items-start gap-2">
            {colors.map((c, i) => (
              <Swatch
                key={c.id}
                color={c}
                index={i}
                selected={c.id === world}
                onSelect={() => setWorld(c.id === world ? null : c.id)}
                purpose="filter"
                count={counts.get(c.id) ?? 0}
              />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyOpen((v) => !v)}
              aria-pressed={onlyOpen}
              className={`label border border-rule px-2.5 py-1.5 ${
                onlyOpen ? "bg-ink text-paper" : "text-mute hover:text-ink"
              }`}
            >
              Open tasks
            </button>
            {projectCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlyProjects((v) => !v)}
                aria-pressed={onlyProjects}
                className={`label border border-rule px-2.5 py-1.5 ${
                  onlyProjects ? "bg-ink text-paper" : "text-mute hover:text-ink"
                }`}
              >
                Projects {projectCount}
              </button>
            )}
            {archivedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowArchive((v) => !v)}
                aria-pressed={showArchive}
                className={`label border border-rule px-2.5 py-1.5 ${
                  showArchive ? "bg-ink text-paper" : "text-mute hover:text-ink"
                }`}
              >
                Archive {archivedCount}
              </button>
            )}
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setWorld(null);
                  setTag(null);
                  setQuery("");
                  setOnlyOpen(false);
                  setOnlyProjects(false);
                }}
                className="label border border-rule px-2.5 py-1.5 hover:bg-ink hover:text-paper"
              >
                Clear · esc
              </button>
            )}
          </div>
        </div>

        <TagIndex notes={notes} active={tag} onPick={setTag} />

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

        <section className="mt-6 flex flex-col gap-3">
          {!ready ? (
            <Empty>Reading local store…</Empty>
          ) : visible.length === 0 ? (
            <Empty>
              {showArchive
                ? "Nothing archived."
                : notes.length === 0
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
                onTag={setTag}
              />
            ))
          )}
        </section>

        {ready && (
          <div className="label mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-mute">
            <span>
              {visible.length} of {showArchive ? archivedCount : live.length}{" "}
              shown
            </span>
            <span className="ml-auto">
              <DataMenu />
            </span>
          </div>
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
      className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border border-rule px-6 py-4"
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
            className="label border border-current bg-transparent px-2 py-1.5
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
        className="label ml-auto border border-current px-2.5 py-1.5 hover:bg-[#111] hover:text-white"
      >
        Exit
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="label border border-rule bg-field px-6 py-14 text-center text-mute">
      {children}
    </p>
  );
}
