# Noella

A wall of notes where **colour is the filing system**. Type the thing, optionally
tap a swatch, done. A colour is a world — "army world" is orange — so you can say
what a note *is* without writing a sentence about what it is.

```bash
npm install
npm run dev      # http://localhost:3000
```

Nothing to configure. No account, no server, no keys.

## Where the data lives

Right now: **your browser**. `LocalStore` (`src/lib/store/local.ts`) keeps notes
in localStorage under `noella.v1` and image bytes in IndexedDB
(`noella-images`) — a single phone photo would blow localStorage's ~5 MB cap.
The footer says where the data lives on every page.

Because that's one browser profile and nothing else, **Export writes a
self-contained JSON backup with the images inlined**, and Import restores it.
Use it. A cleared cache is otherwise the end of the wall.

That is deliberate, not a placeholder. The UI only ever talks to the `Store`
interface in `src/lib/store/types.ts`:

```ts
interface Store {
  readonly label: string;
  load(): Promise<Snapshot>;
  createNote(input: NewNote): Promise<Note>;
  updateNote(id: string, patch: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  updateColor(id: string, patch: Partial<Color>): Promise<Color>;
  imageUrl(id: string): Promise<string | null>;
  saveImage(id: string, blob: Blob): Promise<void>;
  export(): Promise<Backup>;
  import(backup: Backup): Promise<Snapshot>;
}
```

To move to Postgres, apply `supabase/migrations/0001_init.sql`, write a
`SupabaseStore` against the same interface, and swap the one line in
`src/lib/store/provider.tsx` that constructs `new LocalStore()`. No component
changes. The migration already carries `owner_id`, `visibility`, RLS, full-text
search, the `note_images` manifest and the public-read policy, so sharing later
is a feature flag rather than a schema rewrite.

## Using it

| Key | |
|---|---|
| `n` | jump to the compose box |
| `⌘/Ctrl + Enter` | save |
| `⌘/Ctrl + 1`–`9` | file into that world (`⌘0` clears) |
| `1`–`9` | pick a world and start typing |
| `/` | search |
| `Esc` | clear search and filters |
| `←` `→` `Esc` | in the image viewer |

There are twelve worlds and nine number keys, so worlds 10–12 are click-only.
Put the ones you reach for most in the first nine.

- The chosen colour is **sticky** between notes, so a run of notes in one world
  costs one keystroke each.
- Start a note with `[]` to make it a to-do. `[x]` starts it done. The marker is
  stripped; a to-do is just a note you can check off.
- `#hashtags` are parsed out of the body and cross-cut worlds — click one to
  filter. Colour is the spine, tags are the cross-cut.
- Tapping a swatch in the filter row **enters that world**: the app takes on its
  colour and everything else stays greyscale. Name the world from the band. The
  number under each swatch is how many notes live there.
- **Images**: paste, drag onto the compose box or an existing card, or use
  `+ Image`. Anything larger than 1600px on its long edge is downscaled and
  re-encoded to WebP on the way in — a 4 MB camera JPEG lands around 150 KB,
  which is what makes storing them locally viable. Click any image for a flat
  full-bleed viewer.
- **Archive** takes a note off the wall without deleting it. The `Archive n`
  button shows what's in there.
- The **tag index** under the filter row lists every tag by weight — the only
  place you can see the whole cross-cut at once.

## Projects

**A project is a note you promoted.** Jot the idea first; if it turns into
something you're actually doing, hit `Project` on its card. It keeps its
colour, its tags, its number, and stays searchable — it just gains a status and
somewhere to put steps.

- **Status** is `idea → active → paused → done`, set from the card or the
  projects screen. `active` is the one that shows up inverted, because it's the
  only one that makes a claim on your time.
- **Steps** are notes too, with the project as their parent. Type in the
  project's step box and hit Enter. They arrive checkable, render as a
  checklist on the card, and are hidden from the top level of the wall so they
  don't clutter it.
- Already jotted something that belongs to a project? `File` on its card moves
  it in.
- **`/projects`** lists everything grouped by status with a progress meter and
  **the next unfinished step** — that last part is the point. A project list
  without a next action is a graveyard.
- **Today** shows one next step per *active* project, tickable in place. If you
  only did those, every project you called active would move.
- Deleting a project deletes its steps, and says so first.

The wall's `Projects n` filter narrows to just projects. Nothing about this is
a separate system — search, colour, archive and export all work on projects and
steps exactly as they do on any other note.
- Drafts are written to localStorage on every keystroke. Closing the tab
  mid-thought loses nothing.

## Design rules

The interface is honest about being an interface. No fake paper, no fake depth,
no fake physics.

- **0px corners**, everywhere, enforced globally in `globals.css`.
- **1px hairline borders** do all the structural work.
- **No shadows** except one: a hard 4px zero-blur offset on the focused compose
  box, tinted to the selected world. No gradients anywhere.
- **Two type voices** — Geist Mono for all chrome (uppercase, 11px, letterspaced,
  via the `label` utility), **Literata** for note bodies (18px/1.62, via
  `prose-note`). A screen-first serif with enough ink to hold up on saturated
  cards and enough voice that your own writing reads as considered rather than
  logged. The contrast between the two is the design.
- **Paper by default** (`#F4F2ED` / `#111`); dark is a toggle. Flat colour reads
  louder on paper.
- **Colour is load-bearing and nowhere else.** Chrome is greyscale; only cards
  and swatches carry colour. All twelve swatches clear 4.5:1 against `#111`
  (the darkest, `#E85D5D`, sits at 6.2:1), so card contrast never flips.
- **The app states facts about itself** — `NOTE 0041 · PRIVATE · 14 WORDS ·
  2026-07-30 08:41`, a live row count in the footer, blunt empty states.
- **80ms linear, or nothing.** No easing curves, no springs.

## Layout

```
src/
  app/            layout (fonts, theme boot), / (Wall), /projects, /today
  fonts/          vendored Literata variable woff2 + OFL licence
  components/     Wall, Compose, NoteCard, NoteImages, Swatch,
                  TagIndex, DataMenu, Projects, ProjectPanel, Today, Chrome
  lib/
    notes.ts      hashtag + task-marker parsing, search matching
    projects.ts   status ladder, steps, progress, next action
    images.ts     downscale/encode + IndexedDB blob store
    format.ts     seq labels, absolute timestamps
    store/        Store interface, LocalStore, React provider
supabase/
  migrations/     Postgres schema, not yet applied
docs/PLAN.md      scope, phases, what is deliberately left out
```

Literata is licensed under the SIL Open Font License; the licence ships in
`src/fonts/`.

Built on Next.js 16 (App Router, Turbopack) + Tailwind v4.
