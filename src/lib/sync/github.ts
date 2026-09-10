/**
 * A file in a repository you own, read and written from the browser.
 *
 * No server, no account, no third party holding your notes — the same promise
 * the app already made about localStorage, extended to a second device. What
 * you get in exchange for a personal access token is that every save is a
 * commit, so the history of your wall is a thing you can actually walk back
 * through rather than a hope.
 */

const API = "https://api.github.com";

export interface Connection {
  owner: string;
  repo: string;
  path: string;
  token: string;
}

export interface RemoteFile {
  text: string;
  /** GitHub's blob sha. Sent back on write so a stale copy is refused. */
  sha: string;
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** What went wrong, in words a person can act on. */
function explain(status: number, body: string): string {
  if (status === 401) return "That token was refused. Check it, or make a new one.";
  if (status === 403) {
    return body.includes("rate limit")
      ? "GitHub is rate limiting. Try again in a few minutes."
      : "That token cannot write here. It needs Contents: read and write on this repository.";
  }
  if (status === 404) {
    return "No such repository, or the token cannot see it.";
  }
  if (status === 409) return "Someone else wrote first.";
  if (status === 422) return "GitHub refused the write.";
  return `GitHub said ${status}.`;
}

async function call(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok && res.status !== 404) {
    throw new GitHubError(res.status, explain(res.status, await res.text()));
  }
  return res;
}

/**
 * Everything the token already knows, so you do not have to type it.
 *
 * Connecting asked for an owner, a repository, a path and a token — four
 * boxes, three of which the fourth can answer. A token knows who made it and
 * which repositories it can reach; the file is called noella.json unless you
 * say otherwise. So there is one box now, and the rest is a question of
 * picking from what came back.
 */
export async function whoAmI(token: string): Promise<string> {
  const res = await call(`${API}/user`, token);
  if (res.status === 404) throw new GitHubError(404, explain(404, ""));
  const json = (await res.json()) as { login: string };
  return json.login;
}

export interface Reachable {
  owner: string;
  repo: string;
  fullName: string;
  private: boolean;
  pushable: boolean;
}

/**
 * The repositories this token can actually reach, newest touched first.
 *
 * A fine-grained token scoped to one repository returns exactly that one,
 * which is the case worth optimising: there is nothing to choose and the app
 * should not pretend there is.
 */
export async function reachableRepos(token: string): Promise<Reachable[]> {
  const res = await call(
    `${API}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator`,
    token,
  );
  if (res.status === 404) return [];
  const json = (await res.json()) as {
    name: string;
    full_name: string;
    private: boolean;
    owner: { login: string };
    permissions?: { push?: boolean };
  }[];
  return json.map((r) => ({
    owner: r.owner.login,
    repo: r.name,
    fullName: r.full_name,
    private: r.private,
    pushable: r.permissions?.push !== false,
  }));
}

/**
 * Makes the private repository, so nobody has to leave the app to have one.
 *
 * The list of what a token can reach is only useful if something on it is
 * private, and a person who has never wanted a private repository does not
 * have one — so the honest first run ends at a list of three public repos and
 * a correct refusal to pick any of them. That is a dead end, and the way out
 * of it is one request.
 *
 * Not every token may. A fine-grained token is scoped to repositories that
 * already exist and cannot create one; the caller is expected to say so and
 * point at the page that can.
 */
export async function createPrivateRepo(
  token: string,
  name: string,
): Promise<Reachable> {
  const res = await fetch(`${API}/user/repos`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      private: true,
      auto_init: true,
      description: "My Noella notes. Written by the app, private on purpose.",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new GitHubError(
        res.status,
        "This token cannot make repositories. Make one on GitHub yourself — it takes a moment — then come back.",
      );
    }
    if (res.status === 422) {
      throw new GitHubError(
        422,
        body.includes("already exists")
          ? `You already have one called ${name}. Pick another name.`
          : "GitHub would not take that name.",
      );
    }
    throw new GitHubError(res.status, explain(res.status, body));
  }
  const json = (await res.json()) as {
    name: string;
    full_name: string;
    private: boolean;
    owner: { login: string };
  };
  return {
    owner: json.owner.login,
    repo: json.name,
    fullName: json.full_name,
    private: json.private,
    pushable: true,
  };
}

export interface RepoFacts {
  private: boolean;
  defaultBranch: string;
  fullName: string;
}

/**
 * Whether the repository is private, mostly.
 *
 * Putting a wall of private notes in a public repository is the one mistake
 * here that cannot be taken back — it is on the internet and in the history
 * the moment it lands — so the app asks before it writes rather than after.
 */
export async function repoFacts(c: Connection): Promise<RepoFacts> {
  const res = await call(`${API}/repos/${c.owner}/${c.repo}`, c.token);
  if (res.status === 404) throw new GitHubError(404, explain(404, ""));
  const json = (await res.json()) as {
    private: boolean;
    default_branch: string;
    full_name: string;
  };
  return {
    private: json.private,
    defaultBranch: json.default_branch,
    fullName: json.full_name,
  };
}

/**
 * The whole connection as one string you can paste.
 *
 * Setting up the second device meant retyping an owner, a repository, a path
 * and a ninety-character token — on a phone, from a laptop screen. Nobody does
 * that, which is how you end up with three devices holding three different
 * lists and no idea why. One code, copied once, pasted once.
 *
 * It contains the token, so it is a password and the app says so.
 */
const CODE = "noella1:";

export function packConnection(c: Connection): string {
  return (
    CODE +
    toBase64(JSON.stringify({ o: c.owner, r: c.repo, p: c.path, t: c.token }))
  );
}

export function unpackConnection(code: string): Connection | null {
  const body = code.trim();
  if (!body.startsWith(CODE)) return null;
  try {
    const raw: unknown = JSON.parse(fromBase64(body.slice(CODE.length)));
    if (typeof raw !== "object" || raw === null) return null;
    const c = raw as { o?: string; r?: string; p?: string; t?: string };
    if (!c.o || !c.r || !c.p || !c.t) return null;
    return { owner: c.o, repo: c.r, path: c.p, token: c.t };
  } catch {
    return null;
  }
}

/** Base64 that survives anything you can type. btoa alone does not. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Null when the file is not there yet, which is the normal first run. */
export async function readFile(c: Connection): Promise<RemoteFile | null> {
  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${encodeURI(c.path)}`;
  // GitHub caches aggressively at this endpoint and a stale read is a lost
  // note, so every read is asked for fresh.
  const res = await call(`${url}?ref=HEAD&t=${Date.now()}`, c.token, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const json = (await res.json()) as { content?: string; sha: string };
  return {
    text: json.content ? fromBase64(json.content) : "",
    sha: json.sha,
  };
}

/**
 * Writes the file, refusing if the copy you started from is no longer current.
 * A 409 here is not a failure, it is the other device having got there first —
 * the caller re-reads, merges again and comes back.
 */
export async function writeFile(
  c: Connection,
  text: string,
  sha: string | null,
  message: string,
): Promise<string> {
  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${encodeURI(c.path)}`;
  const res = await call(url, c.token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: toBase64(text),
      ...(sha ? { sha } : {}),
    }),
  });
  const json = (await res.json()) as { content: { sha: string } };
  return json.content.sha;
}
