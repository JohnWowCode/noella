import type { NoteImage } from "./images";
import type { Priority } from "./priority";
import type { Cadence } from "./recurrence";
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
  /**
   * Why this exists: bug, money, art, admin. As many as apply.
   *
   * A wall of forty titles has to be read; a wall of forty marks is
   * recognised. These used to be one decorative sticker each, sorting nothing,
   * which wasted the fastest surface on the card — they are the tags now, and
   * the wall filters and groups by them.
   */
  icons: string[];
  /** Now, next, later, or — most of the time — nothing at all. */
  priority: Priority | null;
  /**
   * The day you said "now", as a local date key.
   *
   * Now means today — that is what it has always said on the picker — but a
   * label with no date does not mean today for long. Something marked now in
   * March is still marked now in June, and a list that has quietly stopped
   * being true is how every system like this dies. The date is what lets the
   * app tell "today's" from "carried over", and so what lets today be a thing
   * you can finish rather than a filter over everything you ever meant to do.
   */
  rankedOn: string | null;
  /** Metadata only — the bytes live in IndexedDB, keyed by image id. */
  images: NoteImage[];
  /**
   * A project is a note you promoted. Non-null means this note is one; the
   * status is how you keep tabs on it. Nothing else about the note changes.
   */
  projectStatus: ProjectStatus | null;
  /** Set on a step: the id of the project note it belongs to. */
  parentId: string | null;
  /**
   * A list is a note you promoted, like a project, but inert: no status, no
   * drift, no claim on today. Somewhere to keep twenty things without any of
   * them becoming a demand.
   */
  isList: boolean;
  /**
   * Set on a list to make it recur: its items un-tick when the period turns.
   * A bill is exactly this — a list of things that come back every month —
   * which is why bills are not a separate kind of note.
   */
  listCadence: Cadence | null;
  /** Optional money on a list item, so a recurring list can total itself. */
  amount: number | null;
  /**
   * Minutes you guessed this would take, and minutes it actually took.
   * ADHD time estimation is systematically short, and the only way to correct
   * for that is to see your own guess next to your own result.
   */
  estimateMinutes: number | null;
  actualMinutes: number | null;
  /** Drift can be deferred. An undismissable list of failures is a reason to stop opening the app. */
  snoozedUntil: string | null;
  /**
   * Hand-set priority among siblings — projects among projects, steps within
   * their project. Lower is sooner. Position 1 among the active projects is
   * today's move.
   */
  order: number;
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
  /** Explicit position among siblings. Used to insert a step above another. */
  order?: number;
  /*
   * What it is, decided as you write it.
   *
   * These used to be reachable only by making a plain note and then finding
   * "Make a project" behind a hover-only menu on the card — which meant that
   * for anyone on a phone, or anyone who never hovered a card, projects
   * effectively did not exist. Deciding at the keyboard is one action.
   */
  projectStatus?: ProjectStatus | null;
  isList?: boolean;
  isTask?: boolean;
  icons?: string[];
  priority?: Priority | null;
}

export type { Priority };

export type { NoteImage };
