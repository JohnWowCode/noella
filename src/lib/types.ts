import type { NoteImage } from "./images";
import type { Priority } from "./priority";
import type { Cadence } from "./recurrence";

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
   * The day you put this on today, as a local date key.
   *
   * Today is a promise about a day, so it is dated. A flag with no date stops
   * meaning today about a week after you set it — something marked for today
   * in March is still marked in June — and a list that has quietly stopped
   * being true is how every system like this dies. The date is what separates
   * what you chose this morning from what you have been carrying, and so what
   * lets today be finishable rather than another filter over everything.
   *
   * It used to be welded to a priority of "now", which meant you could not say
   * "this is the most important thing I have and I am not doing it today".
   */
  todayOn: string | null;
  /** Metadata only — the bytes live in IndexedDB, keyed by image id. */
  images: NoteImage[];
  /** The note this one lives inside, or null at the top of the wall. */
  parentId: string | null;
  /**
   * Makes what is inside recur: the contents un-tick when the period turns.
   * A bill is exactly this — a handful of things that come back every month —
   * which is why bills were never a separate kind of note, and why this is a
   * property any note can have rather than a species of note.
   */
  repeats: Cadence | null;
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
  isTask?: boolean;
  repeats?: Cadence | null;
  icons?: string[];
  priority?: Priority | null;
}

export type { Priority };

export type { NoteImage };
