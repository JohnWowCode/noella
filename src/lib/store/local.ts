import { detectTask, parseTags } from "../notes";
import type { Color, NewNote, Note } from "../types";
import { DEFAULT_SWATCHES } from "./defaults";
import type { Snapshot, Store } from "./types";

const KEY = "noella.v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Math.floor(Math.random() * 1e12).toString(36)}`;
}

function seedColors(): Color[] {
  return DEFAULT_SWATCHES.map((hex, i) => ({
    id: uid(),
    hex,
    name: null,
    emoji: null,
    position: i,
  }));
}

function read(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (!Array.isArray(parsed.notes) || !Array.isArray(parsed.colors)) {
      return null;
    }
    return { notes: parsed.notes, colors: parsed.colors };
  } catch {
    return null;
  }
}

function write(snapshot: Snapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private mode. The in-memory state is still correct.
  }
}

/** Browser-local store. No server, no account, no network. */
export class LocalStore implements Store {
  readonly label = "LOCALSTORAGE";

  private snapshot: Snapshot = { notes: [], colors: [] };

  async load(): Promise<Snapshot> {
    const existing = read();
    this.snapshot = existing ?? { notes: [], colors: seedColors() };
    if (!existing) write(this.snapshot);
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
      isTask,
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

    const next: Note = {
      ...this.snapshot.notes[i],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    // Tags are derived, never passed in.
    if (patch.body !== undefined) next.tags = parseTags(next.body);

    this.snapshot.notes = this.snapshot.notes.with(i, next);
    write(this.snapshot);
    return { ...next };
  }

  async deleteNote(id: string): Promise<void> {
    this.snapshot.notes = this.snapshot.notes.filter((n) => n.id !== id);
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

  private clone(): Snapshot {
    return {
      notes: this.snapshot.notes.map((n) => ({ ...n })),
      colors: this.snapshot.colors.map((c) => ({ ...c })),
    };
  }
}
