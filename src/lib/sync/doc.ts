/**
 * What actually goes in the file, and how two of them become one.
 *
 * Two devices editing the same wall is not a rare case, it is the entire
 * point, so this cannot be "whoever saved last wins" over the whole file —
 * that quietly eats an afternoon's work on the other machine. Every note
 * already carries `updatedAt`, so the merge is per note and the loser of any
 * one collision is a single note, not a wall.
 */

import type { Color, Note, Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import type { Snapshot } from "../store/types";

export interface Grave {
  id: string;
  /** ISO. A delete only beats an edit older than itself. */
  at: string;
}

export interface SyncDoc {
  format: "noella.sync";
  version: 1;
  writtenAt: string;
  notes: Note[];
  colors: Color[];
  settings: Settings;
  /**
   * What has been deleted, and when.
   *
   * Without these a note deleted on the phone is simply missing from the
   * phone's copy, and the desktop's copy — which still has it — puts it
   * straight back. Deleting anything would be impossible to make stick.
   */
  graves: Grave[];
}

/** Old graves are noise. Long enough that no device is behind by more. */
const GRAVE_DAYS = 120;

export function emptyDoc(): SyncDoc {
  return {
    format: "noella.sync",
    version: 1,
    writtenAt: new Date(0).toISOString(),
    notes: [],
    colors: [],
    settings: DEFAULT_SETTINGS,
    graves: [],
  };
}

export function parseDoc(text: string): SyncDoc | null {
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== "object" || raw === null) return null;
    const doc = raw as Partial<SyncDoc>;
    if (!Array.isArray(doc.notes) || !Array.isArray(doc.colors)) return null;
    return {
      format: "noella.sync",
      version: 1,
      writtenAt: doc.writtenAt ?? new Date(0).toISOString(),
      notes: doc.notes,
      colors: doc.colors,
      settings: { ...DEFAULT_SETTINGS, ...(doc.settings ?? {}) },
      graves: Array.isArray(doc.graves) ? doc.graves : [],
    };
  } catch {
    return null;
  }
}

const stamp = (n: Note) => n.updatedAt || n.createdAt || "";

/**
 * One wall out of two.
 *
 * Notes: the later `updatedAt` wins, which is the only comparison available
 * and the only one that matches what a person means by "I changed that".
 * Deletes: a grave removes a note unless the note has been edited since the
 * grave was dug, because editing something is the clearest possible statement
 * that you did not mean to delete it.
 */
export function mergeDocs(
  mine: SyncDoc,
  theirs: SyncDoc,
): { doc: SyncDoc; changed: number } {
  const graves = new Map<string, Grave>();
  for (const g of [...mine.graves, ...theirs.graves]) {
    const seen = graves.get(g.id);
    if (!seen || g.at > seen.at) graves.set(g.id, g);
  }

  const notes = new Map<string, Note>();
  for (const n of mine.notes) notes.set(n.id, n);
  let changed = 0;
  for (const n of theirs.notes) {
    const held = notes.get(n.id);
    if (!held) {
      notes.set(n.id, n);
      changed += 1;
    } else if (stamp(n) > stamp(held)) {
      notes.set(n.id, n);
      changed += 1;
    }
  }

  for (const [id, grave] of graves) {
    const note = notes.get(id);
    if (note && stamp(note) <= grave.at) {
      notes.delete(id);
      changed += 1;
    }
  }

  /*
   * Colours are folders now, so their names and stickers are real work and
   * must not be lost — but a colour carries no timestamp. An untouched one
   * (no name, no sticker) always yields to a touched one; between two touched
   * ones the local copy stands, because that is the device you are looking at.
   */
  const touched = (c: Color) => c.name !== null || c.emoji !== null;
  const colors = new Map<string, Color>();
  for (const c of theirs.colors) colors.set(c.id, c);
  for (const c of mine.colors) {
    const held = colors.get(c.id);
    if (!held || touched(c) || !touched(held)) colors.set(c.id, c);
  }

  const cutoff = new Date(Date.now() - GRAVE_DAYS * 86_400_000).toISOString();
  return {
    doc: {
      format: "noella.sync",
      version: 1,
      writtenAt: new Date().toISOString(),
      notes: [...notes.values()],
      colors: [...colors.values()].sort((a, b) => a.position - b.position),
      settings:
        theirs.writtenAt > mine.writtenAt ? theirs.settings : mine.settings,
      graves: [...graves.values()].filter((g) => g.at > cutoff),
    },
    changed,
  };
}

export function docFrom(snapshot: Snapshot, graves: Grave[]): SyncDoc {
  return {
    format: "noella.sync",
    version: 1,
    writtenAt: new Date().toISOString(),
    notes: snapshot.notes,
    colors: snapshot.colors,
    settings: snapshot.settings,
    graves,
  };
}

/** Same notes, same colours, same settings — nothing worth a commit. */
export function sameAs(a: SyncDoc, b: SyncDoc): boolean {
  const strip = (d: SyncDoc) =>
    JSON.stringify({
      notes: [...d.notes].sort((x, y) => x.id.localeCompare(y.id)),
      colors: [...d.colors].sort((x, y) => x.id.localeCompare(y.id)),
      settings: d.settings,
      graves: [...d.graves].sort((x, y) => x.id.localeCompare(y.id)),
    });
  return strip(a) === strip(b);
}
