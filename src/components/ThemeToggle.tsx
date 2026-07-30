"use client";

/**
 * No React state: the label is picked by CSS from the `data-theme` attribute
 * the boot script already applied. That keeps server and client markup
 * identical while always showing the truth.
 */
export function ThemeToggle() {
  function flip() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (next === "dark") root.dataset.theme = "dark";
    else delete root.dataset.theme;
    try {
      localStorage.setItem("noella.theme", next);
    } catch {
      // Preference just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label="Toggle theme"
      className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
    >
      <span className="dark:hidden">Light</span>
      <span className="hidden dark:inline">Dark</span>
    </button>
  );
}
