"use client";

import { useEffect, useState } from "react";
import {
  createPrivateRepo,
  packConnection,
  reachableRepos,
  repoFacts,
  unpackConnection,
  whoAmI,
  type Connection,
  type Reachable,
} from "@/lib/sync/github";
import {
  forgetConnection,
  readConnection,
  writeConnection,
} from "@/lib/sync/local";
import { useNoella } from "@/lib/store/provider";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

const DEFAULT_PATH = "noella.json";
const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

/**
 * The same wall on every screen you own, without an account.
 *
 * It writes one JSON file into a repository you already control, so nobody is
 * holding your notes but you and nothing needs a server. Every sync is a
 * commit, so the wall has a history you can walk back through.
 *
 * The first version of this asked for an owner, a repository, a path and a
 * token — four boxes, three of which the fourth can answer, and no clue what
 * to put in any of them. A token knows who made it and what it can reach. So:
 * one box, then pick the repository out of a list of the ones that came back.
 * On the second and third device, not even that — one setup code, pasted.
 */
export function Cloud() {
  const { cloud } = useNoella();
  const [step, setStep] = useState<"choose" | "token" | "code" | "byhand">(
    "choose",
  );
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Reachable[] | null>(null);
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [risky, setRisky] = useState<Reachable | null>(null);
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState<Connection | null>(null);
  // Typed by hand, for the case where the token can list nothing.
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [fresh, setFresh] = useState("noella-notes");
  const [making, setMaking] = useState(false);

  useEffect(() => {
    const stored = readConnection();
    Promise.resolve().then(() => {
      if (stored) setLive(stored);
    });
  }, []);

  const field =
    "prose-note w-full border border-rule bg-field px-2.5 py-2 text-[calc(15px*var(--type))] outline-none focus:border-ink";
  const primary =
    "label border border-ink bg-ink px-3 py-2 text-paper enabled:hover:bg-transparent enabled:hover:text-ink disabled:opacity-50 [@media(hover:none)]:min-h-11";
  const plain =
    "label border border-rule px-3 py-2 hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11";

  /** Step one: find out what this token can see. */
  async function look() {
    const t = token.trim();
    if (!t) return;
    setBusy(true);
    setProblem(null);
    try {
      const login = await whoAmI(t);
      const repos = await reachableRepos(t);
      setWho(login);
      /* Private first: it is the only kind that should be picked. */
      setFound(
        repos
          .filter((r) => r.pushable)
          .sort((a, b) => Number(b.private) - Number(a.private)),
      );
      setOwner(login);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  function connect(c: Connection) {
    writeConnection(c);
    setLive(c);
    setToken("");
    setFound(null);
    setRisky(null);
    cloud.reconnect();
    cloud.now();
  }

  /** Step two: use one. Public repositories have to be said out loud. */
  function choose(r: Reachable) {
    if (!r.private && risky?.fullName !== r.fullName) {
      setRisky(r);
      return;
    }
    connect({
      owner: r.owner,
      repo: r.repo,
      path: DEFAULT_PATH,
      token: token.trim(),
    });
  }

  /**
   * Makes one, because a list of public repositories is a list of wrong
   * answers and stopping there is not help.
   */
  async function makeOne() {
    const name = fresh.trim();
    if (!name) return;
    setMaking(true);
    setProblem(null);
    try {
      const made = await createPrivateRepo(token.trim(), name);
      connect({
        owner: made.owner,
        repo: made.repo,
        path: DEFAULT_PATH,
        token: token.trim(),
      });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setMaking(false);
    }
  }

  async function byHand(force: boolean) {
    const c: Connection = {
      owner: owner.trim().replace(/^@/, ""),
      repo: repo.trim(),
      path: DEFAULT_PATH,
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
        setRisky({
          owner: c.owner,
          repo: c.repo,
          fullName: facts.fullName,
          private: false,
          pushable: true,
        });
        setBusy(false);
        return;
      }
      connect(c);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function applyCode(force: boolean) {
    const c = unpackConnection(code);
    if (!c) {
      setProblem(
        "That is not a setup code. Copy it from a device that is already syncing.",
      );
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const facts = await repoFacts(c);
      if (!facts.private && !force) {
        setRisky({
          owner: c.owner,
          repo: c.repo,
          fullName: facts.fullName,
          private: false,
          pushable: true,
        });
        setBusy(false);
        return;
      }
      connect(c);
      setCode("");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover
      label="The same notes everywhere"
      set={cloud.state !== "off"}
      align="right"
      current={
        <span className="label flex items-center gap-1.5">
          <Icon name="cloud" size={15} />
          {said(cloud.state, cloud.at, cloud.doing)}
        </span>
      }
    >
      {() => (
        <div className="flex w-72 flex-col gap-2 sm:w-80">
          {live ? (
            <Connected
              live={live}
              copied={copied}
              onCopy={() => {
                void navigator.clipboard
                  ?.writeText(packConnection(live))
                  .then(() => setCopied(true))
                  .catch(() => setCode(packConnection(live)));
              }}
              spilled={code}
              trouble={cloud.trouble}
              onSync={() => cloud.now()}
              onForget={() => {
                forgetConnection();
                setLive(null);
                setStep("choose");
                setCopied(false);
                cloud.reconnect();
              }}
            />
          ) : step === "choose" ? (
            <>
              <p className="prose-note text-[calc(14px*var(--type))] text-mute">
                Your notes, in one file in a repository you own. No account, no
                server.
              </p>
              <button
                type="button"
                onClick={() => setStep("code")}
                className={primary}
              >
                I have a setup code
              </button>
              <p className="prose-note text-[calc(13px*var(--type))] text-mute">
                From a device that is already syncing — that is the easy one.
              </p>
              <button
                type="button"
                onClick={() => setStep("token")}
                className={plain}
              >
                Set up the first device
              </button>
            </>
          ) : step === "code" ? (
            <>
              <textarea
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={3}
                placeholder="noella1:…"
                aria-label="Paste a setup code"
                className={`${field} break-all text-[calc(13px*var(--type))]`}
              />
              {risky && <Public name={risky.fullName} />}
              {problem && <Problem>{problem}</Problem>}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy || !code.trim()}
                  onClick={() => void applyCode(risky !== null)}
                  className={primary}
                >
                  {busy ? "Checking…" : risky ? "Use it anyway" : "Use it"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("choose");
                    setProblem(null);
                    setRisky(null);
                  }}
                  className={plain}
                >
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              {found === null ? (
                <>
                  <p className="prose-note text-[calc(14px*var(--type))]">
                    Two minutes, once.
                  </p>
                  <ol className="prose-note flex flex-col gap-1.5 text-[calc(14px*var(--type))] text-mute">
                    <li>
                      1. Make a <strong className="font-semibold">private</strong>{" "}
                      repository on GitHub — call it anything.
                    </li>
                    <li>
                      2.{" "}
                      <a
                        href={TOKEN_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-1 underline-offset-2 hover:no-underline"
                      >
                        Make a token here
                      </a>
                      . Choose <em>Only select repositories</em>, pick that one,
                      and under Repository permissions set{" "}
                      <strong className="font-semibold">
                        Contents: Read and write
                      </strong>
                      .
                    </li>
                    <li>3. Paste it below. Nothing else to fill in.</li>
                  </ol>
                  <input
                    autoFocus
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    type="password"
                    autoComplete="off"
                    placeholder="github_pat_…"
                    aria-label="Access token"
                    className={field}
                  />
                  {problem && <Problem>{problem}</Problem>}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !token.trim()}
                      onClick={() => void look()}
                      className={primary}
                    >
                      {busy ? "Looking…" : "Next"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("choose");
                        setProblem(null);
                      }}
                      className={plain}
                    >
                      Back
                    </button>
                  </div>
                  <p className="prose-note text-[calc(13px*var(--type))] text-mute">
                    The token is kept in this browser only. Anyone with this
                    device unlocked can use it, so keep it to the one
                    repository.
                  </p>
                </>
              ) : (
                <>
                  <p className="label text-mute">
                    Signed in as {who}
                    {found.length > 0 &&
                      ` · ${found.length} ${found.length === 1 ? "repository" : "repositories"}`}
                  </p>
                  {risky && <Public name={risky.fullName} />}
                  {found.length === 0 ? (
                    <>
                      <p className="prose-note text-[calc(14px*var(--type))] text-mute">
                        That token cannot write to anything yet. Make one below,
                        or give it Contents: read and write on a repository you
                        already have and name it here.
                      </p>
                      <input
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        placeholder="owner"
                        aria-label="GitHub owner"
                        className={field}
                      />
                      <input
                        value={repo}
                        onChange={(e) => setRepo(e.target.value)}
                        placeholder="repository"
                        aria-label="Repository"
                        className={field}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void byHand(risky !== null)}
                        className={primary}
                      >
                        {busy ? "Checking…" : risky ? "Use it anyway" : "Use it"}
                      </button>
                    </>
                  ) : (
                    <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                      {found.map((r) => (
                        <li key={r.fullName}>
                          <button
                            type="button"
                            onClick={() => choose(r)}
                            className="flex w-full items-baseline gap-2 border border-rule px-2.5 py-2 text-left hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11"
                          >
                            <span className="prose-note min-w-0 flex-1 truncate text-[calc(15px*var(--type))]">
                              {r.fullName}
                            </span>
                            <span className="label shrink-0 opacity-60">
                              {r.private ? "private" : "public"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/*
                    The way out of a list of wrong answers.

                    Somebody who has never wanted a private repository does not
                    have one, so an honest first run ends at three public repos
                    and a correct refusal to pick any of them. Offered always,
                    and said loudly when nothing on the list is private.
                  */}
                  <div className="flex flex-col gap-1.5 border-t border-rule-soft pt-2">
                    {found.length > 0 && found.every((r) => !r.private) && (
                      <p className="prose-note text-[calc(14px*var(--type))]">
                        None of those are private — anything you wrote would be
                        readable by anyone. Make one that is not:
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        value={fresh}
                        onChange={(e) => setFresh(e.target.value)}
                        aria-label="Name for a new private repository"
                        className={field}
                      />
                      <button
                        type="button"
                        disabled={making || !fresh.trim()}
                        onClick={() => void makeOne()}
                        className={`${primary} shrink-0`}
                      >
                        {making ? "Making…" : "Make it"}
                      </button>
                    </div>
                    {/* Where the making of it can go wrong: a name already
                      taken, or a token that is not allowed to. Both were being
                      set and never drawn, so pressing Make it did nothing
                      visible at all. */}
                    {problem && <Problem>{problem}</Problem>}
                    <p className="prose-note text-[calc(13px*var(--type))] text-mute">
                      A new private repository in your account, connected
                      straight away.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFound(null);
                      setRisky(null);
                      setProblem(null);
                    }}
                    className={plain}
                  >
                    Back
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

/** Connected: where it goes, one code to carry, and the way out. */
function Connected({
  live,
  copied,
  spilled,
  trouble,
  onCopy,
  onSync,
  onForget,
}: {
  live: Connection;
  copied: boolean;
  /** The code, shown as text when the clipboard refused it. */
  spilled: string;
  trouble: string | null;
  onCopy: () => void;
  onSync: () => void;
  onForget: () => void;
}) {
  return (
    <>
      <p className="label text-mute">
        {live.owner}/{live.repo}
      </p>
      {trouble && (
        <p className="prose-note text-[calc(14px*var(--type))] text-mute">
          {trouble}
        </p>
      )}
      <button type="button" onClick={onCopy} className="label border border-ink bg-ink px-3 py-2 text-paper hover:bg-transparent hover:text-ink [@media(hover:none)]:min-h-11">
        {copied ? "Copied — paste it on the other one" : "Copy setup code"}
      </button>
      <p className="prose-note text-[calc(13px*var(--type))] text-mute">
        {copied
          ? "It contains the token, so treat it like a password."
          : "Paste this into your other devices and they become the same wall."}
      </p>
      {spilled && (
        <textarea
          readOnly
          value={spilled}
          rows={3}
          aria-label="Setup code"
          onFocus={(e) => e.currentTarget.select()}
          className="prose-note w-full border border-rule bg-field px-2 py-1.5 text-[calc(12px*var(--type))] break-all outline-none"
        />
      )}
      <p className="prose-note text-[calc(13px*var(--type))] text-mute">
        Notes, folders and settings travel. Pictures stay on the device they
        were added to.
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSync}
          className="label border border-rule px-3 py-2 hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11"
        >
          Sync now
        </button>
        <button
          type="button"
          onClick={onForget}
          className="label border border-rule px-3 py-2 text-mute hover:bg-ink hover:text-paper [@media(hover:none)]:min-h-11"
        >
          Forget the token
        </button>
      </div>
    </>
  );
}

/** The one mistake that cannot be taken back, said before it is made. */
function Public({ name }: { name: string }) {
  return (
    <p className="prose-note border-2 border-ink px-2.5 py-2 text-[calc(14px*var(--type))]">
      {name} is public. Everything you have written would be readable by
      anyone, and would stay in the history even after you deleted it.
    </p>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="prose-note text-[calc(14px*var(--type))] text-mute">
      {children}
    </p>
  );
}

/** Four words for four states. Never a spinner that says nothing. */
function said(state: string, at: number, doing: string | null): string {
  // A round that is uploading photos is the one round slow enough that
  // "Syncing" stops being informative and starts being worrying.
  if (state === "working") return doing ?? "Syncing";
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
