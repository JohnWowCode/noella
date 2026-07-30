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
  const live = notes.filter((n) => n.archivedAt === null);
  const open = live.filter((n) => n.isTask && n.doneAt === null).length;
  const active = live.filter((n) => n.projectStatus === "active").length;

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-6">
        <Link href="/" className="font-mono text-[15px] tracking-[0.2em]">
          NOELLA
        </Link>
        <span className="label hidden text-mute sm:inline">
          {live.filter((n) => n.parentId === null).length} notes ·{" "}
          {colors.length} worlds · {active} active · {open} open
        </span>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function Footer() {
  const { notes, label, ready } = useNoella();
  // Archived rows still exist in the store, so they are counted separately
  // rather than left to look like a disagreement with the header.
  const archived = notes.filter((n) => n.archivedAt !== null).length;
  // Gated on `ready` so the server and the first client render agree.
  return (
    <footer className="mt-14 border-t border-rule">
      <div className="label mx-auto flex max-w-3xl flex-wrap items-center gap-x-2.5 gap-y-1.5 px-5 py-6 text-mute sm:px-6">
        <span>Noella</span>
        <span aria-hidden>·</span>
        <span>{notes.length} rows</span>
        {archived > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{archived} archived</span>
          </>
        )}
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
      className="label border border-rule px-2.5 py-2 hover:bg-ink hover:text-paper"
    >
      {children}
    </Link>
  );
}
