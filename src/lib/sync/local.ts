/**
 * The device's side of syncing: who we are connected to, what we have
 * deleted, and where the remote copy was last seen.
 *
 * All of it on this device on purpose. The connection is a fact about this
 * browser, and the graves are a fact about what this browser did.
 */

import type { Grave } from "./doc";
import type { Connection } from "./github";

const CONN = "noella.cloud";
const GRAVES = "noella.graves";
const SEEN = "noella.cloud.sha";

export function readConnection(): Connection | null {
  try {
    const raw = localStorage.getItem(CONN);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Connection>;
    if (!c.owner || !c.repo || !c.path || !c.token) return null;
    return { owner: c.owner, repo: c.repo, path: c.path, token: c.token };
  } catch {
    return null;
  }
}

export function writeConnection(c: Connection): void {
  try {
    localStorage.setItem(CONN, JSON.stringify(c));
  } catch {
    // Nothing to be done; the caller will find it is not connected.
  }
}

export function forgetConnection(): void {
  try {
    localStorage.removeItem(CONN);
    localStorage.removeItem(SEEN);
  } catch {
    // As above.
  }
}

export function readSha(): string | null {
  try {
    return localStorage.getItem(SEEN);
  } catch {
    return null;
  }
}

export function writeSha(sha: string): void {
  try {
    localStorage.setItem(SEEN, sha);
  } catch {
    // A sync that cannot remember where it was simply re-reads. Slower, right.
  }
}

export function readGraves(): Grave[] {
  try {
    const raw = localStorage.getItem(GRAVES);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? (list as Grave[]) : [];
  } catch {
    return [];
  }
}

export function writeGraves(graves: Grave[]): void {
  try {
    localStorage.setItem(GRAVES, JSON.stringify(graves));
  } catch {
    // Then a delete may not stick across devices. Better than losing the note.
  }
}

/** Called wherever notes really disappear, so the other device hears about it. */
export function bury(ids: string[]): void {
  if (ids.length === 0) return;
  const at = new Date().toISOString();
  const graves = readGraves().filter((g) => !ids.includes(g.id));
  writeGraves([...graves, ...ids.map((id) => ({ id, at }))]);
}

/** Undo. A note that is back was never deleted, whatever the record says. */
export function unbury(ids: string[]): void {
  if (ids.length === 0) return;
  const keep = new Set(ids);
  writeGraves(readGraves().filter((g) => !keep.has(g.id)));
}
