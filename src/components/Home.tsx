"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTodayKey } from "@/lib/clock";
import {
  bestRun,
  drifting,
  ledger,
  movesThisWeek,
  quietDays,
  streak,
} from "@/lib/momentum";
import { matches } from "@/lib/notes";
import { isList, isProject, projectTitle } from "@/lib/projects";
import { PRIORITIES, PRIORITY, rankOf, type Priority } from "@/lib/priority";
import { ALL_MARKS, markLabel, markOf, marksOf } from "@/lib/stickers";
import { countChildren, pathTo } from "@/lib/tree";
import { Icon, type IconName } from "./Icon";
import { Popover } from "./Popover";
import { swatchName } from "@/lib/store/defaults";
import { useNoella } from "@/lib/store/provider";
import { ON_COLOR_BUTTON, surfaceStyle } from "@/lib/surface";
import type { Color, Note } from "@/lib/types";
import { Footer, Header } from "./Chrome";
import { Compose } from "./Compose";
import { DataMenu } from "./DataMenu";
import { FolderLink } from "./FolderLink";
import { Jester } from "./Jester";
import { NoteCard } from "./NoteCard";
import { TagIndex } from "./TagIndex";
import { Today } from "./Today";
import { ThemeToggle } from "./ThemeToggle";

/** Cards rendered per page. Enough to fill any screen, cheap enough to be instant. */
const PAGE = 40;

/** Below this, grouping a list is more chrome than help. */
const GROUPABLE = 8;

/** Marks shown in the rail before the rest fold behind "more". */
const MARK_ROW = 6;

/**
 * One colour each, taken from the palette rather than invented: blue for what
 * is live, green for what is finished, amber for what you starred, and a grey
 * for the drawer things go into.
 */
const CHIP = {
  todo: "#6FA8F0",
  done: "#7ED97E",
  starred: "#F0B92E",
  archive: "#A9A296",
} as const;

const GROUPINGS = {
  none: "No grouping",
  folder: "By folder",
  mark: "By mark",
  kind: "By kind",
  priority: "By priority",
} as const;

type Grouping = "none" | "folder" | "mark" | "kind" | "priority";

type View =
  | "all"
  | "todo"
  | "done"
  | "starred"
  | "projects"
  | "lists"
  | "archive";

/**
 * The whole app, on one screen.
 *
 * There used to be three — Today, the wall, and Projects — and each answered a
 * different slice of the same question one click away from the others. Filing
 * a thought meant navigating, and finding it again meant navigating back. They
 * are one page now: write at the top, let the jester pick when you cannot, and
 * filter one list of everything by folder, by kind, or by what is still open.
 */
