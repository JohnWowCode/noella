# Noella — Plan

A fast, color-organized wall of notes and ideas. Personal first, social later.

---

## Status

Everything except the AI phase is **built and working** on a local store.
See README.md to run it.

| Phase | State |
|---|---|
| 0 · Scaffold | done — Next 16, Tailwind v4, design tokens locked |
| 1 · Capture & Wall | done — compose, feed, inline edit, optimistic insert, drafts |
| 2 · Color | done — 8 worlds, swatch rows, enter-a-world, rename |
| 3 · Search & tags | done — live filter, `#tag` parsing, clickable tag chips |
| 4 · Tasks & Today | done — `[]` capture, checkboxes, Today screen |
| 5 · AI (OpenRouter) | not started |
| 6 · Polish & mobile | done — PWA, offline, share target, quick capture |

Added after the first pass, on request:

- **Twelve worlds** instead of eight. The original eight keep their positions so
  nothing already filed moves out from under its shortcut; the four additions
  (amber, orchid, cyan, green) fill the real gaps in the wheel. An existing wall
  gets them appended on load rather than being reset.
- **Images** — paste, drop or pick. Downscaled to 1600px and re-encoded to WebP
  on the way in, bytes in IndexedDB, metadata on the note, flat full-bleed
  viewer. Only the manifest is in localStorage.
- **Literata** for note bodies, replacing Geist Sans. Chosen by rendering it
  against Newsreader and Source Serif 4 on real cards — Newsreader read too
  thin on saturated colour, Source Serif had less voice.
- **Archive**, completing the `archived_at` field that had been carried unused.
- **Export / import** of the whole wall as one JSON file, images inlined. Not a
  nice-to-have while the only copy of the data is one browser profile.
- **Tag index** and per-swatch note counts, so both axes of the filing system
  are visible at rest rather than only when filtered.
- **Projects**, on request — a place to keep tabs on many ongoing things and
  work out how to execute them. A project is a note you promoted, and a step is
  a note whose `parentId` points at it, so the one-data-type rule survives: an
  idea becomes a project without being copied into a second system, and steps
  stay searchable, colourable, exportable notes. Status is
  `idea → active → paused → done`; `/projects` groups by status and surfaces the
  next unfinished step; Today lists one next step per active project. The tree
  is deliberately one level deep — a project cannot be a step, enforced by a
  check constraint in the schema.
- **Bills**, on request, following the same promote-a-note pattern. Recurrence
  is stored as the set of periods already settled rather than expanded into
  rows, so a monthly bill never accumulates twelve notes a year. `/money`
  answers two questions — what am I committed to monthly, and what is still
  owed now — and Today lists what wants money this week. A bill can only have
  missed periods that fell due after it was written down, so adding rent
  mid-month does not immediately claim you are late. Not a budgeting app:
  colour already does categories.
- **Night mode follows the system** by default. The toggle is now
  `auto → light → dark`, applied before first paint, and a change to the OS
  setting reaches an open tab live. It previously defaulted to light whatever
  the device was doing.
- **Capture from anywhere** — a `+ Note` button on every screen, `n` from any
  route, and a PWA manifest plus service worker so it installs to a phone,
  runs offline, and registers as a share target that opens prefilled.

## The rethink

The plan above named one thing that matters — *time from thought to saved* —
and it was the wrong one. Capture was never the bottleneck; capture is easy.
Notes apps die as **landfills**, and for someone running several creative
projects at once the scarce thing is not starting, it is **finishing**.

So the app's job changed:

> Noella is an instrument for seeing whether you are moving, and for making
> you choose what to move. The wall is where thinking goes. It is a bad thing
> to open every morning, because a feed of everything answers no question.

What follows from that:

- **The front door is `/`, not the wall.** One screen, one question: what moves
  today. The wall moved to `/wall` and became what a wall is actually good for
  — re-reading old thinking.
- **Projects are the spine, not a bolt-on.** Idea → project → shipped is the
  path through the app, and the front door shows exactly one next step.
- **The app has a stance: three active projects.** Not enforced, never hidden.
  Too many actives is the actual disease.
- **Drift is surfaced, and killing is a feature.** Anything quiet for 14 days
  is escalated with three answers — revive, park, drop. A project you say is
  active but have not touched in a fortnight is moved *out* of the active list
  and into that confrontation. Leaving it unanswered is the only wrong answer.
- **The ledger.** Eight weeks of days, filled when you finished something. A
  *move* is a completed step, never a captured note — capture is easy and would
  make the number flattering and useless.
- **Bills are subordinate.** One quiet strip on the front door. They earn a
  place because unpaid rent is a real interruption, not because money tracking
  is what this is for.

Honest limits: no app guarantees anything. What this one does is make two
things impossible to avoid — what you said you would do, and whether you did
it. Everything else on the screen is in service of that or should be cut.

**Two things changed during the build:**

