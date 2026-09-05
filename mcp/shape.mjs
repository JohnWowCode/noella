/**
 * The contract between Noella and this server.
 *
 * Noella lives in a browser tab; this server is a process on your machine.
 * Neither can reach into the other, so they share a folder you pick once.
 *
 *   <folder>/noella.json     the whole wall. Noella writes it, we only read.
 *   <folder>/inbox/*.json    one queued change each. We write, Noella drains.
 *
 * One writer per path, which is the entire reason there is no merge algorithm
 * here and nothing to get subtly wrong. The cost is that a change made here
 * lands when a Noella tab is next open — said plainly by every write tool
 * rather than hidden behind a hopeful "done".
 */

export const WALL_FILE = "noella.json";
export const INBOX_DIR = "inbox";

/** First line of a note's body, which is all a project or list needs for a name. */
export function title(note) {
  const line = (note.body ?? "").split("\n", 1)[0].trim();
  return line || `Note ${note.seq}`;
}

export function isProject(note) {
  return note.projectStatus !== null && note.projectStatus !== undefined;
}

export function isList(note) {
  return note.isList === true;
}

/** Steps or items belonging to a project or list, in the order they are shown. */
export function childrenOf(wall, parentId) {
  return wall.notes
    .filter((n) => n.parentId === parentId && n.archivedAt === null)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function folderName(wall, colorId) {
  if (!colorId) return null;
  const i = wall.colors.findIndex((c) => c.id === colorId);
  if (i === -1) return null;
  // `position` rather than the array index: the index is only the same thing
  // while the array is whole and in order, and a wall that has been through an
  // import need not be either.
  return wall.colors[i].name ?? defaultFolderName(wall.colors[i].position ?? i);
}

/**
 * Mirrors swatchName() in the app: twelve hues, then the same twelve light,
 * then the same twelve deep.
 */
const HUES = ["yellow", "lime", "teal", "blue", "violet", "pink",
  "red", "orange", "amber", "orchid", "cyan", "green"];

export function defaultFolderName(index) {
  const hue = HUES[index % HUES.length];
  const band = ["", "light ", "deep "][Math.floor(index / HUES.length)] ?? "";
  return hue ? `${band}${hue}` : `world ${index + 1}`;
}

/** What a note looks like to Claude. Ids kept, because tools take them back. */
export function view(wall, note) {
  const out = {
    id: note.id,
    ref: `NOTE ${String(note.seq).padStart(4, "0")}`,
    body: note.body,
    folder: folderName(wall, note.colorId),
    tags: note.tags ?? [],
    created: note.createdAt,
  };
  if (note.pinned) out.favourite = true;
  if (note.isTask) out.done = note.doneAt !== null;
  if (note.archivedAt) out.archived = true;
  if (isProject(note)) {
    out.kind = "project";
    out.status = note.projectStatus;
    const steps = childrenOf(wall, note.id);
    out.steps = steps.map((s) => ({
      id: s.id,
      body: s.body,
      done: s.doneAt !== null,
    }));
    out.progress = `${steps.filter((s) => s.doneAt !== null).length}/${steps.length}`;
  } else if (isList(note)) {
    out.kind = "list";
    if (note.listCadence) out.repeats = note.listCadence;
    out.items = childrenOf(wall, note.id).map((s) => ({
      id: s.id,
      body: s.body,
      done: s.doneAt !== null,
      amount: s.amount ?? undefined,
    }));
  } else {
    out.kind = note.isTask ? "todo" : "note";
  }
  if ((note.images ?? []).length > 0) {
    // The bytes stay in the browser; saying so beats a silent omission.
    out.attachments = `${note.images.length} not readable from here`;
  }
  return out;
}
