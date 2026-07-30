/**
 * Image handling. Bytes never touch localStorage — a single phone photo would
 * blow its ~5 MB cap — so blobs live in IndexedDB and notes only carry ids.
 */

export interface NoteImage {
  id: string;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  alt: string | null;
}

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

/** Pulls image files out of a paste or drop, ignoring everything else. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter(isImageFile);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