1. **Search is a live filter on the Wall, not a fourth screen.** Two routes
   (`/` and `/today`) instead of four. Typing in the header input filters the
   wall as you type, which is both more minimal and fewer taps than a route
   change. The plan's four-screen split was the wrong call.
2. **The database is deferred.** A new Supabase project costs **$10/mo** on this
   org — the free tier assumed below does not apply, because the account is on a
   paid plan. So the app runs on `LocalStore` (browser localStorage) behind a
   `Store` interface, and `supabase/migrations/0001_init.sql` is written and
   waiting. Swapping to Postgres is one constructor line plus a `SupabaseStore`.

---

## The one thing that matters

Apps like this die for one reason: **filing friction**. Not missing features — the
moment capture requires a decision (which folder? what title? which project?), you
stop capturing, and a note app with no notes in it is dead.

So v1 is built around a single number: **time from thought to saved**. Target under
3 seconds, one optional tap. Everything else is negotiable.

## Color = world

A color isn't a highlight or a mood. **A color is a world.** "Army world" is orange.
Everything orange belongs to that world. Picking one is how you say what a note *is*
without writing a sentence about what it is.

That's why this works better than folders or tags as the primary axis:

- **It's one tap, pre-verbal.** No naming, no typing, no decision tree.
- **It's scannable.** You find a note by remembering its world, not its title.
- **It's flat.** No nesting. Nesting is where notes go to die.
- **The taxonomy emerges.** Colors start unnamed. Two weeks in you notice orange is
  always the army world, so you name it. You never design the system up front —
  you discover it from your own behavior.

Colors are nameable but never require a name. `{ hex, name?, emoji? }`.

**Filtering into a color = entering that world.** The whole app takes on that color's
identity — header block fills with it, everything else stays greyscale, the compose box
pre-selects it. You're inside the army world until you leave.

**Tags are the cross-cut, not the spine.** `#hashtags` parsed out of the body, zero UI
cost, and they're for the things that span worlds — `#character` across army world and
whatever else. Search-only. They never compete with color for attention.

## The feed metaphor

Reverse-chron wall of cards, compose box pinned at top. It makes the app feel alive
instead of like a filing cabinet, and it makes old ideas re-readable — which *is* the
mechanism behind getting inspired. You're the first user of your own timeline.

---

## Design direction: minimal / postmodern

Not decoration — a set of hard rules. The point is an interface that is **honest about
being an interface**. No fake paper, no fake depth, no fake physics. It shows its own
structure and it labels itself, slightly too literally. That's where the irony lives:
the tool narrates itself in flat machine language while you use it for your most
unstructured thoughts.

**Rules:**

- **Corners: 0px.** Everywhere. No exceptions.
- **Borders: 1px solid ink.** Hairlines do all the structural work.
- **Shadows: none.** One exception — a single hard 4px offset with zero blur on the
  focused compose box. Never a soft shadow, never a gradient.
- **Type: two voices.** Geist Mono for all chrome, labels, metadata, timestamps —
  uppercase, 11px, `letter-spacing: 0.08em`. Geist Sans for note bodies, large and
  generously leaded. The contrast between the two *is* the design. (Both ship free
  with Next.js — zero setup, zero font loading cost.)
- **Canvas: paper, not dark.** `#F4F2ED` with `#111` ink; dark mode is a toggle, not
  the default. Flat color blocks read louder against paper, and it's more Swiss-gone-
  wrong than dark-mode-SaaS.
- **Color is load-bearing and nowhere else.** Chrome is pure greyscale. The only color
  in the entire UI is the note cards and swatches. Cards are **flat full fills**, not
  tints — the card *is* the world's color.
- **Eight defaults, all of which take black type.** Chosen so contrast never flips.
  That constraint keeps the palette honest and the cards consistent.
- **The app states facts about itself.** Every note carries an index — `NOTE 0041 /
  PRIVATE / 14 WORDS / 2026-07-29 08:41`. The footer shows the live row count. Empty
  states are blunt declaratives, not encouragement. Nothing is cheerful at you.
- **Motion: 80ms linear, or none.** No easing curves, no spring physics, no fade-ins.
  State changes are instant because they actually are instant.

---

## What v1 deliberately does NOT have

- **Accounts for other people / sharing.** The *data model* gets `owner_id` and
  `visibility` now, so multiplayer later is a feature, not a rewrite. Zero UI.
- **A separate to-do system.** A to-do is just a note you can check off. One data type,
  not two. This single decision is what keeps this from bloating into three apps.
- **A rich text editor.** Plain textarea, markdown-lite (bold, lists, auto-linked URLs).
  TipTap/Slate is a two-week rabbit hole that buys nothing here.
- **Folders, notebooks, nested tags.** No.

---

## Stack

| Piece | Choice | Free? |
|---|---|---|
| App | Next.js 15 (App Router) + TypeScript + Tailwind | yes |
| Hosting | Vercel Hobby | yes (non-commercial) |
| DB + Auth | Supabase free tier (Postgres, Auth, RLS) | yes |
| Search | Postgres `tsvector` + GIN index | yes, no third party |
| AI | OpenRouter, server-side via a Next.js route | pay-per-token, free models exist |
| Mobile | PWA — installable, plus share target | yes |

