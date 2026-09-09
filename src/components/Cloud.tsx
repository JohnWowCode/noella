"use client";

import { useEffect, useState } from "react";
import { repoFacts, type Connection } from "@/lib/sync/github";
import {
  forgetConnection,
  readConnection,
  writeConnection,
} from "@/lib/sync/local";
import { useNoella } from "@/lib/store/provider";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

const DEFAULT_PATH = "noella.json";

/**
 * The same wall on every screen you own, without an account.
 *
 * It writes one JSON file into a repository you already control, so nobody is
 * holding your notes but you and nothing needs a server — which is the promise
 * the app made on day one, extended to a second device. The side effect is the
 * good part: every sync is a commit, so the wall has a history you can walk
 * back through, and "I deleted something a week ago" stops being a disaster.
 *
 * Two things this asks for honestly rather than burying. The token lives in
 * this browser's storage, so a fine-grained one scoped to a single repository
 * is the right kind to make. And the repository wants to be private, which is
 * the one mistake here that cannot be taken back — so it is checked before
 * anything is written, not after.
 */
export function Cloud() {
  const { cloud } = useNoella();
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [path, setPath] = useState(DEFAULT_PATH);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [live, setLive] = useState<Connection | null>(null);

  useEffect(() => {
    const stored = readConnection();
    Promise.resolve().then(() => {
      if (!stored) return;
      setLive(stored);
      setOwner(stored.owner);
      setRepo(stored.repo);
      setPath(stored.path);
    });
  }, []);

  async function connect(force: boolean) {
    const c: Connection = {
      owner: owner.trim().replace(/^@/, ""),
      repo: repo.trim(),
      path: path.trim() || DEFAULT_PATH,
      token: token.trim(),
    };
    if (!c.owner || !c.repo || !c.token) {
      setProblem("It needs an owner, a repository and a token.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const facts = await repoFacts(c);
      if (!facts.private && !force) {
        setWarn(
          `${facts.fullName} is public. Everything you have written would be readable by anyone, and would stay in the history even after you deleted it.`,
        );
        setBusy(false);
        return;
      }
      writeConnection(c);
      setLive(c);
      setToken("");
      setWarn(null);
      cloud.reconnect();
      cloud.now();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "prose-note min-w-0 flex-1 border border-rule bg-field px-2.5 py-2 text-[calc(15px*var(--type))] outline-none focus:border-ink";

  return (
    <Popover
      label="The same notes everywhere"
      set={cloud.state !== "off"}
      align="right"
      current={
        <span className="label flex items-center gap-1.5">
          <Icon name="cloud" size={15} />
          {said(cloud.state, cloud.at)}
        </span>
      }
    >
      {() => (
        <div className="flex w-72 flex-col gap-2 sm:w-80">
          {live ? (
            <>
              <p className="label text-mute">
                {live.owner}/{live.repo} · {live.path}
              </p>
              {cloud.trouble && (
                <p className="prose-note text-[calc(14px*var(--type))] text-mute">
                  {cloud.trouble}
                </p>
              )}
              <p className="prose-note text-[calc(14px*var(--type))] text-mute">
                Notes, folders and settings travel. Pictures stay on the device
                they were added to.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => cloud.now()}
                  className="label border border-ink bg-ink px-3 py-2 text-paper hover:bg-transparent hover:text-ink [@media(hover:none)]:min-h-11"
                >
                  Sync now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    forgetConnection();
                    setLive(null);
                    cloud.reconnect();
                  }}
                  className="label border border-rule px-3 py-2 text-mute hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11"
                >
                  Forget the token
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="prose-note text-[calc(14px*var(--type))] text-mute">
                One JSON file in a repository you own. Make it{" "}
                <strong className="font-semibold">private</strong>, and make a
                fine-grained token that can reach only that one repository, with
                Contents: read and write.
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="you"
                  aria-label="GitHub owner"
                  className={field}
                />
                <span aria-hidden className="label text-mute">
                  /
                </span>
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="my-notes"
                  aria-label="Repository"
                  className={field}
                />
              </div>
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={DEFAULT_PATH}
                aria-label="File in the repository"
                className={field}
              />
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                autoComplete="off"
                placeholder="github_pat_…"
                aria-label="Access token"
                className={field}
              />
              {warn && (
                <p className="prose-note border-2 border-ink px-2.5 py-2 text-[calc(14px*var(--type))]">
                  {warn}
                </p>
              )}
              {problem && (
                <p className="prose-note text-[calc(14px*var(--type))] text-mute">
                  {problem}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect(warn !== null)}
                  className="label border border-ink bg-ink px-3 py-2 text-paper enabled:hover:bg-transparent enabled:hover:text-ink disabled:opacity-50 [@media(hover:none)]:min-h-11"
                >
                  {busy ? "Checking…" : warn ? "Use it anyway" : "Connect"}
                </button>
                {warn && (
                  <button
                    type="button"
                    onClick={() => setWarn(null)}
                    className="label border border-rule px-3 py-2 text-mute hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11"
                  >
                    Pick another
                  </button>
                )}
              </div>
              <p className="prose-note text-[calc(13px*var(--type))] text-mute">
                The token is kept in this browser only. Anyone with this device
                unlocked can use it, so scope it to the one repository.
              </p>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

/** Four words for four states. Never a spinner that says nothing. */
function said(state: string, at: number): string {
  if (state === "working") return "Syncing";
  if (state === "stuck") return "Stuck";
  if (state === "ok") return at ? `Synced ${ago(at)}` : "Synced";
  return "Cloud";
}

function ago(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : "a while ago";
}
