/**
 * One round of syncing: read theirs, merge, write ours, keep the merge.
 *
 * Deliberately the whole file every time. A wall of two thousand notes is
 * about a megabyte of JSON, which is nothing to send and everything to reason
 * about — the alternative is a change log, and a change log that disagrees
 * with the wall is a class of bug that eats notes.
 */

import type { Snapshot } from "../store/types";
import { docFrom, mergeDocs, parseDoc, sameAs, type SyncDoc } from "./doc";
import {
  GitHubError,
  readFile,
  writeFile,
  type Connection,
} from "./github";
import { readGraves, readSha, writeGraves, writeSha } from "./local";

export interface SyncResult {
  /** The wall as it stands after merging. Null when nothing changed here. */
  merged: Snapshot | null;
  /** How many notes the other side taught us about. */
  pulled: number;
  /** Whether we wrote a new commit. */
  pushed: boolean;
  at: number;
}

function commitMessage(doc: SyncDoc): string {
  const n = doc.notes.length;
  return `Noella · ${n} ${n === 1 ? "note" : "notes"}`;
}

/**
 * Runs a full round and returns what changed.
 *
 * A 409 from GitHub is the other device having got there first, which is not
 * an error — it is the case this whole design exists for. Re-read, merge the
 * newer copy in as well, and try again. Twice is enough; a third collision
 * means something is writing in a loop and giving up is the safe answer.
 */
export async function syncOnce(
  connection: Connection,
  local: Snapshot,
): Promise<SyncResult> {
  let attempt = 0;
  let mine = docFrom(local, readGraves());

  for (;;) {
    attempt += 1;
    const remote = await readFile(connection);
    const theirs = remote ? parseDoc(remote.text) : null;

    if (!theirs) {
      // Nothing there yet, or something we cannot read. Ours becomes the file;
      // an unreadable file is never merged into, because guessing at half a
      // wall is worse than starting the history again.
      const sha = await writeFile(
        connection,
        JSON.stringify(mine, null, 2),
        remote?.sha ?? null,
        commitMessage(mine),
      );
      writeSha(sha);
      return { merged: null, pulled: 0, pushed: true, at: Date.now() };
    }

    const { doc, changed } = mergeDocs(mine, theirs);
    const nothingToSend = sameAs(doc, theirs);
    const nothingToKeep = sameAs(doc, mine);

    if (nothingToSend) {
      // Their copy already says everything ours does.
      writeSha(remote!.sha);
      writeGraves(doc.graves);
      return {
        merged: nothingToKeep ? null : toSnapshot(doc),
        pulled: changed,
        pushed: false,
        at: Date.now(),
      };
    }

    try {
      const sha = await writeFile(
        connection,
        JSON.stringify(doc, null, 2),
        remote!.sha,
        commitMessage(doc),
      );
      writeSha(sha);
      writeGraves(doc.graves);
      return {
        merged: nothingToKeep ? null : toSnapshot(doc),
        pulled: changed,
        pushed: true,
        at: Date.now(),
      };
    } catch (err) {
      const raced =
        err instanceof GitHubError && (err.status === 409 || err.status === 422);
      if (!raced || attempt >= 3) throw err;
      // Someone wrote between our read and our write. Carry what we have
      // merged so far into the next round rather than starting over.
      mine = doc;
    }
  }
}

function toSnapshot(doc: SyncDoc): Snapshot {
  return { notes: doc.notes, colors: doc.colors, settings: doc.settings };
}

/** True when this device has never seen the remote file. */
export function firstRun(): boolean {
  return readSha() === null;
}
