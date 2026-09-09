"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { seqLabel } from "../format";
import { isVideoFile, prepareImage, prepareVideo } from "../images";
import {
  DEFAULT_SETTINGS,
  type Color,
  type NewNote,
  type Note,
  type NoteImage,
  type Settings,
} from "../types";
import { descendantsOf } from "../tree";
import { LocalStore } from "./local";
import { readConnection } from "../sync/local";
import { syncOnce } from "../sync/run";
import type { Backup, Store } from "./types";

/** What the cloud is doing, in the four states a person cares about. */
export type CloudState = "off" | "working" | "ok" | "stuck";

export interface Cloud {
  state: CloudState;
  /** When the last good round finished. Epoch ms, 0 for never. */
  at: number;
  /** Why it is stuck, in words. */
  trouble: string | null;
  /** Runs a round now. Safe to call while one is already going.*/
  now: () => void;
  /** Re-reads the stored connection after it has been changed. */
  reconnect: () => void;
}

interface Noella {
  ready: boolean;
  label: string;
  notes: Note[];
  colors: Color[];
  settings: Settings;
  colorOf: (note: Note) => Color | null;
  addNote: (input: NewNote) => Promise<Note>;
  addNotes: (inputs: NewNote[]) => Promise<Note[]>;
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
  cloud: Cloud;
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
  const [cloudState, setCloudState] = useState<CloudState>("off");
  const [cloudAt, setCloudAt] = useState(0);
  const [trouble, setTrouble] = useState<string | null>(null);
  /** Bumped when the connection is changed, so the effects below re-arm. */
  const [wiring, setWiring] = useState(0);
  const [connected, setConnected] = useState(false);
  const running = useRef(false);
  const again = useRef(false);
  /*
   * A round that finishes while another was asked for runs the next one
   * itself. Reaching that through a ref rather than by name keeps the
   * function from referring to itself, which the compiler cannot memoize.
   */
  const loop = useRef<() => void>(() => {});

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

  /*
   * A round of syncing, and only ever one at a time.
   *
   * Two rounds overlapping would each merge against a wall the other is about
   * to change, and the loser would push a copy missing whatever the winner
   * had just pulled. A round asked for while one is running is remembered and
   * run once the current one is done.
   */
  const runSync = useCallback(async () => {
    const connection = readConnection();
    if (!connection) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setCloudState("working");
    try {
      const result = await syncOnce(connection, store.here());
      if (result.merged) {
        const kept = await store.adopt(result.merged);
        setNotes(kept.notes);
        setColors(kept.colors);
        setSettings(kept.settings);
      }
      setTrouble(null);
      setCloudAt(result.at);
      setCloudState("ok");
    } catch (err) {
      setTrouble(err instanceof Error ? err.message : "Something went wrong.");
      setCloudState("stuck");
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        loop.current();
      }
    }
  }, [store]);

  useEffect(() => {
    loop.current = () => void runSync();
  }, [runSync]);

  // Read after mount, like everything else that touches storage, so the
  // server render and the first client render agree about it.
  useEffect(() => {
    const has = readConnection() !== null;
    Promise.resolve().then(() => setConnected(has));
  }, [wiring]);

  /*
   * When it happens on its own: once the wall has loaded, whenever you come
   * back to the tab, and a few seconds after you stop changing things. Not on
   * every keystroke — every round is a commit, and a hundred commits for one
   * paragraph is a history nobody can read.
   */
  useEffect(() => {
    if (!ready || !readConnection()) return;
    // Off the render pass. A round starts by saying it is working, and saying
    // so synchronously inside an effect is a cascading render.
    const first = window.setTimeout(() => void runSync(), 0);
    const onShow = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onShow);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", onShow);
    };
  }, [ready, runSync, wiring]);

  useEffect(() => {
    if (!ready || !readConnection()) return;
    const id = window.setTimeout(() => void runSync(), 6000);
    return () => window.clearTimeout(id);
  }, [ready, runSync, wiring, notes, colors, settings]);

  const cloud = useMemo<Cloud>(
    () => ({
      state: connected ? cloudState : "off",
      at: cloudAt,
      trouble,
      now: () => void runSync(),
      reconnect: () => setWiring((n) => n + 1),
    }),
    [connected, cloudState, cloudAt, trouble, runSync],
  );

  // Every mutation writes to state first and reconciles after. The card shows
  // up the instant you hit save, before the store has answered.
  /*
   * Returns the note it made. Nearly every caller ignores it, but making a
   * room out of a handful of selected notes has to know where to put them,
   * and inventing a second code path for that would be worse than a promise
   * nobody awaits.
   */
  const addNote = useCallback(
    async (input: NewNote) => {
      const note = await store.createNote(input);
      setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
      return note;
    },
    [store],
  );

  const addNotes = useCallback(
    async (inputs: NewNote[]) => {
      const made = await store.createNotes(inputs);
      const ids = new Set(made.map((n) => n.id));
      setNotes((prev) => [...made, ...prev.filter((n) => !ids.has(n.id))]);
      return made;
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
   * one that carries an undo, and it captures the whole branch beneath it,
   * because deleting a container takes everything inside it.
   */
  const removeNote = useCallback(
    (id: string) => {
      setNotes((prev) => {
        // The whole branch, so undo puts back exactly what delete took, and
        // so the optimistic update does not leave grandchildren on screen
        // pointing at a parent that no longer exists.
        const branch = new Set(descendantsOf(prev, id).map((n) => n.id));
        branch.add(id);
        const doomed = prev.filter((n) => branch.has(n.id));
        if (doomed.length > 0) {
          const subject = doomed.find((n) => n.id === id);
          const extra = doomed.length - 1;
          setUndo({
            label:
              `Deleted ${seqLabel(subject?.seq ?? 0)}` +
              (extra > 0
                ? ` and the ${extra} thing${extra === 1 ? "" : "s"} inside it`
                : ""),
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
        return prev.filter((n) => !branch.has(n.id));
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

  /**
   * Stills are downscaled and re-encoded; video is stored as it arrived. Both
   * end up as one id on the note, so nothing downstream has to care which.
   */
  const attachImage = useCallback(
    async (file: File) => {
      const { meta, blob } = isVideoFile(file)
        ? await prepareVideo(file)
        : await prepareImage(file);
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
      colorOf: (note) =>
        note.colorId ? (byId.get(note.colorId) ?? null) : null,
      addNote,
      addNotes,
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
      cloud,
    };
  }, [
    store,
    ready,
    notes,
    colors,
    settings,
    addNote,
    addNotes,
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
    cloud,
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
