"use client";

import { useRef, useState } from "react";
import { dayStamp } from "@/lib/format";
import { useNoella } from "@/lib/store/provider";
import type { Backup } from "@/lib/store/types";

/**
 * The wall lives in one browser. Without a way out, a cleared cache is the end
 * of it — so export writes a single self-contained JSON file, images inlined.
 */
export function DataMenu() {
  const { exportBackup, importBackup, notes } = useNoella();
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function download() {
    setStatus("Packing…");
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noella-${dayStamp(backup.exportedAt)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`${backup.notes.length} rows written`);
    } catch {
      setStatus("Export failed");
    }
  }

  async function restore(file: File) {
    // Import replaces the whole wall, so it asks first.
    const ok = window.confirm(
      `Replace all ${notes.length} notes on this wall with the contents of ${file.name}?`,
    );
    if (!ok) return;

    setStatus("Restoring…");
    try {
      const backup = JSON.parse(await file.text()) as Backup;
      await importBackup(backup);
      setStatus(`${backup.notes?.length ?? 0} rows restored`);
    } catch {
      setStatus("Not a Noella backup");
    }
  }

  return (
    <span className="label flex items-center gap-2">
      {status && <span className="text-mute">{status}</span>}
      <button
        type="button"
        onClick={download}
        className="label border border-rule px-2 py-1.5 hover:bg-ink hover:text-paper"
      >
        Export
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void restore(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="label border border-rule px-2 py-1.5 hover:bg-ink hover:text-paper"
      >
        Import
      </button>
    </span>
  );
}
