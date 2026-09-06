/**
 * Noella as tools, independent of how a model reaches them.
 *
 * `server.mjs` serves these over stdio, for Claude Code and Claude Desktop.
 * `http.mjs` serves the same set over HTTP, for anything that can only talk to
 * a remote MCP server — ChatGPT, and claude.ai on the web and on a phone. One
 * definition, so the two can never drift apart.
 *
 * See shape.mjs for why any of it works through a folder.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  INBOX_DIR,
  MARKS,
  PRIORITIES,
  RANK,
  WALL_FILE,
  childrenOf,
  defaultFolderName,
  folderName,
  isRoom,
  marksOf,
  title,
  view,
  whereIs,
} from "./shape.mjs";

/** Where the shared folder is: an explicit path, then the env, then a default. */
export function folderFrom(argv) {
  return resolve(argv ?? process.env.NOELLA_FOLDER ?? join(homedir(), "Noella"));
}

/**
 * Deep links back into the app. Every card carries `id="note-<id>"`, so these
 * are links that actually scroll to the thing rather than decorative ids.
 */
const APP_URL = (
  process.env.NOELLA_APP_URL ?? "https://johnwowcode.github.io/noella/"
).replace(/\/*$/, "/");

const link = (id) => `${APP_URL}#note-${id}`;

/** Local calendar day, matching the browser's. A day is where you are. */
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// --------------------------------------------------------------- the folder

/** Everything the tools answer from. Re-read per call: the tab rewrites it. */
async function wall(folder) {
  let raw;
  try {
    raw = await readFile(join(folder, WALL_FILE), "utf8");
  } catch {
    throw new Error(
      `No wall found at ${join(folder, WALL_FILE)}. Open Noella, scroll to the ` +
        `bottom, press "Connect a folder" and pick ${folder}. Until then there ` +
        `is nothing here to read.`,
    );
  }
  const data = JSON.parse(raw);
  return {
    notes: data.notes ?? [],
    colors: data.colors ?? [],
    settings: data.settings ?? {},
    writtenAt: data.writtenAt ?? null,
  };
}

/**
 * Queues one change as its own file.
 *
 * A file each rather than lines in a shared log, because the browser drains by
 * deleting what it has applied — and deleting whole entries can never race
 * with this process appending to one.
 */
async function queue(folder, op) {
  const dir = join(folder, INBOX_DIR);
  await mkdir(dir, { recursive: true });
  const entry = { ...op, queuedAt: new Date().toISOString(), id: randomUUID() };
  await writeFile(
    join(dir, `${Date.now()}-${entry.id}.json`),
    JSON.stringify(entry, null, 2),
    "utf8",
  );
  return entry;
}

async function queuedFiles(folder) {
  try {
    return (await readdir(join(folder, INBOX_DIR))).filter((f) =>
      f.endsWith(".json"),
    );
  } catch {
    return [];
  }
}

/** Every write says the same true thing about when it will show up. */
async function landing(folder, what) {
  const waiting = (await queuedFiles(folder)).length;
  return (
    `${what} It is queued for Noella and lands the next time a Noella tab is ` +
    `open — the browser is the only thing that can write to your wall. ` +
    `${waiting} change${waiting === 1 ? "" : "s"} waiting.`
  );
}

const text = (value) => ({
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

// ------------------------------------------------------------------ finding

const ref = (n) => `NOTE ${String(n.seq).padStart(4, "0")}`;

/**
 * Somewhere to put things, by name, id or ref.
 *
 * Any live note qualifies: anything can hold anything, so "Cave Sniper" is a
 * valid destination whether or not it was ever promoted to a project.
 * Ambiguity is reported, never guessed at.
 */
function findContainer(data, needle) {
  const containers = data.notes.filter((n) => n.archivedAt === null);
  const exact = containers.find((n) => n.id === needle || ref(n) === needle);
  if (exact) return exact;

  const low = needle.toLowerCase();
  let hits = containers.filter((n) => title(n).toLowerCase().includes(low));

  /*
   * Narrow before giving up.
   *
   * "Cave" matches both "Cave Sniper" and "…clips through the cave wall", and
   * refusing there is pedantic when only one of them is a thing you put things
   * into. An exact title wins outright; otherwise prefer whatever already
   * holds something, and only complain if that still leaves a choice.
   */
  if (hits.length > 1) {
    const exactTitle = hits.filter((n) => title(n).toLowerCase() === low);
    if (exactTitle.length === 1) return exactTitle[0];
    const holders = hits.filter(
      (n) =>
        isRoom(data, n) ||
        data.notes.some((c) => c.parentId === n.id && c.archivedAt === null),
    );
    if (holders.length === 1) return holders[0];
    if (holders.length > 1) hits = holders;
  }

  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    const folders = containers.filter(
      (n) => isRoom(data, n),
    );
    throw new Error(
      `Nothing called "${needle}". Things that hold other things: ` +
        (folders.map((n) => title(n)).join(", ") || "none yet"),
    );
  }
  throw new Error(
    `"${needle}" matches several: ` +
      hits
        .map((n) => {
          const where = whereIs(data, n);
          return where ? `${title(n)} (in ${where})` : title(n);
        })
        .join("; ") +
      ". Be more specific, or pass an id.",
  );
}

function findFolder(data, needle) {
  const low = needle.toLowerCase();
  const name = (c, index) => c.name ?? defaultFolderName(c.position ?? index);
  const i = data.colors.findIndex(
    (c, index) => c.id === needle || name(c, index).toLowerCase() === low,
  );
  if (i === -1) {
    throw new Error(
      `No folder called "${needle}". There is: ${data.colors.map(name).join(", ")}`,
    );
  }
  return data.colors[i].id;
}

function findNote(data, needle) {
  const hit = data.notes.find((n) => n.id === needle || ref(n) === needle);
  if (hit) return hit;
  const low = needle.toLowerCase();
  const hits = data.notes.filter(
    (n) => n.archivedAt === null && n.body.toLowerCase().includes(low),
  );
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Error(`Nothing matching "${needle}".`);
  throw new Error(
    `"${needle}" matches ${hits.length}: ` +
      hits
        .slice(0, 8)
        .map((n) => `${title(n)} (${n.id})`)
        .join("; ") +
      ". Pass an id.",
  );
}

/** The one filter every search shares, so `search` and `search_notes` agree. */
function matching(
  data,
  { query, colorId, kind, openOnly, archived, priority, mark },
) {
  const low = (query ?? "").toLowerCase();
  return data.notes
    .filter((n) => (archived ? true : n.archivedAt === null))
    .filter((n) => (colorId ? n.colorId === colorId : true))
    .filter((n) =>
      kind === "room"
        ? isRoom(data, n)
        : kind === "todo"
          ? n.isTask && !isRoom(data, n)
          : kind === "note"
            ? !n.isTask && !isRoom(data, n)
            : true,
    )
    .filter((n) => (openOnly ? n.isTask && n.doneAt === null : true))
    .filter((n) => (priority ? n.priority === priority : true))
    .filter((n) => (mark ? marksOf(n).includes(mark) : true))
    .filter(
      (n) =>
        !low ||
        n.body.toLowerCase().includes(low) ||
        (n.tags ?? []).some((t) =>
          t.toLowerCase().includes(low.replace("#", "")),
        ),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// -------------------------------------------------------------------- tools

export function registerTools(server, folder) {
  // ---------------------------------------------------------------- reading

  server.registerTool(
    "search_notes",
    {
      title: "Search the wall",
      description:
        "Find notes, to-dos, projects and lists by text, folder or kind. " +
        "With no arguments it returns the most recent things written.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Text to match in the body, or a #tag"),
        folder: z.string().optional().describe("A folder (colour) name"),
        kind: z.enum(["note", "todo", "room"]).optional(),
        open_only: z
          .boolean()
          .optional()
          .describe("Only unticked to-dos and steps"),
        include_archived: z.boolean().optional(),
        priority: z
          .enum(PRIORITIES)
          .optional()
          .describe("Only things ranked at this level: high, mid or low"),
        mark: z
          .enum(MARKS)
          .optional()
          .describe(
            "Only things wearing this mark. Marks are what a note is about — " +
              "bug, money, admin — and a note can wear several, so this is " +
              "the reliable way to answer 'everything about X'.",
          ),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({
      query,
      folder: name,
      kind,
      open_only,
      include_archived,
      priority,
      mark,
      limit,
    }) => {
      const data = await wall(folder);
      const hits = matching(data, {
        query,
        colorId: name ? findFolder(data, name) : null,
        kind,
        openOnly: open_only,
        archived: include_archived,
        priority,
        mark,
      }).slice(0, limit ?? 25);
      if (hits.length === 0) return text("Nothing on the wall matches that.");
      return text(hits.map((n) => view(data, n)));
    },
  );

  server.registerTool(
    "get_note",
    {
      title: "Read one thing",
      description:
        "The full note, with its steps or items if it is a project or a list. " +
        "Takes an id, a NOTE 0041 reference, or enough of the text to be unique.",
      inputSchema: { note: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ note }) => {
      const data = await wall(folder);
      return text(view(data, findNote(data, note)));
    },
  );

  server.registerTool(
    "whats_on_today",
    {
      title: "What was promised today",
      description:
        "The short list: everything ranked now, split into what was chosen " +
        "today, what has been carried over from an earlier day, and what has " +
        "already been ticked off. This is the one list in Noella with an end " +
        "to it — prefer it over whats_open when the question is what to do " +
        "next rather than what exists.",
      annotations: { readOnlyHint: true },
      inputSchema: {},
    },
    async () => {
      const data = await wall(folder);
      const key = dayKey(new Date());
      const live = data.notes.filter((n) => !n.archivedAt);
      const promised = live.filter((n) => n.todayOn);
      const open = promised.filter((n) => !n.doneAt && n.todayOn === key);
      const carried = promised
        .filter((n) => !n.doneAt && n.todayOn !== key)
        .sort((a, b) => (a.todayOn ?? "").localeCompare(b.todayOn ?? ""));
      const finished = live.filter(
        (n) => n.doneAt && n.doneAt.slice(0, 10) === key,
      );
      if (open.length + carried.length + finished.length === 0) {
        return text(
          "Nothing is on today yet. Use set_today to put something there.",
        );
      }
      return text({
        today: key,
        left: open.length + carried.length,
        chosen_today: open.map((n) => view(data, n)),
        carried_over: carried.map((n) => view(data, n)),
        finished_today: finished.map((n) => view(data, n)),
      });
    },
  );

  server.registerTool(
    "list_rooms",
    {
      title: "Everything holding something",
      description:
        "Every note with things inside it: what is in it, how far through it " +
        "is, and the first unfinished thing. There are no projects or lists " +
        "any more — a room is simply a note that contains notes.",
      inputSchema: {
        open_only: z
          .boolean()
          .optional()
          .describe("Only rooms with something still unticked in them"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ open_only }) => {
      const data = await wall(folder);
      const rooms = data.notes
        .filter((n) => isRoom(data, n) && n.archivedAt === null)
        .sort((a, b) => a.order - b.order || b.createdAt.localeCompare(a.createdAt))
        .map((room) => {
          const inside = childrenOf(data, room.id);
          const open = inside.filter((i) => i.doneAt === null);
          const tickable = inside.filter((i) => i.isTask);
          return {
            id: room.id,
            name: title(room),
            folder: folderName(data, room.colorId),
            holds: inside.length,
            progress: tickable.length
              ? `${tickable.filter((i) => i.doneAt !== null).length}/${tickable.length}`
              : null,
            repeats: room.repeats ?? room.listCadence ?? null,
            next: open[0] ? { id: open[0].id, body: open[0].body } : null,
          };
        })
        .filter((r) => (open_only ? r.next !== null : true));

      if (rooms.length === 0) {
        return text(
          "Nothing is holding anything yet. Put a note inside another note " +
            "with add_note's `inside`, and that note becomes a room.",
        );
      }
      return text(rooms);
    },
  );

  server.registerTool(
    "list_folders",
    {
      title: "Folders",
      description:
        "The colour folders, what they are named, and how much is filed in each.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = await wall(folder);
      const counts = new Map();
      for (const n of data.notes) {
        if (n.archivedAt === null && n.colorId) {
          counts.set(n.colorId, (counts.get(n.colorId) ?? 0) + 1);
        }
      }
      const rows = data.colors
        .map((c, i) => ({
          name: c.name ?? defaultFolderName(c.position ?? i),
          named_by_hand: c.name !== null && c.name !== undefined,
          holding: counts.get(c.id) ?? 0,
        }))
        .filter((r) => r.holding > 0 || r.named_by_hand);
      return text(
        rows.length > 0
          ? rows
          : "Nothing filed in a folder yet. All 36 are free.",
      );
    },
  );

  server.registerTool(
    "whats_open",
    {
      title: "What is still open",
      description:
        "Everything unticked, in the order Noella itself would work through " +
        "it: the ranked project first, then other active projects, then loose " +
        "to-dos, then anything on a repeating list not yet come round.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = await wall(folder);
      const live = data.notes.filter((n) => n.archivedAt === null);
      const key = dayKey(new Date());

      /*
       * Three lists, and none of them are about projects any more.
       *
       * This used to lead with "the next step of the top-ranked active
       * project", which meant it only ever knew about the handful of things
       * you had gone to the trouble of promoting. What is open is: what you
       * put on today, the first unfinished thing in each room, and anything
       * loose with a checkbox on it.
       */
      const out = { today: [], in_rooms: [], loose: [], repeating: [] };

      for (const n of live) {
        if (n.doneAt !== null || !n.todayOn) continue;
        out.today.push({ id: n.id, body: n.body, since: n.todayOn, stale: n.todayOn !== key });
      }

      const rooms = live
        .filter((n) => isRoom(data, n))
        .sort((a, b) => a.order - b.order);
      for (const room of rooms) {
        const repeats = room.repeats ?? room.listCadence ?? null;
        const inside = childrenOf(data, room.id).filter((c) => c.doneAt === null);
        if (inside.length === 0) continue;
        if (repeats) {
          for (const item of inside) {
            out.repeating.push({ id: item.id, body: item.body, room: title(room), repeats });
          }
          continue;
        }
        const next = inside[0];
        if (next.todayOn) continue; // already listed above
        out.in_rooms.push({
          id: next.id,
          body: next.body,
          room: title(room),
          left: inside.length,
        });
      }

      for (const n of live) {
        if (!n.isTask || n.doneAt !== null || n.todayOn) continue;
        if (n.parentId || isRoom(data, n)) continue;
        out.loose.push({ id: n.id, body: n.body, priority: RANK[n.priority] ?? null });
      }

      const total =
        out.today.length +
        out.in_rooms.length +
        out.loose.length +
        out.repeating.length;
      if (total === 0) return text("Nothing open. The wall is clear.");
      return text(out);
    },
  );

  // ---------------------------------------------------------------- writing

  server.registerTool(
    "add_note",
    {
      title: "Write something down",
      description:
        "Add a note, a to-do, a project or a list to the wall. Optionally " +
        "file it in a colour folder.",
      inputSchema: {
        body: z.string().min(1),
        kind: z.enum(["note", "todo", "room"]).optional(),
        folder: z.string().optional().describe("A folder (colour) name"),
        inside: z
          .string()
          .optional()
          .describe(
            "Put it inside this note, project or list — by name or id. " +
              "Nests to any depth, so a bug can go inside a game inside a site.",
          ),
        priority: z
          .enum(PRIORITIES)
          .optional()
          .describe(
            "How much it matters: high, mid or low. Not when — use " +
              "set_today for that. Most things are better left unranked.",
          ),
        marks: z
          .array(z.enum(MARKS))
          .max(4)
          .optional()
          .describe(
            "What it is about, up to four: bug, money, ship, admin. These " +
              "are the app's tags — they show on the card and filter the " +
              "wall — so mark anything you can rather than leaving it bare.",
          ),
      },
    },
    async ({ body, kind, folder: name, inside, priority, marks }) => {
      const data = await wall(folder);
      const colorId = name ? findFolder(data, name) : null;
      const parent = inside ? findContainer(data, inside) : null;
      await queue(folder, {
        op: "add_note",
        body,
        kind: kind ?? "note",
        colorId,
        parentId: parent?.id ?? null,
        priority: priority ?? null,
        icons: marksOf({ icons: marks ?? [] }),
      });
      return text(
        await landing(
          folder,
          `Queued a ${kind ?? "note"}: "${body.split("\n")[0]}"` +
            (parent ? ` inside ${title(parent)}.` : "."),
        ),
      );
    },
  );

  server.registerTool(
    "add_step",
    {
      title: "Add a step or item",
      description:
        "Put something inside something else — a step on a project, an item " +
        "on a list, a bug under a game. Same as add_note with `inside`, kept " +
        "because it reads better for checklists. Name the parent however you " +
        "refer to it.",
      inputSchema: {
        project: z.string().describe("The project or list to add to"),
        body: z.string().min(1),
      },
    },
    async ({ project, body }) => {
      const data = await wall(folder);
      const parent = findContainer(data, project);
      await queue(folder, { op: "add_step", parentId: parent.id, body });
      return text(
        await landing(folder, `Queued "${body}" onto ${title(parent)}.`),
      );
    },
  );

  server.registerTool(
    "complete",
    {
      title: "Tick something off",
      description: "Mark a to-do, step or list item as done.",
      inputSchema: { note: z.string(), undo: z.boolean().optional() },
    },
    async ({ note, undo }) => {
      const data = await wall(folder);
      const target = findNote(data, note);
      await queue(folder, {
        op: undo ? "reopen" : "complete",
        noteId: target.id,
      });
      return text(
        await landing(
          folder,
          `Queued ${undo ? "un-ticking" : "ticking"} "${title(target)}".`,
        ),
      );
    },
  );

    server.registerTool(
    "set_today",
    {
      title: "Put something on today, or take it off",
      description:
        "Today is the one list in Noella with an end to it: a short set of " +
        "things promised for one day, which is not the same question as how " +
        "much they matter. Dated, so what was chosen this morning reads " +
        "differently from what has been carried for a week.",
      inputSchema: {
        note: z.string(),
        on: z.boolean().optional().describe("Defaults to true. False takes it off."),
      },
    },
    async ({ note, on }) => {
      const data = await wall(folder);
      const target = findNote(data, note);
      const today = on === false ? false : true;
      await queue(folder, { op: "set_today", noteId: target.id, today });
      return text(
        await landing(
          folder,
          `Queued "${title(target)}" ${today ? "onto today" : "off today"}.`,
        ),
      );
    },
  );

  server.registerTool(
    "set_marks",
    {
      title: "Say what something is about",
      description:
        "Set the marks on a note — bug, money, ship, admin, up to four. " +
        "Marks are what the wall filters and groups by, so this is how a pile " +
        "of unsorted notes becomes sortable. Replaces whatever it wore; pass " +
        "an empty list to strip it back to nothing.",
      inputSchema: {
        note: z.string(),
        marks: z.array(z.enum(MARKS)).max(4),
      },
    },
    async ({ note, marks }) => {
      const data = await wall(folder);
      const target = findNote(data, note);
      const icons = marksOf({ icons: marks });
      await queue(folder, { op: "set_marks", noteId: target.id, icons });
      return text(
        await landing(
          folder,
          `Queued "${title(target)}" → ${icons.length > 0 ? icons.join(", ") : "no marks"}.`,
        ),
      );
    },
  );

  server.registerTool(
    "set_priority",
    {
      title: "Rank something",
      description:
        "How much something matters: high, mid or low, or none to unrank it. " +
        "Three buckets on purpose — a 1-10 field is an afternoon of deciding. " +
        "This is weight, not timing: what is being done today is set_today, " +
        "and the two are deliberately separate so the most important thing you " +
        "have does not have to be today's thing.",
      inputSchema: {
        note: z.string(),
        priority: z.enum([...PRIORITIES, "none"]),
      },
    },
    async ({ note, priority }) => {
      const data = await wall(folder);
      const target = findNote(data, note);
      await queue(folder, {
        op: "set_priority",
        noteId: target.id,
        priority: priority === "none" ? null : priority,
      });
      return text(
        await landing(
          folder,
          `Queued "${title(target)}" → ${priority === "none" ? "unranked" : priority}.`,
        ),
      );
    },
  );

  server.registerTool(
    "pending_changes",
    {
      title: "What is waiting",
      description:
        "The changes queued here that a Noella tab has not applied yet, and " +
        "when the wall was last written.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const files = await queuedFiles(folder);
      let writtenAt = null;
      try {
        writtenAt = (await wall(folder)).writtenAt;
      } catch {
        // No wall yet; the count is still worth reporting.
      }
      if (files.length === 0) {
        return text(
          `Nothing waiting. Wall last written ${writtenAt ?? "never"}.` +
            (writtenAt ? "" : " Connect a folder in Noella first."),
        );
      }
      const ops = [];
      for (const f of files) {
        try {
          ops.push(
            JSON.parse(await readFile(join(folder, INBOX_DIR, f), "utf8")),
          );
        } catch {
          // A half-written file will parse next time.
        }
      }
      return text({ wall_last_written: writtenAt, waiting: ops });
    },
  );

  // --------------------------------------------------- for ChatGPT's sake

  /*
   * `search` and `fetch` are the pair OpenAI's connectors look for, with a
   * fixed result shape: search gives {id, title, url} and fetch gives the text
   * behind an id. They are thin aliases over the same data as the tools above,
   * kept because a connector that cannot find them may refuse to load at all.
   *
   * The urls are real deep links — the wall gives every card `id="note-<id>"`,
   * so following one scrolls to the note. Set NOELLA_APP_URL if you host it
   * somewhere other than the default.
   */
  server.registerTool(
    "search",
    {
      title: "Search",
      description:
        "Search the Noella wall for notes, to-dos, projects and lists " +
        "matching a query. Returns ids to pass to fetch.",
      inputSchema: { query: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const data = await wall(folder);
      const results = matching(data, { query })
        .slice(0, 20)
        .map((n) => ({
          id: n.id,
          title: `${title(n)}${isRoom(data, n) ? " (room)" : ""}`,
          url: link(n.id),
        }));
      return text({ results });
    },
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch",
      description:
        "Retrieve one item from the Noella wall in full by the id that search " +
        "returned, including its steps or items.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const data = await wall(folder);
      const note = findNote(data, id);
      const detail = view(data, note);
      const lines = [note.body];
      // `contains` — renamed from the old steps/items pair when a plain note
      // became able to hold things. Reading the old names silently returned a
      // container with nothing in it.
      for (const child of detail.contains ?? []) {
        const box =
          child.done === undefined ? "-" : child.done ? "- [x]" : "- [ ]";
        lines.push(
          `${box} ${child.body}${child.holds ? ` (holds ${child.holds})` : ""}`,
        );
      }
      return text({
        id: note.id,
        title: title(note),
        text: lines.join("\n"),
        url: link(note.id),
        metadata: {
          kind: detail.kind,
          folder: detail.folder ?? "none",
          inside: detail.inside ?? "top level",
          created: note.createdAt,
        },
      });
    },
  );
}
