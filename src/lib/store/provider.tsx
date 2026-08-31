"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { seqLabel } from "../format";
import { prepareImage } from "../images";
import {
  DEFAULT_SETTINGS,
  type Color,
  type NewNote,
  type Note,
  type NoteImage,
  type Settings,
} from "../types";
import { LocalStore } from "./local";
import type { Backup, Store } from "./types";

interface Noella {
  ready: boolean;
  label: string;
  notes: Note[];
  colors: Color[];
  settings: Settings;
  colorOf: (note: Note) => Color | null;
  addNote: (input: NewNote) => void;
  patchNote: (id: string, patch: Partial<Note>) => void;
  removeNote: (id: string) => void;
  patchColor: (id: string, patch: Partial<Color>) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  /** The last undoable thing that happened, if it is still offered. */
  undo: { label: string; run: () => void } | null;
  dismissUndo: () => void;
  /** Downscales, stores the bytes, and hands back metadata to attach. */
  attachImage: (file: File) => Promise<NoteImage>;
  imageUrl: (id: string) => Promise<string | null>;
  exportBackup: () => Promise<Backup>;
  importBackup: (backup: Backup) => Promise<void>;
}

const Ctx = createContext<Noella | null>(null);

export function NoellaProvider({ children }: { children: React.ReactNode }) {
  // Held in state rather than a ref so it can be read during render. Swap this
  // one line for `new SupabaseStore(...)` to move off the browser.
  const [store] = useState<Store>(() => new LocalStore());
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [undo, setUndo] = useState<Noella["undo"]>(null);

  useEffect(() => {
    let live = true;
    store.load().then((snapshot) => {
      if (!live) return;
      setNotes(snapshot.notes);
      setColors(snapshot.colors);
      setSettings(snapshot.settings);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [store]);

  // Every mutation writes to state first and reconciles after. The card shows
  // up the instant you hit save, before the store has answered.
  const addNote = useCallback(
    (input: NewNote) => {
      store.createNote(input).then((note) => {
        setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
      });
    },
    [store],
  );

  const patchNote = useCallback(
    (id: string, patch: Partial<Note>) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch, id } : n)),
      );
      store.updateNote(id, patch).then((saved) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)));
      });
    },
    [store],
  );

  /**
   * Delete is the only action in the app that cannot be walked back from the
   * UI — archive keeps the note, status changes are just fields. So it is the
   * one that carries an undo, and it captures the project's steps too, because
   * deleting a project takes them with it.
   */
  const removeNote = useCallback(
    (id: string) => {
      setNotes((prev) => {
        const doomed = prev.filter((n) => n.id === id || n.parentId === id);
        if (doomed.length > 0) {
          const subject = doomed.find((n) => n.id === id);
          const extra = doomed.length - 1;
          setUndo({
            label:
              `Deleted ${seqLabel(subject?.seq ?? 0)}` +
              (extra > 0 ? ` and ${extra} step${extra === 1 ? "" : "s"}` : ""),
            run: () => {
              setNotes((current) => [
                ...doomed.filter((d) => !current.some((c) => c.id === d.id)),
                ...current,
              ]);
              store.restoreNotes(doomed);
              setUndo(null);
            },
          });
        }
        return prev.filter((n) => n.id !== id && n.parentId !== id);
      });
      store.deleteNote(id);
    },
    [store],
  );

  const dismissUndo = useCallback(() => setUndo(null), []);

  const patchColor = useCallback(
    (id: string, patch: Partial<Color>) => {
      setColors((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch, id } : c)),
      );
      store.updateColor(id, patch);
    },
    [store],
  );

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      store.updateSettings(patch);
    },
    [store],
  );

  const attachImage = useCallback(
    async (file: File) => {
      const { meta, blob } = await prepareImage(file);
      await store.saveImage(meta.id, blob);
      return meta;
    },
    [store],
  );

  const imageUrl = useCallback((id: string) => store.imageUrl(id), [store]);

  const exportBackup = useCallback(() => store.export(), [store]);

  const importBackup = useCallback(
    async (backup: Backup) => {
      const snapshot = await store.import(backup);
      setNotes(snapshot.notes);
      setColors(snapshot.colors);
      setSettings(snapshot.settings);
    },
    [store],
  );

  const value = useMemo<Noella>(() => {
    const byId = new Map(colors.map((c) => [c.id, c]));
    return {
      ready,
      label: store.label,
      notes,
      colors,
      settings,
      colorOf: (note) => (note.colorId ? byId.get(note.colorId) ?? null : null),
      addNote,
      patchNote,
      removeNote,
      patchColor,
      patchSettings,
      undo,
      dismissUndo,
      attachImage,
      imageUrl,
      exportBackup,
      importBackup,
    };
  }, [
    store,
    ready,
    notes,
    colors,
    settings,
    addNote,
    patchNote,
    removeNote,
    patchColor,
    patchSettings,
    undo,
    dismissUndo,
    attachImage,
    imageUrl,
    exportBackup,
    importBackup,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNoella(): Noella {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNoella outside NoellaProvider");
  return ctx;
}

/** A colour with no name is still a world. Give it something to display. */
export function colorLabel(color: Color | null, colors: Color[]): string {
  if (!color) return "NO COLOR";
  if (color.name) return color.name.toUpperCase();
  const n = colors.findIndex((c) => c.id === color.id) + 1;
  return `WORLD ${n || "?"}`;
}
