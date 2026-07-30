# Noella — Plan

A fast, color-organized wall of notes and ideas. Personal first, social later.

---

## Status

Phases 0–4 are **built and working** on a local store. See README.md to run it.

| Phase | State |
|---|---|
| 0 · Scaffold | done — Next 16, Tailwind v4, design tokens locked |
| 1 · Capture & Wall | done — compose, feed, inline edit, optimistic insert, drafts |
| 2 · Color | done — 8 worlds, swatch rows, enter-a-world, rename |
| 3 · Search & tags | done — live filter, `#tag` parsing, clickable tag chips |
| 4 · Tasks & Today | done — `[]` capture, checkboxes, Today screen |
| 5 · AI (OpenRouter) | not started |
| 6 · Polish & mobile | not started — PWA manifest, share target, offline |

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
