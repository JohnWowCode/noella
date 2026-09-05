#!/usr/bin/env node
/**
 * Noella, as tools Claude can use.
 *
 * Reads the wall your browser wrote, and queues changes for it to pick up.
 * See shape.mjs for why it works through a folder rather than talking to the
 * app directly.
 *
 *   node server.mjs /path/to/folder
 *   NOELLA_FOLDER=/path/to/folder node server.mjs
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
} from "./shape.mjs";

const FOLDER = resolve(
  process.argv[2] ?? process.env.NOELLA_FOLDER ?? join(homedir(), "Noella"),
);

/** Everything the tools answer from. Re-read per call: the tab writes it. */
async function wall() {
  let raw;
  try {
    raw = await readFile(join(FOLDER, WALL_FILE), "utf8");
  } catch {
    throw new Error(
      `No wall found at ${join(FOLDER, WALL_FILE)}. Open Noella, and under ` +
        `Export/Import choose "Connect a folder" and pick ${FOLDER}. ` +
        `Until then there is nothing here to read.`,
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
 * deleting what it has applied — and deleting whole entries can never race with
 * this process appending to one.
 */
async function queue(op) {
  const dir = join(FOLDER, INBOX_DIR);
  await mkdir(dir, { recursive: true });
  const entry = { ...op, queuedAt: new Date().toISOString(), id: randomUUID() };
  await writeFile(
    join(dir, `${Date.now()}-${entry.id}.json`),
    JSON.stringify(entry, null, 2),
    "utf8",
  );
  return entry;
}

async function queued() {
  try {
    return (await readdir(join(FOLDER, INBOX_DIR))).filter((f) =>
      f.endsWith(".json"),
    );
  } catch {
    return [];
  }
}

/** Every write says the same true thing about when it will show up. */
async function landing(what) {
  const waiting = (await queued()).length;
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

/** Finds a project or list by name, id, or ref. Ambiguity is reported, not guessed. */
function findContainer(data, needle) {
  const containers = data.notes.filter(
    (n) => (isProject(n) || isList(n)) && n.archivedAt === null,
  );
  const exact = containers.find(
    (n) => n.id === needle || `NOTE ${String(n.seq).padStart(4, "0")}` === needle,
  );
  if (exact) return exact;

  const low = needle.toLowerCase();
  const hits = containers.filter((n) => title(n).toLowerCase().includes(low));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    throw new Error(
      `No project or list matching "${needle}". There is: ` +
        (containers.map((n) => title(n)).join(", ") || "nothing yet"),
    );
  }
  throw new Error(
    `"${needle}" matches several: ${hits.map((n) => title(n)).join(", ")}. Be more specific.`,
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
  const hit = data.notes.find(
    (n) =>
      n.id === needle || `NOTE ${String(n.seq).padStart(4, "0")}` === needle,
  );
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

const server = new McpServer({ name: "noella", version: "1.0.0" });

// ------------------------------------------------------------------ reading

server.registerTool(
  "search_notes",
  {
    title: "Search the wall",
    description:
      "Find notes, to-dos, projects and lists by text, folder or kind. " +
      "With no arguments it returns the most recent things written.",
    inputSchema: {
      query: z.string().optional().describe("Text to match in the body or a #tag"),
      folder: z.string().optional().describe("A folder (colour) name"),
      kind: z.enum(["note", "todo", "project", "list"]).optional(),
      open_only: z
        .boolean()
        .optional()
        .describe("Only unticked to-dos and steps"),
      include_archived: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query, folder, kind, open_only, include_archived, limit }) => {
    const data = await wall();
    const colorId = folder ? findFolder(data, folder) : null;
    const low = (query ?? "").toLowerCase();

    const hits = data.notes
      .filter((n) => (include_archived ? true : n.archivedAt === null))
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
      .filter((n) => (open_only ? n.isTask && n.doneAt === null : true))
      .filter(
        (n) =>
          !low ||
          n.body.toLowerCase().includes(low) ||
          (n.tags ?? []).some((t) => t.toLowerCase().includes(low.replace("#", ""))),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit ?? 25);

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
    const data = await wall();
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
    const data = await wall();
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
    const data = await wall();
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
      rows.length > 0 ? rows : "Nothing filed in a folder yet. All 36 are free.",
    );
  },
);

server.registerTool(
  "whats_open",
  {
    title: "What is still open",
    description:
      "Everything unticked, in the order Noella itself would work through it: " +
      "the ranked project first, then other active projects, then loose " +
      "to-dos, then anything on a repeating list that has not come round yet.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const data = await wall();
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

// ------------------------------------------------------------------ writing

server.registerTool(
  "add_note",
  {
    title: "Write something down",
    description:
      "Add a note, a to-do, a project or a list to the wall. Optionally file " +
      "it in a colour folder.",
    inputSchema: {
      body: z.string().min(1),
      kind: z.enum(["note", "todo", "project", "list"]).optional(),
      folder: z.string().optional().describe("A folder (colour) name"),
    },
  },
  async ({ body, kind, folder }) => {
    const data = await wall();
    const colorId = folder ? findFolder(data, folder) : null;
    await queue({ op: "add_note", body, kind: kind ?? "note", colorId });
    return text(
      await landing(`Queued a ${kind ?? "note"}: "${body.split("\n")[0]}".`),
    );
  },
);

server.registerTool(
  "add_step",
  {
    title: "Add a step or item",
    description:
      "Put a step on a project or an item on a list. Name it however you " +
      "refer to it — the match is on the title.",
    inputSchema: {
      project: z.string().describe("The project or list to add to"),
      body: z.string().min(1),
    },
  },
  async ({ project, body }) => {
    const data = await wall();
    const parent = findContainer(data, project);
    await queue({ op: "add_step", parentId: parent.id, body });
    return text(await landing(`Queued "${body}" onto ${title(parent)}.`));
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
    const data = await wall();
    const target = findNote(data, note);
    await queue({ op: undo ? "reopen" : "complete", noteId: target.id });
    return text(
      await landing(
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
    const data = await wall();
    const target = findContainer(data, project);
    await queue({ op: "set_status", noteId: target.id, status });
    return text(await landing(`Queued ${title(target)} → ${status}.`));
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
    const files = await queued();
    let writtenAt = null;
    try {
      writtenAt = (await wall()).writtenAt;
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
        ops.push(JSON.parse(await readFile(join(FOLDER, INBOX_DIR, f), "utf8")));
      } catch {
        // A half-written file will parse next time.
      }
    }
    return text({ wall_last_written: writtenAt, waiting: ops });
  },
);

await server.connect(new StdioServerTransport());
