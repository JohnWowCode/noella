"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

export type Face = "literata" | "atkinson" | "lexend" | "system";
export type Size = "normal" | "large" | "huge";

export interface ReadingChoice {
  face: Face;
  roomy: boolean;
  size: Size;
}

const KEY = "noella.reading";
const DEFAULT: ReadingChoice = {
  face: "literata",
  roomy: false,
  size: "normal",
};

/**
 * What each one is for, said plainly.
 *
 * A list of four typeface names is a list of four fonts you have no reason to
 * prefer. Naming what each was built to fix turns it into a question you can
 * actually answer about your own eyes.
 */
const FACES: { id: Face; name: string; why: string }[] = [
  {
    id: "literata",
    name: "Literata",
    why: "A serif made for screens. The default.",
  },
  {
    id: "atkinson",
    name: "Atkinson",
    why: "Every letter drawn to be unmistakable.",
  },
  {
    id: "lexend",
    name: "Lexend",
    why: "Built wide, and tested for reading speed.",
  },
  {
    id: "system",
    name: "Your system",
    why: "Whatever this device already uses.",
  },
];

const SIZES: { id: Size; name: string }[] = [
  { id: "normal", name: "Normal" },
  { id: "large", name: "Large" },
  { id: "huge", name: "Huge" },
];

export function applyReading(choice: ReadingChoice): void {
  const root = document.documentElement;
  if (choice.face === "literata") delete root.dataset.face;
  else root.dataset.face = choice.face;
  if (choice.roomy) root.dataset.roomy = "1";
  else delete root.dataset.roomy;
  if (choice.size === "normal") delete root.dataset.size;
  else root.dataset.size = choice.size;
}

/**
 * How the words are set, as a setting rather than an opinion.
 *
 * The typeface list is taste and eyesight. The roomy switch is not: every
 * study that found a "dyslexia font" helping lost the effect the moment the
 * plain font was given the same letter and word spacing, so spacing is the
 * control that actually does something and it gets said out loud.
 *
 * Stored on the device, next to the theme, rather than in the wall — it is
 * about this screen and these eyes, not about your notes, and it should not
 * follow an export onto somebody else's monitor.
 */
export function Reading() {
  const [choice, setChoice] = useState<ReadingChoice>(DEFAULT);

  // Read after mount so the markup matches the server; the boot script in the
  // layout has already set the attributes, so nothing moves on the way in.
  useEffect(() => {
    let live = true;
    const stored = (() => {
      try {
        return JSON.parse(localStorage.getItem(KEY) ?? "null");
      } catch {
        return null;
      }
    })();
    Promise.resolve().then(() => {
      if (live && stored) setChoice({ ...DEFAULT, ...stored });
    });
    return () => {
      live = false;
    };
  }, []);

  function set(patch: Partial<ReadingChoice>) {
    const next = { ...choice, ...patch };
    setChoice(next);
    applyReading(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage blocked; the setting still holds for this session.
    }
  }

  return (
    <Popover
      label="How it reads"
      set={
        choice.face !== "literata" || choice.roomy || choice.size !== "normal"
      }
      align="right"
      current={<Icon name="read" size={16} />}
    >
      {() => (
        <span className="flex w-72 flex-col gap-3">
          <span className="flex flex-col gap-1">
            <span className="label text-mute">Typeface</span>
            {FACES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => set({ face: f.id })}
                aria-pressed={choice.face === f.id}
                className={`flex flex-col px-2 py-1.5 text-left ${
                  choice.face === f.id ? "bg-ink text-paper" : "hover:bg-ink/10"
                }`}
              >
                <span
                  className="text-[calc(16px*var(--type))] leading-snug"
                  style={{
                    fontFamily:
                      f.id === "literata"
                        ? "var(--font-literata), serif"
                        : f.id === "atkinson"
                          ? "var(--font-atkinson), sans-serif"
                          : f.id === "lexend"
                            ? "var(--font-lexend), sans-serif"
                            : "ui-sans-serif, system-ui, sans-serif",
                  }}
                >
                  {f.name}
                </span>
                <span className="label mt-0.5 normal-case tracking-normal opacity-65">
                  {f.why}
                </span>
              </button>
            ))}
          </span>

          <span className="flex flex-col gap-1">
            <span className="label text-mute">Size</span>
            <span className="flex gap-1">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set({ size: s.id })}
                  aria-pressed={choice.size === s.id}
                  className={`label flex-1 border px-2 py-1.5 ${
                    choice.size === s.id
                      ? "border-ink bg-ink text-paper"
                      : "border-rule hover:border-ink"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </span>
          </span>

          <button
            type="button"
            onClick={() => set({ roomy: !choice.roomy })}
            aria-pressed={choice.roomy}
            className={`flex flex-col border px-2.5 py-2 text-left ${
              choice.roomy
                ? "border-ink bg-ink text-paper"
                : "border-rule hover:border-ink"
            }`}
          >
            <span className="label">
              Roomier {choice.roomy ? "· on" : "· off"}
            </span>
            <span className="label mt-1 normal-case tracking-normal opacity-65">
              More air between letters, words and lines. This is the one with
              the evidence behind it.
            </span>
          </button>
        </span>
      )}
    </Popover>
  );
}
