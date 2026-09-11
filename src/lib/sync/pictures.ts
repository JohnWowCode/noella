/**
 * The bytes of a picture, carried to the other device.
 *
 * Everything else about a note syncs: the words, the colour, the tick, the
 * hour it is blocked into. The photo attached to it did not, and had never
 * been meant to — the sync file is notes, colours, settings and graves, and
 * the image bytes live in this browser's IndexedDB under an id. So a note
 * photographed on the phone arrived on the laptop as a card that knew it had
 * a picture, knew how big it was, reserved exactly the right space for it,
 * and had nothing whatsoever to draw there. The wall was right and the
 * picture was missing, which is the worst version: nothing is visibly broken,
 * you just cannot see your own photo.
 *
 * They are files beside the wall now, one each, named by the id the note
 * already carries. That naming is the whole design: the id is a uuid minted
 * when the picture was made, so the name is unique for ever, the content
 * under it can never change, and two devices writing "the same" picture are
 * writing identical bytes to the same path. No merge, no conflict, no
 * ordering — the hard part of syncing the wall does not exist here.
 */

import { getBlob, putBlob } from "../images";
import type { Note, NoteImage } from "../types";
import { readBytes, writeBytes, type Connection } from "./github";

/** Alongside the wall file, not in place of it. */
const FOLDER = "pictures";

/**
 * Big enough for any photo and most clips, small enough to survive a phone.
 *
 * The contents API takes base64, so the request body is a third larger again
 * than the file, and it is one request that either completes or is wasted —
 * there is no resuming it. A hundred-megabyte video off a phone camera is
 * a hundred and thirty-three megabytes of upload over whatever connection
 * the phone happens to be on, and the failure costs the whole of it. Local
 * video is allowed to be far bigger than this; it simply stays local, and
 * the note says so rather than pretending.
 */
export const MAX_SYNC_BYTES = 24 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * Where one picture lives.
 *
 * The extension is cosmetic — nothing reads it back, the id is the identity —
 * but it is what makes the folder browsable on github.com, and a repository
 * of your own notes that you cannot look through is a worse promise than the
 * one this app made.
 */
export function picturePath(media: NoteImage): string {
  const ext = EXTENSIONS[media.mime] ?? "bin";
  return `${FOLDER}/${media.id}.${ext}`;
}

export function tooBigToSync(media: NoteImage): boolean {
  return media.bytes > MAX_SYNC_BYTES;
}

/**
 * Which pictures this device has already put up.
 *
 * Without this every sync would re-offer every picture on the wall, and each
 * offer is a request — a hundred photos is a hundred round trips every time
 * anything at all changes. The record is per device because it is a fact
 * about what this device has done, and a wrong one is cheap in both
 * directions: forgetting means an extra upload that 422s harmlessly, and
 * remembering something that was never written means one note stays missing
 * its picture until the record is cleared.
 */
const SENT = "noella.cloud.pictures";

function readSent(): Set<string> {
  try {
    const raw = localStorage.getItem(SENT);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? (list as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSent(ids: Set<string>): void {
  try {
    localStorage.setItem(SENT, JSON.stringify([...ids]));
  } catch {
    // Then it re-offers them next time, which costs requests and nothing else.
  }
}

export function forgetSent(): void {
  try {
    localStorage.removeItem(SENT);
  } catch {
    // As above.
  }
}

export interface PictureRun {
  /** How many sets of bytes went up. */
  sent: number;
  /** How many stayed behind for being too large. */
  skipped: number;
}

/**
 * Sends up whatever this device holds and the repository does not.
 *
 * Deliberately after the wall is written, not before. If the two halves can
 * disagree — and over a flaky connection they will — the survivable order is
 * a note whose picture has not arrived yet, which resolves itself on the next
 * round. The other order puts bytes in the repository that no note refers to,
 * and nothing will ever come back to collect them.
 *
 * One failure does not stop the rest. A picture that cannot be sent this time
 * is simply not recorded as sent, so the next round tries it again.
 */
export async function sendPictures(
  connection: Connection,
  notes: Note[],
  onStep?: (done: number, total: number) => void,
): Promise<PictureRun> {
  const sent = readSent();
  let count = 0;
  let skipped = 0;

  /*
   * Counted up front so there is something to count towards.
   *
   * The first round after connecting a wall that already has photos on it is
   * the slow one — every picture is a separate upload — and a round that says
   * only "Syncing" for four minutes is indistinguishable from one that has
   * hung. Knowing there are eleven of them makes the wait a wait.
   */
  const queue = [...allPictures(notes)].filter(
    (m) => !sent.has(m.id) && !tooBigToSync(m),
  );
  if (queue.length > 0) onStep?.(0, queue.length);

  for (const media of allPictures(notes)) {
    if (sent.has(media.id)) continue;
    if (tooBigToSync(media)) {
      skipped += 1;
      continue;
    }
    try {
      const blob = await getBlob(media.id);
      // Not on this device: it belongs to the other one, which will send it.
      if (!blob) continue;
      await writeBytes(
        connection,
        picturePath(media),
        blob,
        `Noella · picture ${media.id.slice(0, 8)}`,
      );
      sent.add(media.id);
      count += 1;
      onStep?.(count, queue.length);
    } catch {
      // Left out of the record on purpose, so the next round retries it.
      // Nothing here may throw: the wall has already been written by the time
      // this runs, and a picture that did not go up must not turn a sync that
      // succeeded into one that reports failure.
    }
  }

  writeSent(sent);
  return { sent: count, skipped };
}

/**
 * Fetches one picture this device has never held, and keeps it.
 *
 * Called when something tries to draw a picture whose bytes are not here,
 * which is the only moment the answer is needed — a wall of four hundred
 * photos should not pull four hundred files down to show you the six on
 * screen. Once fetched it goes into the same IndexedDB store a locally taken
 * picture would, so it is fetched exactly once per device and works offline
 * afterwards like any other.
 */
export async function fetchPicture(
  connection: Connection,
  media: NoteImage,
): Promise<Blob | null> {
  const blob = await readBytes(connection, picturePath(media));
  if (!blob) return null;
  // The raw endpoint does not always say what the bytes are; the note does.
  const typed = blob.type === media.mime ? blob : new Blob([blob], { type: media.mime });
  await putBlob(media.id, typed);
  // It is demonstrably up there — we just read it — so never send it back.
  markSent(media.id);
  return typed;
}

function markSent(id: string): void {
  const sent = readSent();
  sent.add(id);
  writeSent(sent);
}

function* allPictures(notes: Note[]): Generator<NoteImage> {
  for (const note of notes) {
    for (const media of note.images) yield media;
  }
}