Honest caveats: Supabase pauses a project after ~1 week of zero activity (irrelevant
if you use it daily); 500 MB DB and 5 GB egress, thousands of notes away from
mattering. Vercel Hobby forbids commercial use — fine until this is a product.

**Correction:** the "free" in the Supabase row above is wrong for this account. The
org is on a paid plan, so each additional project bills **$10/mo**. The options are
a dedicated project at that price, sharing an existing project's Postgres and auth,
or staying on the local store — which is where it sits today.

---

## Data model

**`notes`**
- `id` uuid pk · `seq` bigint (the displayed `NOTE 0041` index, per owner)
- `owner_id` uuid → `auth.users`
- `body` text — the whole note; first line renders as the title
- `color_id` uuid null → `colors`
- `tags` text[] — parsed from `#hashtags` on write, GIN indexed
- `is_task` bool default false · `done_at` · `due_at`
- `pinned` bool default false
- `visibility` text default `'private'` — `private | unlisted | public`
- `created_at` · `updated_at` · `archived_at`
- `search_vector` tsvector generated from `body`, GIN indexed

**`colors`** — `id`, `owner_id`, `hex`, `name` null, `emoji` null, `position`
Eight seeded per user, all unnamed.

**RLS:** `owner_id = auth.uid()` on every table. The `visibility = 'public'` read
policy gets written now and sits unused until v2.

**v2:** `follows`, `likes`, public profiles, `links` for `[[wikilinks]]`, Storage for
images, `pgvector` for semantic recall.

---

## Screens (four)

1. **Wall** — compose box pinned top, swatch row directly beneath it (always visible,
   one tap to assign, tap a swatch in the filter row to enter that world). Cards in
   reverse-chron, flat color fills. Infinite scroll.
2. **Compose / Edit** — same component in both roles. Debounced autosave, no save
   button to forget. Esc saves and closes.
3. **Search** — one input, results as you type, matches highlighted. Filter chips for
   color, `#tag`, is-task, has-due.
4. **Today** — the only get-my-life-together surface. Overdue, then due-today, then
   pinned, then one resurfaced old note. Read-only plus checkboxes.

## Interactions that make or break it

- `n` → focus compose · `Cmd/Ctrl+Enter` → save · `/` → search · `Cmd/Ctrl+K` → AI
- `1`–`9` while composing → assign that color
- Every keystroke writes a localStorage draft — nothing is ever lost
- Optimistic insert: the card appears the instant you hit save, before the round-trip
- PWA share target: share text from any app on your phone → it lands in Noella

---

## AI (OpenRouter)

Worth building, but it earns its place by being **invisible until invoked** — one
keystroke, no chat sidebar eating the screen. Key lives in a Vercel env var and is
called from a server route; it never touches the client. Model is configurable, and
OpenRouter's free tier models are enough to start.

Four things, in order of how much they're worth:

1. **Ask your notes.** "what were my ideas about the army world?" — retrieve with
   Postgres full-text search, stuff the top matches into context, answer with citations
   back to note cards. This is the one that changes the app. No embeddings needed under
   a few thousand notes; `pgvector` when it outgrows FTS.
2. **Suggest a color on capture.** You type, it proposes a swatch, one tap to accept
   or ignore. Directly serves "choose a category very easily" — the AI does the filing
   so you never have to.
3. **Riff.** Take a one-line idea, get three directions on it. The inspiration part of
   the original vision, aimed at your own material.
4. **Weekly synthesis.** Read the week, name the threads running through it. The
   get-my-life-together payoff, delivered as a note in the wall like anything else.

---

## Build order

**Phase 0 — Scaffold.** Next.js + Tailwind + Supabase + magic-link auth, deployed to
Vercel. Design tokens locked in. Done when you can log in and see an empty wall.

**Phase 1 — Capture & Wall.** `notes` + RLS, compose, feed, optimistic insert, edit,
archive. **Done when it's usable — and at that point start using it for real, ugly.**
Everything after is informed by that.

**Phase 2 — Color.** `colors` table, 8 defaults, swatch row, enter-a-world filtering,
rename/emoji.

**Phase 3 — Search & tags.** tsvector + GIN, instant search, `#tag` parsing, filters.

**Phase 4 — Tasks & Today.** `is_task` / `done_at` / `due_at`, checkboxes, Today screen.

**Phase 5 — AI.** OpenRouter route, Cmd+K, ask-your-notes first, then color suggestion,
riff, weekly synthesis. Lands here because it needs a real corpus to be worth anything.

**Phase 6 — Polish & mobile.** PWA manifest, share target, shortcuts, offline drafts,
pin, resurface.

**v2 — Social,** only if you still want it after a month inside v1.

The discipline: don't skip ahead. Phase 1 shipped and used tells you more than
phases 1–6 designed.
