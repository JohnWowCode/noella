import { deleteBlob, getBlob, putBlob } from "../images";
import { detectTask, parseTags } from "../notes";
import { DEFAULT_SETTINGS, type Color, type NewNote, type Note, type Settings } from "../types";
import { descendantsOf } from "../tree";
import { DEFAULT_SWATCHES } from "./defaults";
import type { Backup, Snapshot, Store } from "./types";

const KEY = "noella.v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Math.floor(Math.random() * 1e12).toString(36)}`;
}

function colorAt(hex: string, position: number): Color {
  return { id: uid(), hex, name: null, emoji: null, position };
}

function seedColors(): Color[] {
  return DEFAULT_SWATCHES.map(colorAt);
}

/**
 * Older walls were stored before images, before projects, and before the
 * palette grew past eight. The gaps are filled on read so no wall has to be
 * thrown away to get the new features — existing colours keep their ids,
 * names and positions, and existing notes simply are not projects yet.
 */
function migrate(snapshot: Snapshot): Snapshot {
  const notes = snapshot.notes.map((n) => ({
    ...n,
    images: Array.isArray(n.images) ? n.images : [],
    projectStatus: n.projectStatus ?? null,
    parentId: n.parentId ?? null,
    listCadence: n.listCadence ?? null,
    amount: typeof n.amount === "number" ? n.amount : null,
    order: typeof n.order === "number" ? n.order : 0,
    estimateMinutes: n.estimateMinutes ?? null,
    actualMinutes: n.actualMinutes ?? null,
    snoozedUntil: n.snoozedUntil ?? null,
    isList: n.isList ?? false,
    icon: n.icon ?? null,
    priority: n.priority ?? null,
  }));

  const colors = [...snapshot.colors];
  const present = new Set(colors.map((c) => c.hex.toUpperCase()));
  for (const hex of DEFAULT_SWATCHES) {
    if (!present.has(hex.toUpperCase())) {
      colors.push(colorAt(hex, colors.length));
    }
  }

  return {
    notes,
    colors,
    settings: { ...DEFAULT_SETTINGS, ...(snapshot.settings ?? {}) },
  };
}

function read(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (!Array.isArray(parsed.notes) || !Array.isArray(parsed.colors)) {
      return null;
    }
    return {
      notes: parsed.notes,
      colors: parsed.colors,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return null;
  }
}

/**
 * Persisting is a full re-serialise of every note, which at a couple of
 * thousand notes is milliseconds you can feel when it happens on every ticked
 * box. Writes are coalesced into the next frame or two, and always flushed
 * before the page can be hidden or closed, so nothing is ever owed to disk
 * across a tab switch.
 */
let pending: Snapshot | null = null;
let timer: number | null = null;

function flush(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  const snapshot = pending;
  pending = null;
  if (!snapshot) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private mode. The in-memory state is still correct.
  }
}

