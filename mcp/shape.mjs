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
/**
 * Every mark a note may wear, in the order the app shows them. Kept in step
 * with src/lib/stickers.ts by hand — two runtimes, one vocabulary.
 */
export const MARKS = [
  "idea", "write", "art", "sound", "build", "game",
  "bug", "fix", "test", "ship", "blocked", "danger",
  "money", "buy", "admin", "home", "health", "travel",
  "read", "watch", "people", "place", "love", "ask",
];

/**
 * Everything that is not already a mark, mapped to the one it means.
 *
 * Two jobs in one table. The emoji and the abstract shapes are the two older
 * sticker vocabularies, so a wall written months ago still answers "everything
 * about bugs" correctly; the words are what a model actually says when asked
 * to mark something, because "bills" and "issue" are the natural phrasings and
 * failing them would be a tool that only works if you already know its enum.
 */
const MARK_ALIAS = {
  // The emoji era. Kept in step with LEGACY in src/lib/stickers.ts.
  "🎮": "game", "🕹️": "game", "🕹": "game", "🧩": "game",
  "🎬": "watch", "📷": "art", "🎨": "art", "🎵": "sound",
  "✏️": "write", "✏": "write", "🛠️": "fix", "🛠": "fix", "⚙️": "fix", "⚙": "fix",
  "🐛": "bug", "🔥": "danger", "💥": "danger", "🧨": "danger",
  "⚠️": "danger", "⚠": "danger", "🚧": "blocked", "🩹": "fix", "❓": "ask",
  "💸": "money", "🏠": "home", "📦": "buy", "🎁": "buy",
  "🍜": "health", "🩺": "health", "🚗": "travel", "✈️": "travel", "✈": "travel",
  "⭐": "love", "💡": "idea", "🚀": "ship", "🌱": "idea",
  "🧠": "idea", "❤️": "love", "❤": "love", "☕": "health",
  "🌙": "home", "🎯": "test", "🏁": "ship", "📖": "read", "📚": "read",

  // The one-abstract-shape era, which lasted two commits.
  cube: "build", frame: "art", film: "watch", wave: "sound",
  pen: "write", sliders: "fix", bolt: "bug", burst: "danger",
  warn: "danger", cross: "blocked", eye: "watch", shield: "health",
  coin: "money", house: "home", box: "buy", heart: "love",
  clock: "travel", key: "admin", target: "test", spark: "idea",
  seed: "idea", moon: "home", ring: "idea", star: "love", flag: "ship",

  // What a model says when it means one of these.
  bugs: "bug", issue: "bug", defect: "bug",
  idea: "idea", ideas: "idea", thought: "idea",
  writing: "write", note: "write", draft: "write",
  audio: "sound", music: "sound", design: "art", image: "art",
  games: "game", gamedev: "game",
  fixing: "fix", repair: "fix", testing: "test", qa: "test",
  release: "ship", shipping: "ship", launch: "ship",
  stuck: "blocked", waiting: "blocked", risk: "danger", urgent: "danger",
  bill: "money", bills: "money", finance: "money", cost: "money",
  shopping: "buy", purchase: "buy", errand: "admin", paperwork: "admin",
  house: "home", health: "health", trip: "travel", holiday: "travel",
  reading: "read", book: "read", watching: "watch", film: "watch", video: "watch",
  person: "people", someone: "people", friends: "people",
  location: "place", where: "place",
  favourite: "love", favorite: "love", question: "ask",
};

const HUES = ["yellow", "lime", "teal", "blue", "violet", "pink",
  "red", "orange", "amber", "orchid", "cyan", "green"];

/**
 * The marks a note wears.
 *
 * A mark means something now — bug, money, admin — so it is a tag with no
 * spelling to get wrong, and the tools filter on it like they filter on a
 * folder. Old walls stored one decorative sticker in `icon`; that is read
 * across here so a wall written by an older tab still answers correctly.
 */
export function marksOf(note) {
  const raw =
    Array.isArray(note.icons) && note.icons.length > 0
      ? note.icons
      : note.icon
        ? [note.icon]
        : [];
  const out = [];
  for (const value of raw) {
    const mark = MARK_ALIAS[value] ?? (MARKS.includes(value) ? value : null);
    if (mark && !out.includes(mark)) out.push(mark);
  }
  return out;
}

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
  const marks = marksOf(note);
  if (marks.length > 0) out.marks = marks;
  if (note.priority) out.priority = note.priority;
  /*
   * When it was put on today. "now" means today — it has always said so on
   * the picker — so a now with an old date is something that has been carried
   * rather than something chosen this morning, and saying which is the
   * difference between a useful answer and a list that quietly stopped being
   * true months ago.
   */
  if (note.priority === "now" && note.rankedOn) out.promised = note.rankedOn;
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
