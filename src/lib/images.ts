/**
 * Pictures and video. Bytes never touch localStorage — a single phone photo
 * would blow its ~5 MB cap — so blobs live in IndexedDB and notes carry ids.
 *
 * A note can hold either. Stills are downscaled and re-encoded; video is kept
 * exactly as it arrived, because re-encoding it in a browser tab costs minutes
 * and there is nothing to gain — the file already went through a real encoder
 * on the way out of the camera.
 */

export interface NoteImage {
  id: string;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  alt: string | null;
  /**
   * Absent on everything stored before video existed, which is exactly the
   * shape of the data: no field, therefore a still.
   */
  kind?: "image" | "video";
  /** Seconds. Video only, and only when the browser would tell us. */
  duration?: number;
}

export function isVideo(media: NoteImage): boolean {
  return media.kind === "video";
}

/**
 * Big enough for anything shot on a phone, small enough that one clip cannot
 * quietly fill the origin's storage quota and start failing every later write.
 */
export const MAX_VIDEO_BYTES = 128 * 1024 * 1024;

/** Longest edge, in CSS pixels. Phone photos arrive far larger than any wall needs. */
const MAX_EDGE = 1600;
const DB_NAME = "noella-images";
const STORE = "blobs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function putBlob(id: string, blob: Blob): Promise<void> {
  return tx("readwrite", (s) => s.put(blob, id)).then(() => undefined);
}

export function getBlob(id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>("readonly", (s) => s.get(id));
}

export function deleteBlob(id: string): Promise<void> {
  return tx("readwrite", (s) => s.delete(id)).then(() => undefined);
}

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `img-${Math.floor(Math.random() * 1e12).toString(36)}`;
}

/**
 * Downscales to MAX_EDGE and re-encodes to WebP. A 4 MB camera JPEG lands
 * around 150 KB, which is what makes storing images locally viable at all.
 */
export async function prepareImage(file: File): Promise<{
  meta: NoteImage;
  blob: Blob;
}> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86),
  );
  if (!blob) throw new Error("encode failed");

  return {
    meta: {
      id: uid(),
      width,
      height,
      mime: blob.type,
      bytes: blob.size,
      alt: null,
    },
    blob,
  };
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export function isMediaFile(file: File): boolean {
  return isImageFile(file) || isVideoFile(file);
}

/**
 * Reads a clip's shape without decoding it.
 *
 * The dimensions matter for the same reason they do for stills: they reserve
 * the right space in the layout before the blob URL resolves, so a note does
 * not jump as its video arrives.
 */
export async function prepareVideo(file: File): Promise<{
  meta: NoteImage;
  blob: Blob;
}> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("video too large");
  }
  const url = URL.createObjectURL(file);
  try {
    const shape = await new Promise<{ w: number; h: number; d: number }>(
      (resolve, reject) => {
        const el = document.createElement("video");
        el.preload = "metadata";
        el.muted = true;
        el.onloadedmetadata = () =>
          resolve({
            w: el.videoWidth || 16,
            h: el.videoHeight || 9,
            d: Number.isFinite(el.duration) ? el.duration : 0,
          });
        el.onerror = () => reject(new Error("unreadable video"));
        el.src = url;
      },
    );
    return {
      meta: {
        id: uid(),
        width: shape.w,
        height: shape.h,
        mime: file.type,
        bytes: file.size,
        alt: null,
        kind: "video",
        duration: shape.d,
      },
      blob: file,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pulls anything we can hold out of a paste or drop, ignoring the rest. */
export function mediaFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter(isMediaFile);
}

/** Kept as the old name so existing call sites read the same. */
export const imageFilesFrom = mediaFilesFrom;

/** mm:ss, because a clip is always short enough for that to be the whole story. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