export function Home() {
  const { ready, notes, colors, patchColor, patchNote } = useNoella();
  const todayKey = useTodayKey();

  const [query, setQuery] = useState("");
  const [world, setWorld] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [composeColor, setComposeColor] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  /** The container you are standing in, or null for the top of the wall. */
  const [inside, setInside] = useState<string | null>(null);
  const [group, setGroup] = useState<Grouping>("none");
  const [level, setLevel] = useState<Priority | null>(null);
  /** One mark, used as a filter. Marks are the tags now. */
  const [mark, setMark] = useState<IconName | null>(null);

  const composeRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

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
        setView("all");
        setLevel(null);
        setMark(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        composeRef.current?.focus();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const here = useMemo(
    () => (inside ? (notes.find((n) => n.id === inside) ?? null) : null),
    [notes, inside],
  );
  const trail = useMemo(
    () => (inside ? pathTo(notes, inside) : []),
    [notes, inside],
  );
  const childCount = inside ? countChildren(notes, inside) : 0;

  /*
   * What this screen is a view of.
   *
   * At the top of the wall that is everything with nothing above it; inside a
   * folder it is that folder's contents. Searching escapes the folder entirely
   * and looks at the whole tree — a search that only finds what is under your
   * feet is a search you cannot trust.
   */
  const searching = query.trim() !== "";
  const top = useMemo(() => {
    if (searching) return notes;
    if (inside) return notes.filter((n) => n.parentId === inside);
    return notes.filter((n) => n.parentId === null);
  }, [notes, inside, searching]);
  const live = useMemo(() => top.filter((n) => n.archivedAt === null), [top]);

  const counts = useMemo(() => {
    const byWorld = new Map<string, number>();
    const byLevel = new Map<Priority, number>();
    const byMark = new Map<IconName, number>();
    let todo = 0;
    let done = 0;
    let starred = 0;
    let projects = 0;
    let lists = 0;
    for (const n of live) {
      if (n.colorId) byWorld.set(n.colorId, (byWorld.get(n.colorId) ?? 0) + 1);
      if (n.priority)
        byLevel.set(n.priority, (byLevel.get(n.priority) ?? 0) + 1);
      for (const m of marksOf(n)) byMark.set(m, (byMark.get(m) ?? 0) + 1);
      if (n.isTask && n.doneAt === null) todo += 1;
      if (n.doneAt !== null) done += 1;
      if (n.pinned) starred += 1;
      if (isProject(n)) projects += 1;
      if (isList(n)) lists += 1;
    }
    return {
      byWorld,
      byLevel,
      byMark,
      all: live.length,
      todo,
      done,
      starred,
      projects,
      lists,
      archive: top.length - live.length,
    };
  }, [live, top]);

  const visible = useMemo(() => {
    const pool =
      view === "archive" ? top.filter((n) => n.archivedAt !== null) : live;
    const rows = pool.filter(
      (n) =>
        (world === null || n.colorId === world) &&
        (tag === null || n.tags.includes(tag)) &&
        (view !== "todo" || (n.isTask && n.doneAt === null)) &&
        (view !== "done" || n.doneAt !== null) &&
        (view !== "starred" || n.pinned) &&
        (view !== "projects" || isProject(n)) &&
        (view !== "lists" || isList(n)) &&
        (level === null || n.priority === level) &&
        (mark === null || marksOf(n).includes(mark)) &&
        matches(n, query),
    );
    // Favourites float, then newest first. Nothing else reorders the list.
    return rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [top, live, world, tag, view, query, level, mark]);

  // Any change to what is on screen restarts the list from the top. Adjusted
  // during render, so the first paint is already the short list.
  const signature = [query, world, tag, view, level, mark].join(" ");
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setLimit(PAGE);
  }

  const shown = useMemo(() => visible.slice(0, limit), [visible, limit]);

  /**
   * The list, cut into bands.
   *
   * One stream is fine at ten notes and unreadable at two hundred. Ungrouped
   * stays the default, because a heading above every single row is its own
   * kind of noise — and bands come out in a fixed order rather than by size,
   * so the same wall looks the same way twice.
   */
  const groups = useMemo(() => {
    if (group === "none") {
      return [
        {
          key: "all",
          name: null as string | null,
          swatch: null,
          icon: null as IconName | null,
          rows: shown,
        },
      ];
    }
    const bands = new Map<
      string,
      {
        key: string;
        name: string | null;
        swatch: string | null;
        icon: IconName | null;
        rows: Note[];
        at: number;
      }
    >();
    const put = (
      key: string,
      name: string,
      swatch: string | null,
      at: number,
      note: Note,
      icon: IconName | null = null,
    ) => {
      const band = bands.get(key);
      if (band) band.rows.push(note);
      else bands.set(key, { key, name, swatch, icon, rows: [note], at });
    };

    for (const n of shown) {
      if (group === "folder") {
        const c = n.colorId ? colors.find((x) => x.id === n.colorId) : null;
        if (c) {
          const i = colors.indexOf(c);
          put(c.id, c.name ?? swatchName(i), c.hex, i, n);
        } else {
          put("none", "No folder", null, colors.length, n);
        }
      } else if (group === "mark") {
        /*
         * A note wearing three marks belongs in three bands, which is the one
         * place grouping stops being a partition — and has to be, because
         * "show me everything about money" must not skip the note that is
         * also about a bug.
         */
        const worn = marksOf(n);
        if (worn.length === 0) {
          put("none", "Unmarked", null, ALL_MARKS.length, n);
        } else {
          for (const m of worn) {
            put(m, markLabel(m), null, ALL_MARKS.indexOf(m), n, m);
          }
        }
      } else if (group === "priority") {
        if (n.priority) {
          put(
            n.priority,
            PRIORITY[n.priority].label,
            PRIORITY[n.priority].hex,
            rankOf(n.priority),
            n,
          );
        } else {
          put("none", "Unranked", null, PRIORITIES.length, n);
        }
      } else {
        const kind = isProject(n)
          ? { k: "project", n: "Projects", at: 0 }
          : isList(n)
            ? { k: "list", n: "Lists", at: 1 }
            : n.isTask
              ? { k: "todo", n: "To do", at: 2 }
              : { k: "note", n: "Notes", at: 3 };
        put(kind.k, kind.n, null, kind.at, n);
      }
    }
    return [...bands.values()].sort((a, b) => a.at - b.at);
  }, [shown, group, colors]);
  const more = visible.length - shown.length;
  const loadMore = useCallback(() => setLimit((n) => n + PAGE), []);

  useEffect(() => {
    const el = moreRef.current;
    if (!el || more === 0) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, loadMore]);

  const cells = useMemo(
    () => (todayKey ? ledger(notes, todayKey) : []),
    [notes, todayKey],
  );
  const drift = useMemo(
    () => (todayKey ? drifting(notes, todayKey) : []),
    [notes, todayKey],
  );
  const week = movesThisWeek(cells);
  const filtered =
    world !== null ||
    tag !== null ||
    query !== "" ||
    view !== "all" ||
    level !== null ||
    mark !== null;
  const activeWorld = colors.find((c) => c.id === world) ?? null;
  // The bands below the list are about the whole wall over weeks, so they only
  // belong on the unfiltered top level.
  const quiet =
    view === "all" &&
    world === null &&
    tag === null &&
    level === null &&
    mark === null &&
    !query &&
    !inside;

  const open = useCallback((id: string) => {
    setInside(id);
    setQuery("");
    window.scrollTo({ top: 0 });
  }, []);

  /*
   * Deep links, including the ones the MCP server hands out.
   *
   * A link to a note three folders down is useless if it lands on the top of
   * the wall, so the hash walks in: stand in the note's parent, then scroll to
   * the card itself.
   */
  useEffect(() => {
    if (!ready) return;
    const match = /^#note-(.+)$/.exec(window.location.hash);
    if (!match) return;
    const target = notes.find((n) => n.id === match[1]);
    if (!target) return;

    let live = true;
    let timer = 0;
    // The URL is an external system, so it is read here and applied on the
    // next microtask — setting state straight from an effect body cascades.
    Promise.resolve().then(() => {
      if (!live) return;
      setInside(target.parentId);
      timer = window.setTimeout(() => {
        document
          .getElementById(`note-${target.id}`)
          ?.scrollIntoView({ block: "center" });
      }, 120);
    });
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // Runs once the store is ready; re-running on every note change would keep
    // yanking you back to the link you followed twenty minutes ago.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
              aria-label="Search everything"
              className="label w-28 border border-rule bg-field px-3 py-2
                         outline-none placeholder:text-mute focus:w-44"
            />
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
        {here && (
          <Trail
            trail={trail}
            here={here}
            onGo={(id) => (id === null ? setInside(null) : open(id))}
          />
        )}

        {/* Inside a folder, the folder itself is the first thing on screen:
            its own words, its pictures, its status. It is a note like any
            other and hiding it would make it feel like a container the app
            invented rather than something you wrote. */}
        {here && (
          <div className="mb-4">
            <NoteCard
              note={here}
              query={query}
              onTag={setTag}
              onOpen={open}
              heading
            />
          </div>
        )}

        {/*
          The offer, at the only moment it means anything.

          Deciding "project or list?" at the keyboard meant classifying a
          thought before writing it, which is why the tabs are gone. But a note
          that has grown contents is asking a real question, and this is where
          it gets asked — once, quietly, and never again after an answer.
        */}
        {here &&
          !isProject(here) &&
          !isList(here) &&
          childCount > 0 &&
          here.archivedAt === null && (
            <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-rule-soft bg-field px-4 py-3">
              <span className="prose-note text-[15px] text-mute">
                {childCount} things in here now. Want to keep track of it?
              </span>
              <button
                type="button"
                onClick={() => patchNote(here.id, { projectStatus: "idea" })}
                className="label ml-auto border border-rule px-2.5 py-1.5 hover:bg-ink hover:text-paper"
              >
                As a project
              </button>
              <button
                type="button"
                onClick={() => patchNote(here.id, { isList: true })}
                className="label border border-rule px-2.5 py-1.5 hover:bg-ink hover:text-paper"
              >
                As a list
              </button>
            </p>
          )}

        <Compose
          key={inside ?? "root"}
          colorId={composeColor}
          onColorId={setComposeColor}
          inputRef={composeRef}
          parentId={inside}
          parentName={here ? projectTitle(here) : null}
        />

        {/*
          What you promised, above what you have.

          The jester answers "I cannot choose" and the wall answers "what have
          I got"; neither answers "what did I say I would do today", which is
          the only question with an end to it. It sits directly under the box
          you write in and above everything else, and it is not there at all
          until you have put something on it.
        */}
        {!inside && todayKey && <Today todayKey={todayKey} onOpen={open} />}

        {!inside && (
          <div className="mt-4">
            <Jester />
          </div>
        )}

        {live.length > 0 && !inside && (
          <>
            {/*
              Nothing on this row exists until it means something.

              It used to be seven view chips, three ranks and four grouping
              buttons — fourteen controls standing over an empty wall, most of
              them filtering to nothing. Each one now waits for its own count,
              so a new wall shows none of them and a busy one shows the ones
              you have earned. Projects and Lists went entirely: grouping by
              Kind already says that, and said it better.
            */}
            {(counts.todo > 0 ||
              counts.done > 0 ||
              counts.starred > 0 ||
              counts.archive > 0 ||
              counts.byLevel.size > 0 ||
              counts.byMark.size > 0 ||
              live.length >= GROUPABLE ||
              filtered) && (
              <div className="mt-7 flex flex-wrap items-center gap-1.5">
                {counts.todo > 0 && (
                  <Chip
                    on={view === "todo"}
                    onClick={() => setView(view === "todo" ? "all" : "todo")}
                    count={counts.todo}
                    hex={CHIP.todo}
                  >
                    To do
                  </Chip>
                )}
                {counts.done > 0 && (
                  <Chip
                    on={view === "done"}
                    onClick={() => setView(view === "done" ? "all" : "done")}
                    count={counts.done}
                    hex={CHIP.done}
                  >
                    Done
                  </Chip>
                )}
                {counts.starred > 0 && (
                  <Chip
                    on={view === "starred"}
                    onClick={() =>
                      setView(view === "starred" ? "all" : "starred")
                    }
                    count={counts.starred}
                    hex={CHIP.starred}
                  >
                    <Icon name="starFilled" size={12} />
                  </Chip>
                )}
                {counts.archive > 0 && (
                  <Chip
                    on={view === "archive"}
                    onClick={() =>
                      setView(view === "archive" ? "all" : "archive")
                    }
                    count={counts.archive}
                    hex={CHIP.archive}
                  >
                    Archive
                  </Chip>
                )}

                {PRIORITIES.filter((p) => counts.byLevel.get(p)).map((p) => {
                  const on = level === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setLevel(on ? null : p)}
                      aria-pressed={on}
                      title={PRIORITY[p].hint}
                      className="label flex items-center gap-1.5 border px-2.5 py-1.5"
                      style={
                        on
                          ? {
                              backgroundColor: PRIORITY[p].hex,
                              borderColor: PRIORITY[p].hex,
                              color: "#111111",
                            }
                          : { borderColor: "var(--rule)" }
                      }
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5"
                        style={{ backgroundColor: PRIORITY[p].hex }}
                      />
                      {PRIORITY[p].label}
                      <span className="tabular-nums opacity-65">
                        {counts.byLevel.get(p)}
                      </span>
                    </button>
                  );
                })}

                {/* Grouping earns its place once there is enough to group. */}
                {live.length >= GROUPABLE && (
                  <Popover
                    label="Group the list"
                    set={group !== "none"}
                    align="right"
                    current={
                      <span className="label">
                        {group === "none" ? "Group" : GROUPINGS[group]}
                      </span>
                    }
                  >
                    {(close) => (
                      <span className="flex flex-col gap-1">
                        {(
                          Object.keys(GROUPINGS) as (keyof typeof GROUPINGS)[]
                        ).map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setGroup(id);
                              close();
                            }}
                            className={`label px-2 py-2 text-left ${
                              group === id
                                ? "bg-ink text-paper"
                                : "hover:bg-ink/10"
                            }`}
                          >
                            {GROUPINGS[id]}
                          </button>
                        ))}
                      </span>
                    )}
                  </Popover>
                )}

                {filtered && (
                  <button
                    type="button"
                    onClick={() => {
                      setView("all");
                      setWorld(null);
                      setTag(null);
                      setLevel(null);
                      setMark(null);
                      setQuery("");
                    }}
                    className="label ml-auto border border-rule px-2.5 py-1.5 text-mute hover:bg-ink hover:text-paper"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            <Marks
              active={mark}
              counts={counts.byMark}
              onPick={(m) => setMark(m === mark ? null : m)}
            />

            <Worlds
              active={world}
              counts={counts.byWorld}
              onPick={(id) => setWorld(id === world ? null : id)}
            />

            <TagIndex notes={notes} active={tag} onPick={setTag} />
          </>
        )}

        {activeWorld && (
          <WorldBand
            color={activeWorld}
            index={colors.indexOf(activeWorld)}
            count={counts.byWorld.get(activeWorld.id) ?? 0}
            onRename={(name) =>
              patchColor(activeWorld.id, { name: name || null })
            }
            onExit={() => setWorld(null)}
          />
        )}

        <section className="mt-5 flex flex-col gap-3">
          {!ready ? (
            <Empty>Reading what you have…</Empty>
          ) : notes.length === 0 ? (
            <FirstRun />
          ) : visible.length === 0 ? (
            <Empty>
              {view === "archive"
                ? "Nothing archived."
                : inside
                  ? `Nothing in ${projectTitle(here!)} yet. Put something in it up there.`
                  : "Nothing here. Try another folder, or clear the filters."}
            </Empty>
          ) : (
            groups.map((band) => (
              <section key={band.key} className="flex flex-col gap-3">
                {band.name !== null && (
                  <h3 className="title mt-3 flex items-baseline gap-2.5 first:mt-0">
                    {band.swatch && (
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 self-center border border-rule"
                        style={{ backgroundColor: band.swatch }}
                      />
                    )}
                    {band.icon && (
                      <span className="self-center">
                        <Icon name={band.icon} size={17} />
                      </span>
                    )}
                    {band.name}
                    <span className="label font-normal text-mute tabular-nums">
                      {band.rows.length}
                    </span>
                  </h3>
                )}
                {band.rows.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    query={query}
                    onTag={setTag}
                    onOpen={open}
                    // While searching you are looking at the whole tree, so a
                    // result has to say where it came from or it is just a
                    // sentence with no address.
                    path={searching ? pathTo(notes, n.id) : undefined}
                  />
                ))}
              </section>
            ))
          )}
        </section>

        {more > 0 && (
          <div ref={moreRef} className="mt-3">
            <button
              type="button"
              onClick={loadMore}
              className="label w-full border border-rule bg-field px-4 py-4 text-mute hover:bg-ink hover:text-paper"
            >
              {more} more
            </button>
          </div>
        )}

        {/* Both of these are about the shape of a few weeks, not about what is
            in front of you, so they sit under the list and only when the list
            is the whole list. */}
        {quiet && drift.length > 0 && (
          <section className="mt-12">
            <h2 className="title mb-3 flex flex-wrap items-baseline gap-x-2.5">
              Still want these?
              <span className="label font-normal text-mute">
                no wrong answer
              </span>
            </h2>
            <div className="flex flex-col gap-2">
              {drift.map((p) => (
                <Drifting
                  key={p.id}
                  project={p}
                  quiet={quietDays(notes, p, todayKey ?? "")}
                />
              ))}
            </div>
          </section>
        )}

        {quiet && cells.some((c) => c.moves > 0) && (
          <Ledger cells={cells} week={week} />
        )}

        {ready && notes.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
            <FolderLink />
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

/**
 * Where you are, and every way back.
 *
 * Nesting without a trail is a maze — you can go in, and then the only way out
 * is the browser's back button, which on a single-page wall does nothing. Each
 * ancestor is a button, so any level is one click away rather than one click
 * per level.
 */
function Trail({
  trail,
  here,
  onGo,
}: {
  trail: Note[];
  here: Note;
  onGo: (id: string | null) => void;
}) {
  return (
    <nav
      aria-label="Where you are"
      className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1"
    >
      <button
        type="button"
        onClick={() => onGo(null)}
        className="label border border-rule px-2 py-1.5 text-mute hover:bg-ink hover:text-paper"
      >
        Everything
      </button>
      {trail.map((step) => (
        <span key={step.id} className="flex items-center gap-1.5">
          <span aria-hidden className="label text-mute">
            ›
          </span>
          <button
            type="button"
            onClick={() => onGo(step.id)}
            className="label flex max-w-48 items-center gap-1.5 border border-rule px-2 py-1.5 text-mute hover:bg-ink hover:text-paper"
          >
            <TrailMark note={step} />
            {projectTitle(step)}
          </button>
        </span>
      ))}
      <span aria-hidden className="label text-mute">
        ›
      </span>
      <span className="label flex max-w-64 items-center gap-1.5 border-2 border-ink px-2 py-1.5">
        <TrailMark note={here} />
        {projectTitle(here)}
      </span>
    </nav>
  );
}

/** A folder's marks, inline in the breadcrumb. Kept small; it is a label. */
function TrailMark({ note }: { note: Note }) {
  const marks = marksOf(note);
  if (marks.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {marks.slice(0, 2).map((m) => (
        <Icon key={m} name={m} size={13} />
      ))}
    </span>
  );
}

/**
 * A filter, with its own colour.
 *
 * The row was five identical grey boxes and you had to read every one to find
 * the one you wanted. A marker in front means you stop reading and start
 * recognising — the same trick the ranks and the folders already use, so the
 * whole row is scanned rather than parsed.
 */
function Chip({
  on,
  onClick,
  count,
  hex,
  children,
}: {
  on: boolean;
  onClick: () => void;
  count: number;
  hex: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="label flex items-center gap-1.5 border px-2.5 py-1.5"
      style={
        on
          ? { backgroundColor: hex, borderColor: hex, color: "#111111" }
          : { borderColor: "var(--rule)" }
      }
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0"
        style={{ backgroundColor: hex }}
      />
      {children}
      {count > 0 && <span className="tabular-nums opacity-65">{count}</span>}
    </button>
  );
}

/**
 * The marks you are actually using.
 *
 * Same rule as the folder rail: a mark nobody has used is a button that
 * returns an empty list, so it is not drawn. What is left is a row of the
 * reasons your wall is currently full of — Bug 12, Money 4, Ship 2 — which is
 * a summary of what you are actually doing as much as it is a filter, and the
 * only place in the app that says it in one line.
 *
 * They sit above the folders because a mark cuts across every folder, and
 * below the ranks because a rank is about today and a mark is about forever.
 */
function Marks({
  active,
  counts,
  onPick,
}: {
  active: IconName | null;
  counts: Map<IconName, number>;
  onPick: (mark: IconName) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const used = ALL_MARKS.filter((m) => (counts.get(m) ?? 0) > 0);
  if (used.length === 0) return null;

  /*
   * Heaviest first, and only the first six.
   *
   * In use order the row came out alphabetical-by-accident and ran to
   * thirteen chips over two lines, which is a navigation bar, not a filter.
   * The six you have most of answer nearly every question; the tail is one
   * click away and the one you have selected is always in the list, so
   * filtering never makes its own chip vanish.
   */
  const ranked = [...used].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
  );
  const shown =
    expanded || ranked.length <= MARK_ROW
      ? ranked
      : [
          ...ranked.slice(0, MARK_ROW),
          ...(active && !ranked.slice(0, MARK_ROW).includes(active)
            ? [active]
            : []),
        ];
  const hidden = ranked.length - shown.length;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {shown.map((m) => {
        const on = m === active;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onPick(m)}
            aria-pressed={on}
            className={`flex items-center gap-1.5 border px-2 py-1.5 ${
              on
                ? "border-ink bg-ink text-paper"
                : "border-rule hover:border-ink"
            }`}
          >
            <Icon name={m} size={15} />
            <span className="label">{markLabel(m)}</span>
            <span className="label tabular-nums opacity-60">
              {counts.get(m)}
            </span>
          </button>
        );
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="label text-mute underline decoration-1 underline-offset-2 hover:text-ink"
        >
          +{hidden} more
        </button>
      )}
      {expanded && ranked.length > MARK_ROW && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="label text-mute underline decoration-1 underline-offset-2 hover:text-ink"
        >
          Fewer
        </button>
      )}
    </div>
  );
}