if (typeof window !== "undefined") {
  // pagehide covers the mobile case that beforeunload does not.
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

function write(snapshot: Snapshot): void {
  pending = snapshot;
  if (timer !== null) return;
  timer = window.setTimeout(flush, 120);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

/** Browser-local store: notes in localStorage, image bytes in IndexedDB. */
export class LocalStore implements Store {
  readonly label = "LOCAL";

  private snapshot: Snapshot = {
    notes: [],
    colors: [],
    settings: DEFAULT_SETTINGS,
  };
  /** Object URLs handed out for <img src>, reused so one blob maps to one URL. */
  private urls = new Map<string, string>();

  async load(): Promise<Snapshot> {
    const existing = read();
    this.snapshot = existing
      ? migrate(existing)
      : { notes: [], colors: seedColors(), settings: DEFAULT_SETTINGS };
    write(this.snapshot);
    return this.clone();
  }

  async createNote(input: NewNote): Promise<Note> {
    const { body, isTask, done } = detectTask(input.body);
    const now = new Date().toISOString();
    const seq =
      this.snapshot.notes.reduce((max, n) => Math.max(max, n.seq), 0) + 1;

    const note: Note = {
      id: uid(),
      seq,
      body,
      colorId: input.colorId,
      tags: parseTags(body),
      images: input.images ?? [],
      projectStatus: input.projectStatus ?? null,
      parentId: input.parentId ?? null,
      icon: input.icon ?? null,
      priority: input.priority ?? null,
      listCadence: null,
      amount: null,
      estimateMinutes: null,
      actualMinutes: null,
      snoozedUntil: null,
      isList: input.isList ?? false,
      // New steps land at the bottom of their project's list unless placed.
      order:
        input.order ??
        (input.parentId
          ? this.snapshot.notes.filter((n) => n.parentId === input.parentId)
              .length
          : 0),
      /*
       * Checkable only when you said so, or when the body says so with [].
       *
       * This used to force isTask on anything with a parent, from when the only
       * thing that could have a parent was a step. Now that a note can hold
       * notes, that turned every sub-folder into a to-do — "Cave Sniper" inside
       * "WowCool.World" arrived as something to tick off.
       */
      isTask: isTask || input.isTask === true,
      doneAt: done ? now : null,
      pinned: false,
      visibility: "private",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    this.snapshot.notes = [note, ...this.snapshot.notes];
    write(this.snapshot);
    return { ...note };
  }

  async updateNote(id: string, patch: Partial<Note>): Promise<Note> {
    const i = this.snapshot.notes.findIndex((n) => n.id === id);
    if (i === -1) throw new Error(`no note ${id}`);

    const previous = this.snapshot.notes[i];
    const next: Note = {
      ...previous,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    // Tags are derived, never passed in.
    if (patch.body !== undefined) next.tags = parseTags(next.body);

    // Images dropped from a note lose their bytes too, or IndexedDB only grows.
    if (patch.images !== undefined) {
      const kept = new Set(next.images.map((img) => img.id));
      for (const img of previous.images) {
        if (!kept.has(img.id)) this.forgetImage(img.id);
      }
    }

    this.snapshot.notes = this.snapshot.notes.with(i, next);
    write(this.snapshot);
    return { ...next };
  }

  /**
   * Deleting a container takes everything inside it, all the way down.
   *
   * This used to take one level, which was right when only one level existed.
   * With a real tree it would have orphaned every grandchild: still in the
   * store, pointing at a parent that no longer exists, reachable by nothing.
   */
  async deleteNote(id: string): Promise<void> {
    const doomed = [
      ...this.snapshot.notes.filter((n) => n.id === id),
      ...descendantsOf(this.snapshot.notes, id),
    ];
    for (const note of doomed) {
      for (const img of note.images) this.forgetImage(img.id);
    }
    const ids = new Set(doomed.map((n) => n.id));
    this.snapshot.notes = this.snapshot.notes.filter((n) => !ids.has(n.id));
    write(this.snapshot);
  }

  async restoreNotes(notes: Note[]): Promise<void> {
    const known = new Set(this.snapshot.notes.map((n) => n.id));
    this.snapshot.notes = [
      ...notes.filter((n) => !known.has(n.id)),
      ...this.snapshot.notes,
    ];
    write(this.snapshot);
  }

  async updateColor(id: string, patch: Partial<Color>): Promise<Color> {
    const i = this.snapshot.colors.findIndex((c) => c.id === id);
    if (i === -1) throw new Error(`no color ${id}`);

    const next: Color = { ...this.snapshot.colors[i], ...patch, id };
    this.snapshot.colors = this.snapshot.colors.with(i, next);
    write(this.snapshot);
    return { ...next };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    this.snapshot.settings = { ...this.snapshot.settings, ...patch };
    write(this.snapshot);
    return { ...this.snapshot.settings };
  }

  async saveImage(id: string, blob: Blob): Promise<void> {
    await putBlob(id, blob);
  }

  async imageUrl(id: string): Promise<string | null> {
    const cached = this.urls.get(id);
    if (cached) return cached;
    const blob = await getBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.urls.set(id, url);
    return url;
  }

  async export(): Promise<Backup> {
    const images: Record<string, string> = {};
    for (const note of this.snapshot.notes) {
      for (const img of note.images) {
        const blob = await getBlob(img.id);
        if (blob) images[img.id] = await blobToDataUrl(blob);
      }
    }
    return {
      format: "noella.backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: this.snapshot.notes,
      colors: this.snapshot.colors,
      settings: this.snapshot.settings,
      images,
    };
  }

  async import(backup: Backup): Promise<Snapshot> {
    if (backup.format !== "noella.backup") {
      throw new Error("not a Noella backup");
    }

    for (const [id, dataUrl] of Object.entries(backup.images ?? {})) {
      try {
        await putBlob(id, await dataUrlToBlob(dataUrl));
      } catch {
        // One unreadable image should not sink the whole restore.
      }
    }

    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();

    this.snapshot = migrate({
      notes: backup.notes ?? [],
      colors: backup.colors ?? seedColors(),
      settings: backup.settings ?? DEFAULT_SETTINGS,
    });
    write(this.snapshot);
    return this.clone();
  }

  private forgetImage(id: string): void {
    const url = this.urls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urls.delete(id);
    }
    void deleteBlob(id);
  }

  private clone(): Snapshot {
    return {
      notes: this.snapshot.notes.map((n) => ({ ...n })),
      colors: this.snapshot.colors.map((c) => ({ ...c })),
      settings: { ...this.snapshot.settings },
    };
  }
}
