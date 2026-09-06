/**
 * Sending a note somewhere else.
 *
 * The ask was "add something to JSpace from the notes app". JSpace is not a
 * repository I can see and not an API I can read, so guessing at its shape
 * would ship something that looks finished and works for nobody. What is here
 * instead is the general case, which JSpace fits whatever it turns out to be:
 * a destination you configure once, in two flavours that between them cover
 * essentially every personal tool.
 *
 * A link, when the destination is a page that takes text in its URL. The
 * placeholders {text}, {title} and {url} are filled in and the page opens in a
 * new tab. This one always works — no CORS, no endpoint, nothing to deploy —
 * which is why it is the default and why the field says so.
 *
 * A POST, when the destination is a real endpoint. The note goes as JSON with
 * an optional bearer token. A static page posting cross-origin needs the
 * receiving end to answer the preflight, so this can fail for reasons that
 * have nothing to do with Noella; when it does, the payload goes to the
 * clipboard rather than into the void.
 */

export interface Destination {
  /** What the button says. "JSpace", by default. */
  name: string;
  /**
   * Either a URL with {text}/{title}/{url} in it, which opens in a tab, or a
   * plain endpoint, which is posted to. The presence of a placeholder is what
   * decides — one field, no mode switch to get wrong.
   */
  url: string;
  /** Sent as `Authorization: Bearer …` on a POST. Never added to a link. */
  token: string;
}

export const NO_DESTINATION: Destination = { name: "JSpace", url: "", token: "" };

const KEY = "noella.send";

export function readDestination(): Destination {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return NO_DESTINATION;
    return { ...NO_DESTINATION, ...(JSON.parse(raw) as Partial<Destination>) };
  } catch {
    return NO_DESTINATION;
  }
}

export function writeDestination(next: Destination): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked. The destination holds for this session only.
  }
}

export function isLink(destination: Destination): boolean {
  return /\{(text|title|url)\}/.test(destination.url);
}

export function configured(destination: Destination): boolean {
  return destination.url.trim().length > 0;
}

/** What a note looks like on the way out. Ids kept, so a reply can find it. */
export interface Parcel {
  id: string;
  ref: string;
  title: string;
  body: string;
  marks: string[];
  tags: string[];
  priority: string | null;
  done: boolean;
  createdAt: string;
  /** A deep link back into Noella, so the far end can point at the original. */
  url: string;
}

function fill(template: string, parcel: Parcel): string {
  return template
    .replaceAll("{text}", encodeURIComponent(parcel.body))
    .replaceAll("{title}", encodeURIComponent(parcel.title))
    .replaceAll("{url}", encodeURIComponent(parcel.url));
}

export type SendResult =
  | { ok: true; how: "opened" | "posted" }
  | { ok: false; how: "copied" | "failed"; why: string };

export async function send(
  destination: Destination,
  parcel: Parcel,
): Promise<SendResult> {
  if (!configured(destination)) {
    return { ok: false, how: "failed", why: "No destination set" };
  }

  if (isLink(destination)) {
    // noopener, because the far end gets a handle on this tab otherwise.
    window.open(fill(destination.url, parcel), "_blank", "noopener,noreferrer");
    return { ok: true, how: "opened" };
  }

  try {
    const response = await fetch(destination.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(destination.token
          ? { Authorization: `Bearer ${destination.token}` }
          : {}),
      },
      body: JSON.stringify(parcel),
    });
    if (!response.ok) {
      return await copied(parcel, `${destination.name} said ${response.status}`);
    }
    return { ok: true, how: "posted" };
  } catch (error) {
    /*
     * Almost always the browser refusing the cross-origin request rather than
     * the endpoint being down, and the two are indistinguishable from here by
     * design. Either way the note is not lost: it goes to the clipboard.
     */
    return await copied(
      parcel,
      error instanceof Error && error.name === "TypeError"
        ? "Blocked by the browser — the far end needs to allow this origin"
        : "Could not reach it",
    );
  }
}

async function copied(parcel: Parcel, why: string): Promise<SendResult> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(parcel, null, 2));
    return { ok: false, how: "copied", why };
  } catch {
    return { ok: false, how: "failed", why };
  }
}
