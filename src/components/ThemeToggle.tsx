"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";

const KEY = "noella.theme";
const ORDER: ThemeChoice[] = ["auto", "light", "dark"];

/** Auto follows the OS, so night mode arrives when your phone's does. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  const dark =
    choice === "dark" ||
    (choice === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) root.dataset.theme = "dark";
  else delete root.dataset.theme;
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");

  // The stored choice is read after mount so the markup matches the server;
  // the boot script in the layout has already painted the right colours.
  useEffect(() => {
    let live = true;
    const stored = (() => {
      try {
        return localStorage.getItem(KEY) as ThemeChoice | null;
      } catch {
        return null;
      }
    })();
    Promise.resolve().then(() => {
      if (live && stored && ORDER.includes(stored)) setChoice(stored);
    });
    return () => {
      live = false;
    };
  }, []);

  // In auto, a change to the OS setting has to reach the page live.
  useEffect(() => {
    if (choice !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme("auto");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [choice]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    setChoice(next);
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Preference just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${choice}. Click to change.`}
      title="Auto follows your system"
      className="label px-2.5 py-2 text-mute hover:text-ink"
    >
      {choice}
    </button>
  );
}
