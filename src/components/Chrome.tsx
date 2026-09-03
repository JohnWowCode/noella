"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The masthead, and nothing else.
 *
 * It used to carry a running tally — "12 notes · 2 active · 3 open" — on every
 * screen, next to a nav of outlined buttons. Three numbers you did not ask for,
 * above three numbers you did. The counts live where they mean something now:
 * moves on Today, filters on the wall.
 */
export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-rule-soft">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-5 sm:px-6">
        <Link
          href="/"
          className="font-mono text-[16px] font-medium tracking-[0.22em]"
        >
          NOELLA
        </Link>
        <div className="ml-auto flex items-center gap-1">{right}</div>
      </div>
    </header>
  );
}

/**
 * A quiet line, not a status bar.
 *
 * "Noella · 41 rows · localStorage · no server · 2 Sep" was a debug readout at
 * the bottom of a writing app. Where your notes live is worth one sentence,
 * once, because it is genuinely reassuring; the row count is not.
 */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-rule-soft">
      <div className="mx-auto max-w-3xl px-5 py-7 sm:px-6">
        <p className="prose-note text-[14px] text-mute">
          Everything here lives on this device. No server, no account, nothing
          leaves.
        </p>
      </div>
    </footer>
  );
}

/**
 * Nav as words, not as buttons.
 *
 * Three outlined boxes in the corner read as three decisions. Underlining where
 * you already are turns them back into signposts.
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The export serves /wall/ as well as /wall, so compare on the trimmed path.
  const here = (pathname ?? "/").replace(/\/+$/, "") || "/";
  const current = here === href.replace(/\/+$/, "") || (href === "/" && here === "/");

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`label px-2.5 py-2 ${
        current
          ? "text-ink underline decoration-1 underline-offset-[6px]"
          : "text-mute hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
