import type { Color, NewNote, Note } from "../types";

export interface Snapshot {
  notes: Note[];
  colors: Color[];
}

/**
 * The only surface the UI knows about. `LocalStore` implements it against
 * localStorage today; a `SupabaseStore` implements it against Postgres + RLS
 * later without the components changing.
 */
export interface Store {
  /** Shown in the footer, so it is always obvious where the data lives. */
  readonly label: string;
  load(): Promise<Snapshot>;
  createNote(input: NewNote): Promise<Note>;
  updateNote(id: string, patch: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  updateColor(id: string, patch: Partial<Color>): Promise<Color>;
}
