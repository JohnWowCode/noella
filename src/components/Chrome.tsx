"use client";

import Link from "next/link";
import { dayStamp } from "@/lib/format";
import { useNoella } from "@/lib/store/provider";

/** NOELLA, and a flat statement of what it currently contains. */
export function Header({
  right,
}: {
  right?: React.ReactNode;
}) {
  const { notes, colors } = useNoella();
  const open = notes.filter((n) => n.isTask && n.doneAt === null).length;

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="font-mono text-[15px] tracking-[0.2em]">
          NOELLA
        </Link>
        <span className="label hidden text-mute sm:inline">
          {notes.length} notes · {colors.length} worlds · {open} open
        </span>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function Footer() {
  const { notes, label, ready } = useNoella();
  // Gated on `ready` so the server and the first client render agree.
  return (
    <footer className="mt-10 border-t border-rule">
      <div className="label mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-4 text-mute">
        <span>Noella</span>
        <span aria-hidden>·</span>
        <span>{notes.length} rows</span>
        <span aria-hidden>·</span>
        <span>{label}</span>
        <span aria-hidden>·</span>
        <span>no server</span>
        <span aria-hidden>·</span>
        <span>{ready ? dayStamp(new Date().toISOString()) : "…"}</span>
      </div>
    </footer>
  );
}

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
    >
      {children}
    </Link>
  );
}
