"use client";

import type { Color } from "@/lib/types";

interface Props {
  color: Color;
  index: number;
  selected: boolean;
  onSelect: () => void;
  size?: "sm" | "md";
  /** Compose and filter rows show the same colours, so they need distinct names. */
  purpose: "file" | "filter";
  /** Shown under filter swatches so a world's weight is visible at a glance. */
  count?: number;
}

/** A flat block of colour. Selection is a thick inset ring, never a rounded glow. */
export function Swatch({
  color,
  index,
  selected,
  onSelect,
  size = "md",
  purpose,
  count,
}: Props) {
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const world = color.name ?? `World ${index + 1}`;
  const verb = purpose === "file" ? "File in" : "Filter to";
  const key = index < 9 ? ` — key ${index + 1}` : "";

  const button = (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${world}${key}${count === undefined ? "" : ` — ${count} notes`}`}
      className={`${box} border border-rule transition-none ${
        selected ? "ring-2 ring-inset ring-ink" : "hover:opacity-80"
      }`}
      style={{ backgroundColor: color.hex }}
    >
      <span className="sr-only">{`${verb} ${world}`}</span>
    </button>
  );

  // A column of twelve zeros under twelve colours is the emptiest possible
  // reading of a wall. Only a world you have actually used says how much is
  // in it; the rest are just colours you have not picked yet.
  if (count === undefined || count === 0) return button;

  return (
    <span className="flex flex-col items-center gap-1.5">
      {button}
      <span className="label text-[10px] text-mute tabular-nums">{count}</span>
    </span>
  );
}
