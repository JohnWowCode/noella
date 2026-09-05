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

/** Whatever is directly inside, in the order it is shown. */
export function childrenOf(wall, parentId) {
  return wall.notes
    .filter((n) => n.parentId === parentId && n.archivedAt === null)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

/**
 * The folders above a note, outermost first.
 *
 * Anything can hold anything, so "bugs" is not an address — "WowCool.World ›
 * Cave Sniper › bugs" is. Every result carries one.
 */
export function pathTo(wall, id) {
  const byId = new Map(wall.notes.map((n) => [n.id, n]));
  const chain = [];
  const seen = new Set();
  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) break;
    chain.unshift(parent);
    current = parent.parentId;
  }
  return chain;
}

export function whereIs(wall, note) {
  const chain = pathTo(wall, note.id);
  return chain.length > 0 ? chain.map(title).join(" › ") : null;
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
  out.kind = isProject(note)
    ? "project"
    : isList(note)
      ? "list"
      : note.isTask
        ? "todo"
        : "note";
  if (isProject(note)) out.status = note.projectStatus;
  if (isList(note) && note.listCadence) out.repeats = note.listCadence;

  const where = whereIs(wall, note);
  if (where) out.inside = where;

  /*
   * Contents, for anything that has any.
   *
   * This used to be attached only to projects and lists, from when they were
   * the only things allowed to contain. A plain note holding four bug reports
   * would have reported nothing at all.
   */
  const children = childrenOf(wall, note.id);
  if (children.length > 0) {
    out.contains = children.map((c) => {
      const row = { id: c.id, body: c.body };
      if (c.isTask) row.done = c.doneAt !== null;
      if (c.amount) row.amount = c.amount;
      const deeper = childrenOf(wall, c.id).length;
      if (deeper > 0) row.holds = deeper;
      return row;
    });
    const checkable = children.filter((c) => c.isTask);
    if (checkable.length > 0) {
      out.progress = `${checkable.filter((c) => c.doneAt !== null).length}/${checkable.length}`;
    }
  }
  if ((note.images ?? []).length > 0) {
    // The bytes stay in the browser; saying so beats a silent omission.
    out.attachments = `${note.images.length} not readable from here`;
  }
  return out;
}
