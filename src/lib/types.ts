import type { NoteImage } from "./images";
import type { Bill } from "./money";
import type { ProjectStatus } from "./projects";

export type Visibility = "private" | "unlisted" | "public";

/** App-wide preferences. Travels with the wall in an export. */
export interface Settings {
  /** Symbol shown before every amount. One currency per wall is enough. */
  currency: string;
}

export const DEFAULT_SETTINGS: Settings = { currency: "$" };

/** A colour is a world. Naming it is optional and always. */
export interface Color {
  id: string;
  hex: string;
  name: string | null;
  emoji: string | null;
  position: number;
}

export interface Note {
  id: string;
  /** Per-owner monotonic index. This is the NOTE 0041 you see on the card. */
  seq: number;
  body: string;
  colorId: string | null;
  /** Parsed out of the body on write. Cross-cuts worlds. */
  tags: string[];
  /** Metadata only — the bytes live in IndexedDB, keyed by image id. */
  images: NoteImage[];
  /**
   * A project is a note you promoted. Non-null means this note is one; the
   * status is how you keep tabs on it. Nothing else about the note changes.
   */
  projectStatus: ProjectStatus | null;
  /** Set on a step: the id of the project note it belongs to. */
  parentId: string | null;
  /** Non-null means this note is a bill. Recurrence, not a row per month. */
  bill: Bill | null;
  isTask: boolean;
  doneAt: string | null;
  pinned: boolean;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface NewNote {
  body: string;
  colorId: string | null;
  images?: NoteImage[];
  /** Set to file the new note as a step of that project. */
  parentId?: string | null;
}

export type { NoteImage };
