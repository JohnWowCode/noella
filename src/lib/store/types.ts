import type { Color, NewNote, Note } from "../types";

export interface Snapshot {
  notes: Note[];
  colors: Color[];
}

/** A whole wall, images inlined as data URLs. What export writes and import reads. */
export interface Backup {
  format: "noella.backup";
  version: 1;
  exportedAt: string;
  notes: Note[];
  colors: Color[];
  /** image id -> data URL. Absent means the note renders without its images. */
  images: Record<string, string>;
}

/**
 * The only surface the UI knows about. `LocalStore` implements it against
 * localStorage + IndexedDB today; a `SupabaseStore` implements it against
 * Postgres + Storage later without the components changing.
 */
export interface Store {
  /** Shown in the footer, so it is always obvious where the data lives. */
  readonly label: string;
  load(): Promise<Snapshot>;
  createNote(input: NewNote): Promise<Note>;
  updateNote(id: string, patch: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  updateColor(id: string, patch: Partial<Color>): Promise<Color>;

  /** Resolves an image id to something an <img src> accepts. */
  imageUrl(id: string): Promise<string | null>;
  /** Stores prepared bytes. Called before the note that references them. */
  saveImage(id: string, blob: Blob): Promise<void>;

  export(): Promise<Backup>;
  /** Replaces everything. Returns the restored snapshot. */
  import(backup: Backup): Promise<Snapshot>;
}