/**
 * The folders you are actually using.
 *
 * All thirty-six live in the compose box, where you pick one. Here only the
 * worlds holding something appear, named and counted — a rail of empty colours
 * is a rail of buttons that all return the same empty result.
 */
function Worlds({
  active,
  counts,
  onPick,
}: {
  active: string | null;
  counts: Map<string, number>;
  onPick: (id: string) => void;
}) {
  const { colors } = useNoella();
  const used = colors.filter((c) => (counts.get(c.id) ?? 0) > 0);
  if (used.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {used.map((c) => {
        const index = colors.indexOf(c);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            aria-pressed={c.id === active}
            className={`flex items-center gap-2 border px-2 py-1.5 ${
              c.id === active
                ? "border-ink bg-ink text-paper"
                : "border-rule hover:border-ink"
            }`}
          >
            <span
              aria-hidden
              className="grid h-4 w-4 place-items-center border border-rule-soft"
              style={{ backgroundColor: c.hex, color: "#111111" }}
            >
              {markOf(c.emoji) && <Icon name={markOf(c.emoji)!} size={11} />}
            </span>
            <span className="label">{c.name ?? swatchName(index)}</span>
            <span className="label tabular-nums opacity-60">
              {counts.get(c.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Inside a folder, the app takes on its colour and offers you its name. */
function WorldBand({
  color,
  index,
  count,
  onRename,
  onExit,
}: {
  color: Color;
  index: number;
  count: number;
  onRename: (name: string) => void;
  onExit: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const name = color.name ?? swatchName(index);

  return (
    <div
      className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-ink px-5 py-4"
      style={surfaceStyle(color)}
    >
      <span className="label opacity-70">Folder</span>
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
            aria-label="Folder name"
            className="prose-note border border-current bg-transparent px-2 py-1
                       text-[17px] outline-none placeholder:opacity-60"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setValue(color.name ?? "");
            setEditing(true);
          }}
          className="prose-note text-[19px] underline decoration-1 underline-offset-4 hover:no-underline"
        >
          {name}
        </button>
      )}
      <FolderSticker color={color} />
      <span className="label opacity-70">{count} in here</span>
      <button
        type="button"
        onClick={onExit}
        className={`label ml-auto border px-2.5 py-1.5 ${ON_COLOR_BUTTON}`}
      >
        Out
      </button>
    </div>
  );
}

/** Give a colour folder a face. The field has existed unused since day one. */
function FolderSticker({ color }: { color: Color }) {
  const { patchColor } = useNoella();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Folder mark"
        className={`grid h-8 w-8 place-items-center border ${ON_COLOR_BUTTON}`}
      >
        <Icon name={markOf(color.emoji) ?? "tag"} size={17} />
      </button>
      {open && (
        <span className="absolute left-0 z-20 mt-1 grid w-80 grid-cols-3 gap-1 border-2 border-ink bg-paper p-2 text-ink">
          {ALL_MARKS.map((glyph) => (
            <button
              key={glyph}
              type="button"
              onClick={() => {
                patchColor(color.id, {
                  emoji: glyph === markOf(color.emoji) ? null : glyph,
                });
                setOpen(false);
              }}
              aria-label={markLabel(glyph)}
              className={`flex items-center gap-1.5 border px-1.5 py-1.5 ${
                glyph === markOf(color.emoji)
                  ? "border-ink bg-ink text-paper"
                  : "border-transparent hover:border-rule"
              }`}
            >
              <Icon name={glyph} size={16} />
              <span className="label">{markLabel(glyph)}</span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function Drifting({ project, quiet }: { project: Note; quiet: number }) {
  const { patchNote } = useNoella();
  return (
    <article className="flex flex-col gap-3 border border-rule bg-field px-4 py-3.5 sm:flex-row sm:items-center">
      <span className="prose-note text-[16px] leading-snug sm:flex-1">
        {projectTitle(project)}
      </span>
      <span className="label tabular-nums text-mute">quiet {quiet}d</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Small
          onClick={() =>
            patchNote(project.id, { projectStatus: "active", order: -1 })
          }
        >
          Back on
        </Small>
        <Small
          onClick={() => patchNote(project.id, { projectStatus: "paused" })}
        >
          Park
        </Small>
        <Small
          onClick={() =>
            patchNote(project.id, { archivedAt: new Date().toISOString() })
          }
        >
          Drop
        </Small>
      </span>
    </article>
  );
}

function Small({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
    >
      {children}
    </button>
  );
}

/** Eight weeks of days, and what they add up to. Quiet, and last. */
function Ledger({
  cells,
  week,
}: {
  cells: { key: string; moves: number }[];
  week: number;
}) {
  const total = cells.reduce((n, c) => n + c.moves, 0);
  return (
    <section className="mt-12">
      <h2 className="title mb-3 flex items-baseline gap-2.5">
        Ledger
        <span className="label font-normal text-mute">last 8 weeks</span>
      </h2>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5 border border-rule bg-field px-5 py-5">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {cells.map((c) => (
            <span
              key={c.key}
              title={`${c.key} — ${c.moves} finished`}
              className="h-3.5 w-3.5 border border-rule-soft"
              style={{
                backgroundColor:
                  c.moves === 0
                    ? "transparent"
                    : c.moves === 1
                      ? "color-mix(in srgb, var(--ink) 32%, transparent)"
                      : c.moves < 4
                        ? "color-mix(in srgb, var(--ink) 64%, transparent)"
                        : "var(--ink)",
              }}
            />
          ))}
        </div>
        <dl className="flex flex-1 flex-wrap items-baseline justify-between gap-x-8 gap-y-4">
          <Figure value={week} unit="done" label="this week" />
          <Figure value={total} unit="done" label="8 weeks" />
          <Figure
            value={bestRun(cells)}
            unit={bestRun(cells) === 1 ? "day" : "days"}
            label="best run"
          />
          <Figure
            value={streak(cells)}
            unit={streak(cells) === 1 ? "day" : "days"}
            label="right now"
          />
        </dl>
      </div>
    </section>
  );
}

function Figure({
  value,
  unit,
  label,
}: {
  value: number;
  unit: string;
  label: string;
}) {
  return (
    <div>
      <dd className="prose-note text-[30px] leading-none tabular-nums">
        {value}
        <span className="label ml-1.5 align-baseline text-mute">{unit}</span>
      </dd>
      <dt className="label mt-2 text-mute">{label}</dt>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="prose-note border border-rule bg-field px-6 py-14 text-center text-[16px] text-mute">
      {children}
    </p>
  );
}

function FirstRun() {
  return (
    <div className="border border-rule bg-field px-6 py-10 sm:px-10 sm:py-12">
      <p className="display text-[26px] sm:text-[32px]">
        Write anything up there.
      </p>
      <p className="prose-note mt-4 max-w-lg text-[17px] leading-relaxed text-mute">
        A thought, a job, half an idea, a photo, a clip. Say what it is along
        the top of the box.
      </p>
      <p className="prose-note mt-3 max-w-lg text-[17px] leading-relaxed text-mute">
        Then <em>Open</em> anything and put things inside it, as deep as you
        like — a site holds a game, the game holds its bugs, a bug holds its
        screenshots. Colours cut across all of it, so one note can live in Cave
        Sniper and still show up under red.
      </p>
    </div>
  );
}
