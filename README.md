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

Right now: **your browser**. `LocalStore` (`src/lib/store/local.ts`) persists to
localStorage under `noella.v1`, and the footer says so on every page.

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
}
```

To move to Postgres, apply `supabase/migrations/0001_init.sql`, write a
`SupabaseStore` against the same interface, and swap the one line in
`src/lib/store/provider.tsx` that constructs `new LocalStore()`. No component
changes. The migration already carries `owner_id`, `visibility`, RLS, full-text
search and the public-read policy, so sharing later is a feature flag rather
than a schema rewrite.

## Using it

| Key | |
|---|---|
| `n` | jump to the compose box |
| `⌘/Ctrl + Enter` | save |
| `⌘/Ctrl + 1`–`8` | file into that world (`⌘0` clears) |
| `1`–`8` | pick a world and start typing |
| `/` | search |
| `Esc` | clear search and filters |

- The chosen colour is **sticky** between notes, so a run of notes in one world
  costs one keystroke each.
- Start a note with `[]` to make it a to-do. `[x]` starts it done. The marker is
  stripped; a to-do is just a note you can check off.
- `#hashtags` are parsed out of the body and cross-cut worlds — click one to
  filter. Colour is the spine, tags are the cross-cut.
- Tapping a swatch in the filter row **enters that world**: the app takes on its
  colour and everything else stays greyscale. Name the world from the band.
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
  via the `label` utility), Geist Sans for note bodies. The contrast is the design.
- **Paper by default** (`#F4F2ED` / `#111`); dark is a toggle. Flat colour reads
  louder on paper.
- **Colour is load-bearing and nowhere else.** Chrome is greyscale; only cards
  and swatches carry colour. All eight swatches clear 4.5:1 against `#111`, so
  card contrast never flips.
- **The app states facts about itself** — `NOTE 0041 · PRIVATE · 14 WORDS ·
  2026-07-30 08:41`, a live row count in the footer, blunt empty states.
- **80ms linear, or nothing.** No easing curves, no springs.

## Layout

```
src/
  app/            layout (fonts, theme boot), / (Wall), /today
  components/     Wall, Compose, NoteCard, Swatch, Today, Chrome
  lib/
    notes.ts      hashtag + task-marker parsing, search matching
    format.ts     seq labels, absolute timestamps
    store/        Store interface, LocalStore, React provider
supabase/
  migrations/     Postgres schema, not yet applied
docs/PLAN.md      scope, phases, what is deliberately left out
```

Built on Next.js 16 (App Router, Turbopack) + Tailwind v4.
