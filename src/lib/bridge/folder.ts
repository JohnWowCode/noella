/**
 * The browser half of the bridge to the Noella MCP server.
 *
 * Noella keeps everything in this tab. An MCP server is a process on your
 * machine, and the two cannot reach into each other — so they share a folder
 * you pick once, and the File System Access API is the only way a web page is
 * allowed to hold onto one.
 *
 *   <folder>/noella.json   the whole wall. We write it; the server only reads.
 *   <folder>/inbox/*.json  one queued change each. The server writes; we drain.
 *
 * One writer per path. That is the whole reason there is no merge algorithm
 * here — nothing has to decide which side of a conflict wins, because there is
 * never a conflict to decide.
 *
 * Chromium only (Chrome, Edge, Arc, Brave). Firefox and Safari have no
 * equivalent, and there is no polyfill worth the name; `supported()` is how
 * every caller finds that out before offering the option.
 */

import type { Color, Note, Settings } from "../types";

export const WALL_FILE = "noella.json";
export const INBOX_DIR = "inbox";

const DB_NAME = "noella-bridge";
const STORE = "handles";
const KEY = "folder";

/**
 * The parts of the File System Access API this uses that TypeScript's DOM
 * library still does not describe. Declared narrowly rather than pulling in a
 * types package for four members.
 */
type PermissionState = "granted" | "denied" | "prompt";
interface Permissioned {
  queryPermission(d: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(d: { mode: "readwrite" }): Promise<PermissionState>;
}
type Folder = FileSystemDirectoryHandle &
  Permissioned & {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  };

export function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window &&
    typeof indexedDB !== "undefined"
  );
}

// ------------------------------------------------------------ the handle ---

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return db().then(
    (open) =>
      new Promise<T>((resolve, reject) => {
        const t = open.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => open.close();
      }),
  );
}

/**
 * A directory handle survives a reload — it is structured-cloneable, so it
 * goes in IndexedDB — but the *permission* on it does not. After a restart it
 * comes back needing a click to re-grant, which is a browser rule and not
 * something the page can route around.
 */
export async function remembered(): Promise<Folder | null> {
  if (!supported()) return null;
  try {
    return (await tx<Folder | undefined>("readonly", (s) => s.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function forget(): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nothing to clean up.
  }
}

/** Opens the picker. Must be called straight from a click. */
export async function choose(): Promise<Folder | null> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (o: { mode: "readwrite" }) => Promise<Folder>;
    }
  ).showDirectoryPicker;
  if (!picker) return null;

  let handle: Folder;
  try {
    handle = await picker({ mode: "readwrite" });
  } catch {
    // The picker was dismissed. Not an error, just an answer.
    return null;
  }

  // Remembering it is a convenience, and a failure here — storage full, a
  // handle the browser will not clone — must not cost you the folder you just
  // picked. It works for this session; it just will not survive a reload.
  try {
    await tx("readwrite", (s) => s.put(handle, KEY));
  } catch {
    // Nothing to do but carry on with the handle in hand.
  }
  return handle;
}

export async function access(handle: Folder): Promise<PermissionState> {
  try {
    return await handle.queryPermission({ mode: "readwrite" });
  } catch {
    return "denied";
  }
}

/** Must be called straight from a click, same as the picker. */
export async function regrant(handle: Folder): Promise<PermissionState> {
  try {
    return await handle.requestPermission({ mode: "readwrite" });
  } catch {
    return "denied";
  }
}

// -------------------------------------------------------------- the wall ---

export interface Wall {
  notes: Note[];
  colors: Color[];
  settings: Settings;
}

/**
 * Images and video are deliberately absent.
 *
 * The bytes live in IndexedDB and a backup inlines them as data URLs, which
 * would make this file tens of megabytes and rewrite all of it on every
 * keystroke. The server has no use for them either — it reports how many a
 * note has and says it cannot read them, which is honest and cheap.
 */
export function serialise(wall: Wall): string {
  return JSON.stringify(
    {
      format: "noella.wall",
      version: 1,
      writtenAt: new Date().toISOString(),
      notes: wall.notes,
      colors: wall.colors,
      settings: wall.settings,
    },
    null,
    2,
  );
}

export async function writeWall(handle: Folder, body: string): Promise<void> {
  const file = await handle.getFileHandle(WALL_FILE, { create: true });
  const out = await file.createWritable();
  await out.write(body);
  await out.close();
}

// ------------------------------------------------------------- the inbox ---

export interface Op {
  id: string;
  op: string;
  body?: string;
  kind?: "note" | "todo" | "project" | "list";
  colorId?: string | null;
  parentId?: string;
  noteId?: string;
  status?: string;
  /** Legacy: one sticker. Still accepted so an older server keeps working. */
  icon?: string | null;
  icons?: string[];
  priority?: "now" | "next" | "later" | null;
}

export interface Envelope {
  /** The file it came from, so it can be deleted once it has been applied. */
  file: string;
  op: Op;
}

export async function readInbox(handle: Folder): Promise<Envelope[]> {
  let dir: Folder;
  try {
    dir = (await handle.getDirectoryHandle(INBOX_DIR)) as Folder;
  } catch {
    // No inbox means the server has never queued anything. Not a problem.
    return [];
  }

  const out: Envelope[] = [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind !== "file" || !name.endsWith(".json")) continue;
    try {
      const file = await (entry as FileSystemFileHandle).getFile();
      out.push({ file: name, op: JSON.parse(await file.text()) as Op });
    } catch {
      // Half-written, or not ours. It will parse on a later pass, or never —
      // either way one bad file must not stall the rest of the queue.
    }
  }
  // Oldest first: the filenames start with the queueing timestamp, so applying
  // them in name order applies them in the order they were asked for.
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

export async function drop(handle: Folder, file: string): Promise<void> {
  try {
    const dir = await handle.getDirectoryHandle(INBOX_DIR);
    await dir.removeEntry(file);
  } catch {
    // Already gone. Applying twice is the only thing worth avoiding, and the
    // caller has already applied it.
  }
}

export type { Folder };
