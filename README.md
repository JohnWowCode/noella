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

**To put it on your phone:** `npm run export` writes `./out` — the whole app as
a folder of files, hostable anywhere. A GitHub Pages workflow is already
committed, so turning Pages on in repository settings publishes it on every
push, no other account needed. See [DEPLOY.md](DEPLOY.md).

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
search, the `note_images` manifest, list cadence and amounts, a `settings`
table and the public-read policy, so sharing later is a feature flag rather than a schema
rewrite.

## Using it

| Key | |
|---|---|
| `⌘/Ctrl + K` | the palette: search, jump, or act, from any screen |
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
- **Deleting is undoable.** A delete offers itself back for eight seconds, and
  a deleted project brings its steps with it. Everything else — archive, status
  changes — was always reversible from the UI, so delete is the only thing that
  needed catching.

## The palette

`⌘K` from anywhere. It is why the screens can stay quiet — no screen needs a
visible control for every action.

- **Go** — Today, the wall, projects.
- **Do** — tick off today's move without navigating to it, export a backup.
- **Projects** — pick any project to make it today's, from any screen.
- **Notes** — search the whole wall; results carry their world's colour.

`↑` `↓` to move, `↵` to run, `esc` to close.

## Speed

Measured on a wall of 2,000 notes, before and after a pass:

| | before | after |
|---|---|---|
| load → first card | 3,417 ms | **464 ms** |
| search keystrokes → settled | 2,864 ms | **305 ms** |
| cards in the DOM | 2,000 | **40** |

The wall renders a page of 40 and extends as you reach the bottom, so the cost
is flat: 500 notes and 2,000 notes now behave identically. Cards are wildly
different heights — images, step checklists, list panels — so windowing them
would have been guesswork; paging is exact.

Persisting is coalesced too. Writing is a full re-serialise of every note, which
you could feel on every ticked box; writes now settle into the next frame or
two and are flushed before the page can be hidden or closed, so nothing is ever
owed to disk across a tab switch.

## Today — the front door

- **The move.** The next unfinished step on your focused project, in the
  project's colour, at a size nothing else on the screen is allowed to match.
  One box to tick.
- **Also active.** The other things you called active, each with its next step,
  tickable in place. `Rank` takes you to the list that decides the order.
- **Still want these?** Any project quiet for 14+ days, with four answers:
  revive, park, drop, or not now. A project you called *active* but haven't
  touched in a fortnight is moved out of the active list and into here, because
  the gap between what you said and what happened is worth seeing. It asks
  rather than accuses, and `Not now` defers it a week.
- **The ledger.** Eight weeks of days, filled on days you finished something,
  with moves this week, moves in eight weeks, and your best run. A move is a
  completed step — never a captured note, because capture is easy and would
  make the number flattering and useless. There is no streak that resets to
  zero.
- **Unfiled.** A count of everything you jotted without giving it a world. It
  is the only nag on the screen, and it exists so dumping a thought is safe.
- **The stance:** three active projects. Not enforced — you're an adult — but
  never hidden either, because too many actives is the actual disease.

## Designed against ADHD failure modes

The research is consistent that tools built for neurotypical brains fail here
for predictable reasons: they assume you will remember to open them, tolerate
setup, and keep going after a missed day. Several things in Noella follow from
that, and two of them are corrections to earlier versions of this app.

- **Nothing punishes a missed day.** There is no streak counter that resets to
  zero. The ledger shows moves this week, moves in eight weeks, and your *best
  run* — a record of what you are capable of, which a bad week cannot take
  away. A broken streak is a well-known reason people abandon a system
  outright, and with rejection sensitivity it lands harder than intended.
- **The quiet-projects list asks rather than accuses**, and it can be deferred.
  It used to have no dismiss, on the theory that leaving it unanswered was the
  only wrong answer. An undismissable list of your own failures is answered by
  closing the tab. "Not now" defers it a week.
- **One next step, at a size nothing else matches.** Long lists are
  overwhelming and vague tasks do not start; the front door shows exactly one
  thing and hides the rest.
- **`▶ Just start · 5 minutes`.** Task initiation is the hard part, and a
  five-minute commitment is cheap enough to say yes to. It is the only filled
  button on the card, because it is the only thing there that gets you moving.
  The clock keeps running across navigation and reload.
- **How long things actually take** is visible where the work is: minutes on
  each finished step, a total on the project, and your own guess-to-result
  ratio in the ledger.
- **Time is on screen rather than guessed at.** Estimate a step at 5/15/30/60
  minutes and a bar fills against that estimate while the clock runs — a number
  you have to read and compare is the thing that does not land. It says how far
  over you are rather than hiding it.
- **Your own multiplier.** Once a handful of steps have both a guess and a
  result, the ledger shows the ratio: `×1.9 actual vs your guess`. Estimates run
  short, reliably and by a lot, and being told to "add 50%" is advice for
  someone else. A number you produced is not.
