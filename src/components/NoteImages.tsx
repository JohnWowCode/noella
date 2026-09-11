"use client";

import { useEffect, useState } from "react";
import { useNoella } from "@/lib/store/provider";
import { formatDuration, isVideo } from "@/lib/images";
import { tooBigToSync } from "@/lib/sync/pictures";
import type { NoteImage } from "@/lib/types";

/**
 * Resolves an image id to a blob URL, once, after mount — and says which kind
 * of nothing it got when it fails.
 *
 * "Still loading" and "these bytes are not on this device" look identical
 * from here and mean completely different things to whoever is looking at the
 * card. Reporting both as an ellipsis is what made a picture that had not
 * synced indistinguishable from one that was about to appear, so the wall
 * just seemed to be permanently thinking.
 */
function useImageUrl(id: string): { url: string | null; missing: boolean } {
  const { imageUrl } = useNoella();
  // Stamped with the id it answers, rather than cleared when the id changes:
  // clearing means a setState in the effect body, which is a cascading render
  // on every mount. An answer about some other picture simply does not match.
  const [state, setState] = useState<{
    id: string;
    url: string | null;
    missing: boolean;
  } | null>(null);

  useEffect(() => {
    let live = true;
    imageUrl(id).then((next) => {
      if (live) setState({ id, url: next, missing: next === null });
    });
    return () => {
      live = false;
    };
  }, [id, imageUrl]);

  const mine = state?.id === id ? state : null;
  return { url: mine?.url ?? null, missing: mine?.missing ?? false };
}

/**
 * What to say in the space a picture has not filled.
 *
 * The frame is already the right size — the note carries the dimensions — so
 * the only question is what goes in it. A clip too large to have been sent is
 * a permanent answer and says so plainly; anything else missing is waiting on
 * a sync that has not reached this device yet, which is temporary and worth
 * saying, because "not synced yet" is a thing you can wait out and a blank
 * grey box is not.
 */
function Waiting({ image, missing }: { image: NoteImage; missing: boolean }) {
  if (!missing) return <>…</>;
  if (tooBigToSync(image)) return <>Too big to sync · on its own device</>;
  return <>Not synced yet</>;
}

export function NoteImages({
  images,
  onOpen,
}: {
  images: NoteImage[];
  onOpen: (index: number) => void;
}) {
  if (images.length === 0) return null;

  // One image gets its own aspect ratio; several are evened out into a grid so
  // the wall keeps a rhythm instead of lurching per note.
  const single = images.length === 1;

  return (
    <div
      className={`mt-4 grid gap-2 ${
        single ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
      }`}
    >
      {images.map((img, i) => (
        <Thumb
          key={img.id}
          image={img}
          single={single}
          onOpen={() => onOpen(i)}
        />
      ))}
    </div>
  );
}

function Thumb({
  image,
  single,
  onOpen,
}: {
  image: NoteImage;
  single: boolean;
  onOpen: () => void;
}) {
  const { url, missing } = useImageUrl(image.id);

  // A lone image sizes itself — width and height attributes reserve the right
  // space before the blob resolves, so nothing shifts — and only its height is
  // capped, so a tall reference can't swallow the wall. In a grid they are
  // squared off and cropped, because there the point is the set, not the frame.
  /*
   * A clip plays where it sits, with its own controls, and is deliberately not
   * a button: wrapping a video in a button means every attempt to scrub or
   * pause opens a lightbox instead.
   */
  if (isVideo(image)) {
    return (
      <div
        className={`border border-current/25 ${single ? "" : "aspect-square overflow-hidden"}`}
        style={
          single
            ? { aspectRatio: `${image.width} / ${image.height}` }
            : undefined
        }
      >
        {url ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <span className="label grid h-full w-full place-items-center px-2 text-center opacity-40">
            {missing ? (
              <Waiting image={image} missing />
            ) : (
              (image.duration && formatDuration(image.duration)) || "…"
            )}
          </span>
        )}
      </div>
    );
  }

  if (single) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full justify-center border border-current/25"
      >
        {url ? (
          // Blob URLs from IndexedDB; next/image cannot optimise these.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={image.alt ?? ""}
            width={image.width}
            height={image.height}
            className="h-auto max-h-[520px] w-auto max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <span
            className="label grid w-full place-items-center px-3 text-center opacity-40"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <Waiting image={image} missing={missing} />
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block aspect-square w-full overflow-hidden border border-current/25"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={image.alt ?? ""}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="label grid h-full w-full place-items-center px-2 text-center opacity-40">
          <Waiting image={image} missing={missing} />
        </span>
      )}
    </button>
  );
}

/** Flat full-bleed viewer. No blur, no scale animation, no chrome to speak of. */
export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: NoteImage[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const image = images[index];
  const { url, missing } = useImageUrl(image?.id ?? "");
  const video = image ? isVideo(image) : false;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft")
        onIndex((index - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onIndex, onClose]);

  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-50 flex flex-col bg-paper"
    >
      <div className="label flex items-center gap-3 border-b border-rule px-5 py-3">
        <span>
          Image {index + 1} of {images.length}
        </span>
        <span className="text-mute">
          {image.width}×{image.height}
        </span>
        {images.length > 1 && (
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() =>
                onIndex((index - 1 + images.length) % images.length)
              }
              className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => onIndex((index + 1) % images.length)}
              className="label border border-rule px-2 py-1 hover:bg-ink hover:text-paper"
            >
              Next →
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`label border border-rule px-2 py-1 hover:bg-ink hover:text-paper ${
            images.length > 1 ? "" : "ml-auto"
          }`}
        >
          Close · esc
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-5">
        {missing && (
          <span className="label text-mute">
            <Waiting image={image} missing />
          </span>
        )}
        {url &&
          (video ? (
            <video
              src={url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={image.alt ?? ""}
              className="max-h-full max-w-full object-contain"
            />
          ))}
      </div>
    </div>
  );
}
