# Noella

An instrument for **seeing whether you are moving**, for people with more
creative projects than hours.

The front door asks one question — *what moves today* — and answers it with a
single next step, the projects you have quietly stopped working on, and eight
weeks of evidence about whether any of this is working.

Behind it is a wall of notes where **colour is the filing system**. Type the
thing, optionally tap a swatch, done. A colour is a world — "army world" is
orange — so you can say what a note *is* without writing a sentence about what
it is. Ideas start there and graduate into projects.

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
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
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
search, the `note_images` manifest, the bill columns, a `settings` table and
the public-read policy, so sharing later is a feature flag rather than a schema
rewrite.

## Using it

| Key | |
|---|---|
| `n` | compose box on the wall, capture overlay anywhere else |
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
- Drafts are written to localStorage on every keystroke. Closing the tab
  mid-thought loses nothing.

## Today — the front door

- **The move.** The next unfinished step on your focused project, in the
  project's colour, at a size nothing else on the screen is allowed to match.
  One box to tick.
- **Also active.** The other things you called active, each with its next step,
  tickable in place. `Rank` takes you to the list that decides the order.
- **Drifting.** Any project quiet for 14+ days, with three answers: revive,
  park, drop. A project you called *active* but haven't touched in a fortnight
  is moved out of the active list and into here — that confrontation is the
  point. There is no dismiss, because leaving it unanswered is the only wrong
  answer.
- **The ledger.** Eight weeks of days, filled on days you finished something. A
  move is a completed step — never a captured note, because capture is easy and
  would make the number flattering and useless.
- **Unfiled.** A count of everything you jotted without giving it a world. It
  is the only nag on the screen, and it exists so dumping a thought is safe.
- **The stance:** three active projects. Not enforced — you're an adult — but
  never hidden either, because too many actives is the actual disease.

## Priorities

`/projects` is a ranked list, not a pile. Every project shows its position —
`01`, `02`, `03` — and moves with `↑` / `↓`.

**Position 01 among the active projects is today's move.** There is no separate
"focus" setting to drift out of sync with the order: re-ranking and choosing
what to work on are the same gesture. Reviving a drifting project puts it on
top, because that is what reviving means.

Steps inside a project rank the same way, so "what's next" is what you decided
was next rather than whatever you happened to type first.

## Jotting

Type it and go. No colour, no project, no title, no decision:

- `+ Note` on every screen, or `n` from anywhere but the wall.
- Anything you jot without picking a world lands in **Unfiled**, counted on the
  front door and filterable on the wall. Nothing dissolves into the feed.
- File it later: `Colour` on any card assigns or clears its world after the
  fact, and `Project` / `File` promote it or put it under something.

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

## Bills

Same pattern: **a bill is a note you promoted.** Hit `Bill` on a card, set an
amount, how often, and when. Rent lives on the wall with everything else.

- Cadence is `monthly` (a day of the month), `weekly`, `yearly` or `once`.
  Monthly on the 31st lands on the last day of shorter months rather than
  skipping them.
- **Nothing is expanded into rows.** A bill records the *periods* it has been
  settled for — `2026-07` — so next month resets itself and the store never
  accumulates twelve copies of rent a year.
- **`/money`** shows what you're committed to every month, what's still owed
  right now, and how many are late. Pay from the row.
- **Today** lists what wants money in the next seven days, plus anything late.
  Bills on **autopay** are excluded — they're money you're committed to, not a
  thing to do.
- Adding "rent, 3rd of the month" on the 30th does **not** announce that you're
  already late for this month. A bill can only have missed periods that fell
  due after you wrote it down.
- One currency per wall, set at the bottom of `/money`.

It is not a budgeting app: no categories (colour already does that), no charts,
no reconciliation, no bank connection.

## Capture from anywhere

- The **`+ Note`** button sits in the corner of every screen, and `n` opens it
  from anywhere except the wall, where `n` jumps to the compose box instead.
- Paste or drop an image straight into it.
- **Install it.** Noella ships a web app manifest and a service worker, so it
  goes on a phone home screen, opens without browser chrome, and works with no
  connection — the data was already local.
- Once installed it registers as a **share target**: share a link or some text
  from any app, pick Noella, and the capture box opens prefilled.

## Night mode

The theme button cycles `auto → light → dark`. **Auto** follows your system, so
a phone that switches to dark at sunset takes Noella with it, and a change to
the OS setting reaches an open tab live. The choice is remembered and applied
before first paint, so there's no flash.

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
  app/            layout (fonts, theme boot, PWA), / (Wall),
                  /projects, /money, /today
  fonts/          vendored Literata variable woff2 + OFL licence
  components/     Wall, Compose, QuickCapture, NoteCard, NoteImages,
                  Swatch, TagIndex, DataMenu, Projects, ProjectPanel,
                  Money, BillPanel, Today, Chrome
  lib/
    notes.ts      hashtag + task-marker parsing, search matching
    projects.ts   status ladder, steps, progress, next action
    money.ts      bill recurrence, periods, what is owed now
    clock.ts      today as a stable snapshot, local calendar days
    images.ts     downscale/encode + IndexedDB blob store
    format.ts     seq labels, absolute timestamps
    store/        Store interface, LocalStore, React provider
public/           manifest, service worker, icons
supabase/
  migrations/     Postgres schema, not yet applied
docs/PLAN.md      scope, phases, what is deliberately left out
```

Literata is licensed under the SIL Open Font License; the licence ships in
`src/fonts/`.

Built on Next.js 16 (App Router, Turbopack) + Tailwind v4.
