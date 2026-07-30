"use client";

import { useEffect, useState } from "react";
import { useNoella } from "@/lib/store/provider";
import type { NoteImage } from "@/lib/types";

/** Resolves an image id to a blob URL, once, after mount. */
function useImageUrl(id: string): string | null {
  const { imageUrl } = useNoella();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    imageUrl(id).then((next) => {
      if (live) setUrl(next);
    });
    return () => {
      live = false;
    };
  }, [id, imageUrl]);

  return url;
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
        <Thumb key={img.id} image={img} single={single} onOpen={() => onOpen(i)} />
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
  const url = useImageUrl(image.id);

  // A lone image sizes itself — width and height attributes reserve the right
  // space before the blob resolves, so nothing shifts — and only its height is
  // capped, so a tall reference can't swallow the wall. In a grid they are
  // squared off and cropped, because there the point is the set, not the frame.
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
            className="label grid w-full place-items-center opacity-40"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            …
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
        <span className="label grid h-full w-full place-items-center opacity-40">
          …
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
  const url = useImageUrl(image?.id ?? "");

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
              onClick={() => onIndex((index - 1 + images.length) % images.length)}
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
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={image.alt ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}
