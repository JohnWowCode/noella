"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { prepareImage } from "../images";
import type { Color, NewNote, Note, NoteImage } from "../types";
import { LocalStore } from "./local";
import type { Backup, Store } from "./types";

interface Noella {
  ready: boolean;
  label: string;
  notes: Note[];
  colors: Color[];
  colorOf: (note: Note) => Color | null;
  addNote: (input: NewNote) => void;
  patchNote: (id: string, patch: Partial<Note>) => void;
  removeNote: (id: string) => void;
  patchColor: (id: string, patch: Partial<Color>) => void;
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

  useEffect(() => {
    let live = true;
    store.load().then((snapshot) => {
      if (!live) return;
      setNotes(snapshot.notes);
      setColors(snapshot.colors);
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

  const removeNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      store.deleteNote(id);
    },
    [store],
  );

  const patchColor = useCallback(
    (id: string, patch: Partial<Color>) => {
      setColors((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch, id } : c)),
      );
      store.updateColor(id, patch);
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
      colorOf: (note) => (note.colorId ? byId.get(note.colorId) ?? null : null),
      addNote,
      patchNote,
      removeNote,
      patchColor,
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
    addNote,
    patchNote,
    removeNote,
    patchColor,
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