- **`Too big? Start smaller`.** When a step will not start, the answer is not
  motivation, it is specificity. Name something smaller and it is inserted
  above, becoming the move immediately. The original step is untouched.
- **Capture takes no decisions.** No colour, project or title required —
  anything unfiled is counted rather than lost, so dumping a thought is safe.
- **Deleting is undoable** and the app is installable, so it is where you left
  it rather than somewhere you have to remember to go.

## Nothing is on screen until it means something

The one rule the interface is held to, because every other rule was losing to
the pile.

An empty wall was carrying forty-seven controls in the compose box alone —
four kind tabs, a sticker button, three ranks, thirty-six colour swatches, a
"no world", an attach and a save — before a word had been written. Below it sat
seven view chips, three ranks and four grouping buttons, most of them filtering
to nothing at all.

It is nine now, and none of them are gone. Colour, sticker and rank each
collapsed to one button that shows what is currently chosen and opens what it
holds when asked. The filter row waits for its own counts: no to-dos, no To do
chip; nothing archived, no Archive; nothing ranked, no ranks; fewer than eight
cards, no grouping control. A new wall shows a box and a prompt. A busy one
shows exactly the handles it has earned.

The card lost its serial number too. `NOTE 0007` is a real handle — the MCP
tools take it and it is still in the data and the tooltip — but it opened every
card with four characters of machine noise that had never once been read.

## Now, next, later

Three buckets, never a number. A 1–10 priority field is a decision you can
spend an afternoon on, which is exactly the trap — ranking feels like progress
and produces none. Nothing is required to have one, and most things never
will: a screen where every row shouts a priority has no priorities.

It is built to be read before it is read. The rank is a colour on the chip and
a stripe down the card's left edge, so a column of them scans down the margin
without a word being taken in. On a coloured card the chip flips to the card's
own ink and carries the rank as a small block instead — a red NOW on a red card
was red on red.

## Stickers

Any note takes one glyph, shown large. Reading forty card titles to find the
one about audio is work; spotting the speaker among forty shapes is not, and
that difference is most of why they exist. The set is curated rather than the
whole emoji keyboard, because two thousand choices is a browsing session and
forty is a decision — anything else can still be pasted in. Colour folders take
one too.

## Rapid fire

Enter saves and leaves the caret exactly where it was, so a run of ideas goes
down as fast as it can be typed. The kind, colour, sticker and rank all stay
set between one and the next, because a burst is usually a burst of the same
sort of thing.

Shift+Enter always makes a newline, and once a draft has one Enter stops
saving — otherwise the first paragraph break of a rant would post half of it.
⌘↵ always saves. The box itself starts at rant height and grows from there.

Under it, the last four things you fired off stay listed, so a burst has
something to show for itself instead of an emptying box.

## Grouping

The list can be cut into bands by folder, by kind, or by rank. Off is the
default, because a heading above every single row is its own kind of noise.

## Folders, all the way down

Anything can hold anything. A note is a folder the moment you put something in
it, so WowCool.World holds Cave Sniper holds Bugs holds a bug report with its
screenshots — and none of those had to be declared a special kind of thing
first.

This is the one structural rule the app had wrong for most of its life. The
model was a project holding steps, one level, enforced in the schema: *"a
project cannot also be somebody's step; the tree stays one level deep."* That
is fine for "buy milk" and useless for real work.

Every card carries **Open**, whether or not there is anything in it yet — an
empty folder you cannot get into is not a folder. A breadcrumb across the top
says where you are and gets you back to any level in one click, and search
ignores where you are standing entirely: it looks at the whole tree and every
result shows the path it came from.

Colours cut across the tree rather than mirroring it, which is the point of
having both. A bug can live in Cave Sniper and still turn up under red with
every other bug on the wall.

## Lists

`List` on any note turns it into one. A list is deliberately **less** than a
project: no status, no drift, no progress meter, and it never reaches Today.

That restraint is the point. Long lists overwhelm when they are presented as a
demand — the research is consistent that 3–5 items is the ceiling for a list
you are being asked to act on. So the front door stays one thing, and a list is
just somewhere to keep twenty things without any of them becoming a claim on
your day.

- Ticked items **sink to the bottom** rather than vanishing, so a list you are
  working through shows that you are working through it.
- `Copy as text` puts the whole thing on your clipboard as markdown
  checkboxes — the honest version of sharing, given there is no server. Real
  collaboration needs the Postgres backend that is written and waiting.
- `Lists n` on the wall narrows to just them.

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

## Lists, and the recurring kind

`List` on any note turns it into one. A list is deliberately **less** than a
project: no status, no drift, no progress meter, and it never reaches Today.
Long lists overwhelm when they are presented as a demand — the ceiling for a
list you are being asked to act on is about five items — so the front door
stays one thing and a list is just somewhere to keep twenty.

