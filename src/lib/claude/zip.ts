/**
 * Just enough ZIP to read a Claude export.
 *
 * The export arrives as a .zip and the interesting parts are two JSON files
 * inside it. Asking you to unzip first and then find conversations.json is
 * three steps of housekeeping before the useful thing happens, and the useful
 * thing is "drag the file the browser just downloaded onto this box".
 *
 * A whole zip library would be a dependency for one file format we read once,
 * so this is the narrow path: find the central directory, walk its entries,
 * and inflate the ones asked for. Deflate is done by the platform —
 * DecompressionStream has been in every current browser for years — so the
 * only real work here is reading a well-documented header layout.
 *
 * Deliberately not handled: encryption, zip64, multi-disk archives, and any
 * compression method other than stored and deflate. An export uses none of
 * them, and failing loudly on something exotic beats half-reading it.
 */

const EOCD = 0x06054b50;
const ENTRY = 0x02014b50;

export interface ZipEntry {
  name: string;
  bytes: number;
}

export class NotAZip extends Error {}

/**
 * Reads the archive's index. Nothing is decompressed here, so this stays fast
 * on a large export and lets the caller pick out only what it wants.
 */
export async function readIndex(file: Blob): Promise<Map<string, ZipEntry & {
  offset: number;
  method: number;
  compressed: number;
}>> {
  const buf = new DataView(await file.arrayBuffer());
  // The end-of-central-directory record is last, after a comment of unknown
  // length, so it is found by scanning backwards for its signature.
  let end = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66_000; i--) {
    if (buf.getUint32(i, true) === EOCD) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new NotAZip("No zip index in that file");

  const count = buf.getUint16(end + 10, true);
  let at = buf.getUint32(end + 16, true);
  const out = new Map<
    string,
    ZipEntry & { offset: number; method: number; compressed: number }
  >();

  const text = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (buf.getUint32(at, true) !== ENTRY) break;
    const method = buf.getUint16(at + 10, true);
    const compressed = buf.getUint32(at + 20, true);
    const bytes = buf.getUint32(at + 24, true);
    const nameLen = buf.getUint16(at + 28, true);
    const extraLen = buf.getUint16(at + 30, true);
    const commentLen = buf.getUint16(at + 32, true);
    const offset = buf.getUint32(at + 42, true);
    const name = text.decode(
      new Uint8Array(buf.buffer, buf.byteOffset + at + 46, nameLen),
    );
    out.set(name, { name, bytes, offset, method, compressed });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Pulls one entry out as text. */
export async function readEntry(
  file: Blob,
  entry: { offset: number; method: number; compressed: number },
): Promise<string> {
  // The local header repeats the name and extra fields, and its own lengths
  // are the only reliable way past it — the central directory's do not match.
  const head = new DataView(
    await file.slice(entry.offset, entry.offset + 30).arrayBuffer(),
  );
  const nameLen = head.getUint16(26, true);
  const extraLen = head.getUint16(28, true);
  const from = entry.offset + 30 + nameLen + extraLen;
  const body = file.slice(from, from + entry.compressed);

  if (entry.method === 0) return body.text();
  if (entry.method !== 8) {
    throw new NotAZip(`That zip uses compression method ${entry.method}`);
  }
  const stream = body
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** Every `.json` file in the archive, by name. */
export async function readJsonFiles(
  file: Blob,
): Promise<Map<string, string>> {
  const index = await readIndex(file);
  const out = new Map<string, string>();
  for (const [name, entry] of index) {
    if (!name.toLowerCase().endsWith(".json")) continue;
    // Exports have nested directories in some versions; the basename is the
    // part anything downstream cares about.
    out.set(name.split("/").pop() ?? name, await readEntry(file, entry));
  }
  return out;
}
