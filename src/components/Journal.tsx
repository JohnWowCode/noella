"use client";

import { useEffect, useMemo, useState } from "react";
import { fromKey } from "@/lib/clock";
import { isVideo, mediaFilesFrom } from "@/lib/images";
import { marksOf } from "@/lib/stickers";
import { useNoella } from "@/lib/store/provider";
import type { Note, NoteImage } from "@/lib/types";
import { Icon } from "./Icon";
import { Lightbox } from "./NoteImages";

/**
 * The journal.
 *
 * You tick something, the card goes grey, and by Friday you cannot name one
 * thing you did all week. This is the answer: the wall cut by day and shown
 * as pictures — everything you dropped in and everything you finished, newest
 * day first.
 *
 * Not a new kind of note. Drag a screenshot onto it and it becomes an ordinary
 * note — searchable, markable, filable — that also happens to be the day's
 * evidence.
 */
export function Journal({
  todayKey,
  onOpen,
}: {
  todayKey: string;
  onOpen?: (id: string) => void;
}) {
  const { notes, addNote, attachImage } = useNoella();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(0);
  const [viewing, setViewing] = useState<{
    images: NoteImage[];
    index: number;
  } | null>(null);

  /*
   * A day is a day where something happened: something was shot, or something
   * was finished. Days where neither happened are not drawn — an unbroken run
   * of empty headings is a record of failure, which is the opposite of this.
   */
  const days = useMemo(() => {
    const by = new Map<string, { shots: Note[]; finished: Note[] }>();
    const at = (key: string) => {
      let d = by.get(key);
      if (!d) by.set(key, (d = { shots: [], finished: [] }));
      return d;
    };
    for (const n of notes) {
      if (n.archivedAt !== null) continue;
      if (n.images.length > 0) at(n.createdAt.slice(0, 10)).shots.push(n);
      if (n.doneAt !== null) at(n.doneAt.slice(0, 10)).finished.push(n);
    }
    return [...by.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, d]) => ({ key, ...d }));
  }, [notes]);

  async function take(files: File[]) {
    const media = mediaFilesFrom({ files } as unknown as DataTransfer);
    if (media.length === 0) return;
    setBusy((n) => n + 1);
    const kept: NoteImage[] = [];
    for (const file of media) {
      try {
        kept.push(await attachImage(file));
      } catch {
        // Almost always an oversized clip. The rest of the drop still lands.
      }
    }
    setBusy((n) => n - 1);
    if (kept.length === 0) return;
    /*
     * One note per drop, not per file: dragging four screenshots of the same
     * bug in is one thing that happened, and four cards saying nothing would
     * be four cards to tidy up later.
     */
    addNote({ body: "", colorId: null, images: kept });
  }

  return (
    <>
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void take(Array.from(e.dataTransfer.files));
        }}
        className={`mt-4 border-2 border-dashed px-5 py-6 text-center ${
          dragging ? "border-ink bg-field" : "border-rule"
        }`}
      >
        <p className="prose-note text-[calc(16px*var(--type))] text-mute">
          {busy > 0
            ? "Bringing it in…"
            : dragging
              ? "Drop it."
              : "Drag a screenshot or a clip in here."}
        </p>
        <label className="label mt-3 inline-block cursor-pointer border border-rule px-3 py-2 hover:bg-ink hover:text-paper">
          Choose files
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void take(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
      </section>

      {days.length === 0 ? (
        <p className="prose-note mt-4 border border-rule bg-field px-6 py-12 text-center text-[calc(16px*var(--type))] text-mute">
          Nothing shot and nothing finished yet. Whatever you drop here, and
          whatever you tick off anywhere in the app, shows up as the day it
          happened.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {days.map((day) => (
            <section key={day.key}>
              <h3 className="title flex flex-wrap items-baseline gap-x-3">
                {dayName(day.key, todayKey)}
                <span className="label font-normal text-mute">
                  {[
                    day.shots.length > 0 &&
                      `${day.shots.length} ${day.shots.length === 1 ? "shot" : "shots"}`,
                    day.finished.length > 0 &&
                      `${day.finished.length} finished`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </h3>

              {day.shots.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {day.shots.flatMap((n) =>
                    n.images.map((img, i) => (
                      <Shot
                        key={img.id}
                        image={img}
                        note={n}
                        onOpen={() =>
                          setViewing({ images: n.images, index: i })
                        }
                      />
                    )),
                  )}
                </div>
              )}

              {day.finished.length > 0 && (
                <ul className="mt-3 flex flex-col border border-rule bg-field">
                  {day.finished.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-start gap-2.5 border-b border-rule-soft px-4 py-2 last:border-b-0"
                    >
                      <span className="mt-[5px] shrink-0 text-mute">
                        <Icon name="check" size={13} />
                      </span>
                      {marksOf(n)
                        .slice(0, 2)
                        .map((m) => (
                          <span key={m} className="mt-[4px] shrink-0 text-mute">
                            <Icon name={m} size={14} />
                          </span>
                        ))}
                      <button
                        type="button"
                        onClick={() => onOpen?.(n.id)}
                        className="prose-note min-w-0 flex-1 text-left text-[calc(16px*var(--type))] leading-snug"
                      >
                        {n.body.split("\n", 1)[0] || "a picture"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {viewing && (
        <Lightbox
          images={viewing.images}
          index={viewing.index}
          onIndex={(i) => setViewing((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

/** Today and yesterday by name; everything else by date. */
function dayName(key: string, todayKey: string): string {
  if (key === todayKey) return "Today";
  const d = fromKey(key);
  const today = todayKey ? fromKey(todayKey) : new Date();
  const gap = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (gap === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function Shot({
  image,
  note,
  onOpen,
}: {
  image: NoteImage;
  note: Note;
  onOpen: () => void;
}) {
  const { imageUrl } = useNoella();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    imageUrl(image.id).then((next) => {
      if (live) setUrl(next);
    });
    return () => {
      live = false;
    };
  }, [image.id, imageUrl]);

  const caption = note.body.split("\n", 1)[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      title={caption || undefined}
      className="group relative aspect-square overflow-hidden border border-rule bg-field"
    >
      {url ? (
        isVideo(image) ? (
          <video
            src={url}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={caption} className="h-full w-full object-cover" />
        )
      ) : null}
      {isVideo(image) && (
        <span className="absolute right-1.5 bottom-1.5 bg-ink/80 px-1 py-0.5 text-paper">
          <Icon name="play" size={11} />
        </span>
      )}
      {caption && (
        <span className="label absolute inset-x-0 bottom-0 truncate bg-ink/80 px-1.5 py-1 text-left text-paper opacity-0 group-hover:opacity-100">
          {caption}
        </span>
      )}
    </button>
  );
}
