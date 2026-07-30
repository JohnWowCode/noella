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
}

/** A flat block of colour. Selection is a thick inset ring, never a rounded glow. */
export function Swatch({
  color,
  index,
  selected,
  onSelect,
  size = "md",
  purpose,
}: Props) {
  const box = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const world = color.name ?? `World ${index + 1}`;
  const verb = purpose === "file" ? "File in" : "Filter to";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${world} — key ${index + 1}`}
      className={`${box} border border-rule transition-none ${
        selected ? "ring-2 ring-inset ring-ink" : "hover:opacity-80"
      }`}
      style={{ backgroundColor: color.hex }}
    >
      <span className="sr-only">{`${verb} ${world}`}</span>
    </button>
  );
}
