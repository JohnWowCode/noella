# Noella — Plan

A fast, color-organized wall of notes and ideas. Personal first, social later.

---

## The one thing that matters

Apps like this die for one reason: **filing friction**. Not missing features — the
moment capture requires a decision (which folder? what title? which project?), you
stop capturing, and a note app with no notes in it is dead.

So v1 is built around a single number: **time from thought to saved**. Target under
3 seconds, zero required decisions. Everything else is negotiable.

## Why color-first is actually a good idea

Color as the primary organizing axis is underused and it's the real differentiator here:

- **It's pre-verbal.** Tapping a swatch doesn't require you to decide what the thing
  *is*. Naming a folder does — and that's exactly the moment people give up.
- **It's scannable.** You find a note by remembering its vibe, not its title.
- **It's flat.** No nesting. Nesting is where notes go to die.
- **The taxonomy emerges from use.** Colors start unnamed. After two weeks you notice
  yellow is always money stuff, so you name it "Money." You never have to design the
  system up front — you discover it.

That last point is the whole philosophy of the app. Bake it in.

## The feed metaphor is right

Reverse-chron wall of cards, compose box pinned at the top, infinite scroll. It makes
the app feel *alive* instead of like a filing cabinet, and it makes old ideas
re-readable — which is the actual mechanism behind "getting inspired by ideas."
You're the first user of your own timeline.

---

## What v1 deliberately does NOT have

- **Accounts for other people / sharing.** Build the *data model* for it now
  (`owner_id`, `visibility`) so it's free to turn on later. Build zero UI for it.
- **A separate to-do system.** A to-do is just a note you can check off. One data type,
  not two. This single decision is what keeps this from bloating into three apps
  glued together.
- **A rich text editor.** Plain textarea, markdown-lite (bold, lists, auto-linked URLs).
  TipTap/Slate is a two-week rabbit hole that buys nothing here.
- **AI anything.** Later, maybe. Not now.
- **Folders, notebooks, nested tags.** No.

---

## Stack

| Piece | Choice | Free? |
|---|---|---|
| App | Next.js 15 (App Router) + TypeScript + Tailwind | yes |
| Hosting | Vercel Hobby | yes (non-commercial) |
| DB + Auth | Supabase free tier (Postgres, Auth, RLS) | yes |
| Search | Postgres `tsvector` + GIN index | yes, no third party |
| Mobile | PWA — installable, plus Android share target | yes |

Honest caveats on free tier: Supabase pauses a project after ~1 week of zero activity
(irrelevant if you use it daily — one tap unpauses); 500 MB DB and 5 GB egress, which
is thousands of notes away from mattering for one person. Vercel Hobby forbids
commercial use — fine until this becomes a product, at which point it's $20/mo.

---

## Data model

**`notes`**
- `id` uuid pk
- `owner_id` uuid → `auth.users`
- `body` text — the whole note; first line renders as the title
- `color_id` uuid null → `colors`
- `tags` text[] — parsed from `#hashtags` in the body on write, GIN indexed
- `is_task` bool default false
- `done_at` timestamptz null
- `due_at` timestamptz null
- `pinned` bool default false
- `visibility` text default `'private'` — `private | unlisted | public`
- `created_at`, `updated_at`, `archived_at`
- `search_vector` tsvector generated from `body`, GIN indexed

**`colors`**
- `id`, `owner_id`, `hex`, `name` null, `emoji` null, `position` int

Eight defaults seeded per user, all unnamed. Naming is optional and always.

**RLS:** `owner_id = auth.uid()` on every table. Also write the
`visibility = 'public'` read policy now — it sits unused until v2 and costs nothing.

**v2 additions:** `follows`, `likes`, public profiles, `links` for `[[wikilinks]]`,
Supabase Storage for images.

---

## Screens (four, that's all)

1. **Wall** — the feed. Compose box pinned top. Color swatch row beneath it: tap to
   filter, tap again to clear. Cards in reverse-chron, each with a color tint or edge
   stripe. Infinite scroll.
2. **Compose / Edit** — the same component in both roles. Debounced autosave. Color
   picker is a row of swatches. Back/Esc saves; there is no save button to forget.
3. **Search** — one input, results as you type with matches highlighted. Filter chips
   for color, `#tag`, is-task, has-due.
4. **Today** — the only "get my life together" surface. Overdue tasks at top, then
   due-today, then pinned notes, then one resurfaced old note. Read-only plus checkboxes.

## Interactions that make or break it

- `n` anywhere → focus compose; `Cmd/Ctrl+Enter` → save; `/` → search
- `1`–`9` while composing → assign that color
- Every keystroke in compose writes a local draft to localStorage — nothing is ever lost
- Optimistic insert: the card appears in the feed the instant you hit save, before the
  network round-trip resolves
- PWA share target: share text from any app on your phone → it lands in Noella

## Look

Dark by default. The note cards are the only color in the UI — chrome is greyscale so
the colors actually carry meaning. Eight saturated-but-not-neon defaults. Big type,
generous line height, cards that feel like paper.

---

## Build order

**Phase 0 — Scaffold.** Next.js + Tailwind + Supabase project + magic-link auth,
deployed to Vercel. Done when you can log in and see an empty wall.

**Phase 1 — Capture & Wall.** `notes` table + RLS, compose box, feed, optimistic
insert, edit in place, archive/delete. **Done when the app is usable — and at that
point start using it for real, even though it's ugly.** Everything after this is
informed by that.

**Phase 2 — Color.** `colors` table, 8 seeded defaults, swatch picker, filter row,
rename/emoji.

**Phase 3 — Search & tags.** tsvector + GIN, instant search, `#tag` parsing, tag filters.

**Phase 4 — Tasks & Today.** `is_task` / `done_at` / `due_at`, checkboxes on cards,
the Today screen.

**Phase 5 — Polish & mobile.** PWA manifest, share target, keyboard shortcuts, offline
draft cache, pin, resurface-an-old-note.

**v2 — Social,** only if you still want it after living in v1 for a month: real signup,
public notes, profiles, follow, an inspiration feed, images.

The discipline: don't skip ahead. Phase 1 shipped and used beats phases 1–5 designed.
