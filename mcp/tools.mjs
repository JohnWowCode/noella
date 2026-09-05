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
  WALL_FILE,
  childrenOf,
  defaultFolderName,
  folderName,
  isList,
  isProject,
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
        isProject(n) ||
        isList(n) ||
        data.notes.some((c) => c.parentId === n.id && c.archivedAt === null),
    );
    if (holders.length === 1) return holders[0];
    if (holders.length > 1) hits = holders;
  }

  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    const folders = containers.filter(
      (n) => isProject(n) || isList(n) || data.notes.some((c) => c.parentId === n.id),
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
function matching(data, { query, colorId, kind, openOnly, archived, priority }) {
  const low = (query ?? "").toLowerCase();
  return data.notes
    .filter((n) => (archived ? true : n.archivedAt === null))
    .filter((n) => (colorId ? n.colorId === colorId : true))
    .filter((n) =>
      kind === "project"
        ? isProject(n)
        : kind === "list"
          ? isList(n)
          : kind === "todo"
            ? n.isTask && !isProject(n) && !isList(n)
            : kind === "note"
              ? !n.isTask && !isProject(n) && !isList(n)
              : true,
    )
    .filter((n) => (openOnly ? n.isTask && n.doneAt === null : true))
    .filter((n) => (priority ? n.priority === priority : true))
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
        kind: z.enum(["note", "todo", "project", "list"]).optional(),
        open_only: z
          .boolean()
          .optional()
          .describe("Only unticked to-dos and steps"),
        include_archived: z.boolean().optional(),
        priority: z
          .enum(["now", "next", "later"])
          .optional()
          .describe("Only things ranked at this level"),
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
    "list_projects",
    {
      title: "Projects and lists",
      description:
        "Every project with its status, progress and next unticked step, and " +
        "every list with what is still open on it.",
      inputSchema: {
        status: z.enum(["idea", "active", "paused", "done"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status }) => {
      const data = await wall(folder);
      const rank = { active: 0, idea: 1, paused: 2, done: 3 };
      const projects = data.notes
        .filter((n) => isProject(n) && n.archivedAt === null)
        .filter((n) => (status ? n.projectStatus === status : true))
        .sort(
          (a, b) =>
            rank[a.projectStatus] - rank[b.projectStatus] || a.order - b.order,
        )
        .map((p) => {
          const steps = childrenOf(data, p.id);
          const next = steps.find((s) => s.doneAt === null);
          return {
            id: p.id,
            name: title(p),
            status: p.projectStatus,
            folder: folderName(data, p.colorId),
            progress: `${steps.filter((s) => s.doneAt !== null).length}/${steps.length}`,
            next_step: next ? { id: next.id, body: next.body } : null,
          };
        });

      const lists = data.notes
        .filter((n) => isList(n) && n.archivedAt === null)
        .map((l) => {
          const items = childrenOf(data, l.id);
          return {
            id: l.id,
            name: title(l),
            repeats: l.listCadence ?? null,
            folder: folderName(data, l.colorId),
            open: items.filter((i) => i.doneAt === null).map((i) => i.body),
            done: items.filter((i) => i.doneAt !== null).length,
          };
        });

      if (projects.length === 0 && lists.length === 0) {
        return text("No projects or lists yet.");
      }
      return text({ projects, lists });
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
      const active = live
        .filter((n) => n.projectStatus === "active")
        .sort((a, b) => a.order - b.order);

      const out = { today: [], also_active: [], loose: [], repeating: [] };

      active.forEach((p, rank) => {
        const next = childrenOf(data, p.id).find((s) => s.doneAt === null);
        if (!next) return;
        const row = { id: next.id, body: next.body, project: title(p) };
        if (rank === 0) out.today.push(row);
        else out.also_active.push(row);
      });

      for (const n of live) {
        if (!n.isTask || n.doneAt !== null) continue;
        if (n.parentId || isProject(n) || isList(n)) continue;
        out.loose.push({ id: n.id, body: n.body });
      }

      for (const l of live.filter((n) => isList(n) && n.listCadence)) {
        for (const item of childrenOf(data, l.id)) {
          if (item.doneAt === null) {
            out.repeating.push({ id: item.id, body: item.body, list: title(l) });
          }
        }
      }

      const total =
        out.today.length +
        out.also_active.length +
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
        kind: z.enum(["note", "todo", "project", "list"]).optional(),
        folder: z.string().optional().describe("A folder (colour) name"),
        inside: z
          .string()
          .optional()
          .describe(
            "Put it inside this note, project or list — by name or id. " +
              "Nests to any depth, so a bug can go inside a game inside a site.",
          ),
        priority: z
          .enum(["now", "next", "later"])
          .optional()
          .describe("Rank it. Most things are better left unranked."),
        sticker: z
          .string()
          .optional()
          .describe("A single emoji, shown large on the card"),
      },
    },
    async ({ body, kind, folder: name, inside, priority, sticker }) => {
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
        icon: sticker && [...sticker].length <= 3 ? sticker : null,
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
    "set_project_status",
    {
      title: "Move a project along",
      description:
        "Set a project to idea, active, paused or done. Active projects are " +
        "what Noella works from; three at a time is the usual limit.",
      inputSchema: {
        project: z.string(),
        status: z.enum(["idea", "active", "paused", "done"]),
      },
    },
    async ({ project, status }) => {
      const data = await wall(folder);
      const target = findContainer(data, project);
      await queue(folder, { op: "set_status", noteId: target.id, status });
      return text(await landing(folder, `Queued ${title(target)} → ${status}.`));
    },
  );

  server.registerTool(
    "set_priority",
    {
      title: "Rank something",
      description:
        "Put a note at now, next or later — or pass none to unrank it. " +
        "Three buckets on purpose: a 1-10 field is an afternoon of deciding.",
      inputSchema: {
        note: z.string(),
        priority: z.enum(["now", "next", "later", "none"]),
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
          title: `${title(n)}${isProject(n) ? " (project)" : isList(n) ? " (list)" : ""}`,
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
