export type Visibility = "private" | "unlisted" | "public";

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
}
