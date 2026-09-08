"use client";

import { markLabel } from "@/lib/stickers";
import { titleOf } from "@/lib/rooms";
import { swatchName } from "@/lib/store/defaults";
import { useNoella } from "@/lib/store/provider";
import type { Note } from "@/lib/types";
import { isIconName } from "./Icon";
import { useCarry } from "./DragProvider";

/**
 * What you are carrying, and where it is about to land.
 *
 * Dragging used to be a card at 35% and an outline somewhere else, and you had
 * to hold both in your head to know what letting go would do. This says it in
 * words, next to the pointer, the whole time — so a drop is something you read
 * before you commit to it rather than something you find out afterwards.
 */
export function Ghost({
  notes,
  picked,
}: {
  notes: Note[];
  picked: Set<string>;
}) {
  const carry = useCarry();
  const { colors } = useNoella();
  if (!carry.grab) return null;

  /*
   * Kept clear of the right edge. Following the pointer at +14 put a 280px
   * label off the side of a phone the moment you carried something towards the
   * tabs on the right, so past the middle it hangs off the other hand.
   */
  const wide = document.documentElement.clientWidth;
  const right = wide - carry.grab.x - 22;
  const left = carry.grab.x - 22;
  const flip = right < 288 && left > right;
  const cap = Math.min(288, Math.max(flip ? left : right, 120));

  const held = notes.find((n) => n.id === carry.grab!.id);
  const many = held && picked.has(held.id) && picked.size > 1 ? picked.size : 0;
  const what = many ? `${many} notes` : held ? titleOf(held) : "";

  return (
    <span
      aria-hidden
      style={{
        maxWidth: cap,
        top: carry.grab.y - 10,
        ...(flip
          ? { right: wide - carry.grab.x + 14 }
          : { left: carry.grab.x + 14 }),
      }}
      className="pointer-events-none fixed z-50 flex items-baseline gap-2
                 border-2 border-ink bg-paper px-2 py-1 text-[calc(14px*var(--type))]
                 text-ink shadow-lg"
    >
      <span className="truncate">{what}</span>
      {landing(carry.over, carry.where, notes, colors) && (
        <span className="label shrink-0 text-mute">
          {landing(carry.over, carry.where, notes, colors)}
        </span>
      )}
    </span>
  );
}

/** The half sentence after the name: what letting go here would do. */
function landing(
  overId: string | null,
  where: "into" | "above" | "below",
  notes: Note[],
  colors: { id: string; name: string | null }[],
): string {
  if (!overId) return "";
  if (overId === "drop:today") return "onto today";
  if (overId === "drop:top") return "out to the top";
  if (overId === "drop:pick") return "onto the pile";
  if (overId.startsWith("drop:color:")) {
    const id = overId.slice("drop:color:".length);
    const at = colors.findIndex((c) => c.id === id);
    return at < 0 ? "" : `into ${colors[at].name ?? swatchName(at)}`;
  }
  if (overId.startsWith("drop:mark:")) {
    const m = overId.slice("drop:mark:".length);
    return isIconName(m) ? `marked ${markLabel(m).toLowerCase()}` : "";
  }
  const target = notes.find((n) => n.id === overId);
  if (!target) return "";
  const name = titleOf(target);
  return where === "into" ? `inside ${name}` : `beside ${name}`;
}