Give a list a **cadence** — weekly, monthly, yearly — and its items un-tick
when the period turns. That is all a bill is: a thing on a list that comes back
every month. Rent, the phone, a subscription, a weekly tidy — same mechanism,
no separate screen. **Bills used to be their own tab and their own kind of
note; they were folded into this and the tab was deleted.**

- Items take an **optional amount**, so a recurring list totals itself:
  `$1,504.49 every month`.
- A progress bar shows what is behind you, and a recurring list says when it
  resets.
- Nothing is stored to track the period. An item carries when it was ticked,
  and "done this period" is whether that moment falls in the period you are in
  — so the month turning over costs nothing.
- Ticked items **sink to the bottom** rather than vanishing.
- `Copy` puts the whole list on your clipboard as markdown checkboxes.
- Anything with something still outstanding turns up on Today under
  **Coming round again**.

## Claude and ChatGPT can read it

There is an MCP server in `mcp/`. Point Claude Code, Claude Desktop, claude.ai
or ChatGPT at it and you can ask "what's still open?", or say "put *scout the
underpass* on the film project", without opening the app.

It speaks two transports for one set of tools. Claude Code and Claude Desktop
launch it as a child process over stdio — nothing on the network, nothing to
authenticate. ChatGPT cannot do that, and neither can claude.ai in a browser or
on a phone; they reach out to a URL, so those use the HTTP server behind a
token and a tunnel.

It uses the subscriptions you already pay for. An MCP server provides tools to
a *client*; it needs no API key and costs nothing per call. That is the
difference between this and wiring the app up to OpenRouter or the Anthropic
API — those are metered, pay-as-you-go, and no chat subscription covers them.

Noella lives in a browser tab and an MCP server is a separate process, so the
two share a folder you pick once: the app writes the whole wall to
`noella.json`, the server queues changes into `inbox/`, and the app applies
them. One writer per path, so there is no merge algorithm and nothing to get
subtly wrong — the cost is that Claude's changes land when a tab is next open,
which every write tool says rather than pretending otherwise.

Connecting the folder needs a Chromium browser: the File System Access API is
the only way a page can hold onto a directory, and Firefox and Safari have no
equivalent. Reading works from any machine the server runs on; your phone would
need a real backend, which is what the parked Supabase schema is for.

`mcp/README.md` has the setup.

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

Two voices, deliberately. The chrome is flat machine language — `NOTE 0041`,
`14 WORDS`, `LOCAL · NO SERVER` — and stays that way; that is the joke and the
structure. But anything addressed to *you* is plain and warm, because a machine
voice telling you your wall is empty is funny once and cold every time after.

- **0px corners**, everywhere, enforced globally in `globals.css`.
- **1px hairline borders** do all the structural work.
- **Two rule weights**, because shadows are banned and border weight is
  therefore the only hierarchy left. `rule` is structural — the edge of a card,
  the line under the header. `rule-soft` is interior — dividers inside a list,
  which at full strength turn a step checklist into a buzzing grid.
- **No shadows** except two: a hard 4px zero-blur offset on the focused compose
  box, tinted to the selected world, and a 6px one under the command palette.
  No gradients anywhere.
- **Every control presses** one pixel on `:active`. Flat, no easing — the same
  physics as the rest of the app, which is to say none.
- **Dark is not the light palette inverted.** A raised surface a shade off the
  canvas is invisible at `#141414` on `#0b0b0b`, so the field is lifted until a
  card reads as a surface rather than an outline; and a full-strength `#ededed`
  hairline around every card glares, so the structural rule is pulled back off
  white.
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
  app/            layout (fonts, theme boot, PWA), / (everything),
                  /wall + /projects (redirects, for old bookmarks)
  fonts/          vendored Literata variable woff2 + OFL licence
  components/     Home, Compose, Jester, QuickCapture, NoteCard, NoteImages,
                  TagIndex, DataMenu, ProjectPanel, ListPanel, Timer,
                  Palette, Chrome
  lib/
    notes.ts      hashtag + task-marker parsing, search matching
    projects.ts   status ladder, steps, progress, next action
    pick.ts       the jester's hat: what is open, and how much it wants doing
    surface.ts    the ink a coloured card can actually be read in
    momentum.ts   ledger, streaks, drift, estimate calibration
    recurrence.ts list cadences, period keys, what is still open
    clock.ts      today as a stable snapshot, local calendar days
    images.ts     downscale/encode stills, keep video as-is, IndexedDB blobs
    format.ts     seq labels, absolute timestamps
    store/        Store interface, LocalStore, React provider, the 36 colours
public/           manifest, service worker, icons
supabase/
  migrations/     Postgres schema, not yet applied
docs/PLAN.md      scope, phases, what is deliberately left out
```

Literata is licensed under the SIL Open Font License; the licence ships in
`src/fonts/`.

Built on Next.js 16 (App Router, Turbopack) + Tailwind v4.
