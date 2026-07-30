/** Body parsing. Everything here runs on write, never on read. */

import type { Note } from "./types";

const TAG_RE = /#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
// Matches `[]`, `[ ]`, `[x]`, `[X]`, `- []` — the empty form is what you
// actually type, so it has to work.
const TASK_RE = /^\s*(?:-\s*)?\[\s*([xX]?)\s*\]\s*/;

/** `#hashtags` lifted out of the body, deduped, lowercased. */
export function parseTags(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(TAG_RE)) found.add(m[1].toLowerCase());
  return [...found];
}

/**
 * A to-do is just a note you can check off. Leading `[]` or `[x]` marks one,
 * and the marker is stripped so the body stays clean.
 */
export function detectTask(body: string): {
  body: string;
  isTask: boolean;
  done: boolean;
} {
  const m = body.match(TASK_RE);
  if (!m) return { body, isTask: false, done: false };
  return {
    body: body.slice(m[0].length),
    isTask: true,
    done: m[1].toLowerCase() === "x",
  };
}

/** First line is the title. There is no title field. */
export function titleOf(body: string): string {
  return body.split("\n", 1)[0] ?? "";
}

export function restOf(body: string): string {
  const i = body.indexOf("\n");
  return i === -1 ? "" : body.slice(i + 1);
}

export function wordCount(body: string): number {
  const t = body.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function matches(note: Note, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q
    .split(/\s+/)
    .every(
      (term) =>
        note.body.toLowerCase().includes(term) ||
        note.tags.some((t) => `#${t}`.includes(term)),
    );
}
