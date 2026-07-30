-- Noella — initial schema.
--
-- NOT YET APPLIED. The app currently runs on LocalStore (browser localStorage).
-- This file is the Supabase half of the same data model, ready to apply once a
-- project exists. See docs/PLAN.md for why it is waiting.
--
-- Personal-first: every row is owned, and the social columns (visibility, the
-- public read policy) exist from day one so multiplayer is a feature flag
-- rather than a migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- colours ---
-- A colour is a world. Naming it is optional and always.

create table public.colors (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  hex        text not null check (hex ~* '^#[0-9a-f]{6}$'),
  name       text,
  emoji      text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index colors_owner_idx on public.colors (owner_id, position);

-- ------------------------------------------------------------------ notes ---
-- One data type. A to-do is just a note you can check off.

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  -- The displayed NOTE 0041 index. Per owner, assigned by trigger.
  seq         bigint not null,
  body        text not null,
  color_id    uuid references public.colors (id) on delete set null,
  -- Derived from body by trigger. Never written by the client.
  tags        text[] not null default '{}',
  is_task     boolean not null default false,
  done_at     timestamptz,
  due_at      timestamptz,
  -- A project is a note you promoted; non-null means this note is one.
  project_status text
              check (project_status in ('idea', 'active', 'paused', 'done')),
  -- Set on a step: the project note it belongs to. Deleting a project takes
  -- its steps with it, because a step alone means nothing.
  parent_id   uuid references public.notes (id) on delete cascade,
  pinned      boolean not null default false,
  visibility  text not null default 'private'
              check (visibility in ('private', 'unlisted', 'public')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  search_vector tsvector
    generated always as (to_tsvector('english', body)) stored,

  unique (owner_id, seq),
  -- A project cannot also be somebody's step; the tree stays one level deep.
  constraint notes_project_or_step
    check (project_status is null or parent_id is null)
);

create index notes_owner_created_idx on public.notes (owner_id, created_at desc);
create index notes_parent_idx on public.notes (parent_id, created_at)
  where parent_id is not null;
create index notes_project_idx on public.notes (owner_id, project_status)
  where project_status is not null;
create index notes_search_idx        on public.notes using gin (search_vector);
create index notes_tags_idx          on public.notes using gin (tags);
create index notes_color_idx         on public.notes (color_id);

-- ----------------------------------------------------------------- images ---
-- Bytes go to a Supabase Storage bucket; this table is the ordered manifest,
-- mirroring the NoteImage metadata the local store keeps in IndexedDB.

create table public.note_images (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  -- Path within the storage bucket, not a public URL.
  storage_key text not null,
  width      integer not null check (width > 0),
  height     integer not null check (height > 0),
  mime       text not null,
  bytes      integer not null check (bytes >= 0),
  alt        text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index note_images_note_idx on public.note_images (note_id, position);

-- --------------------------------------------------------------- triggers ---

-- Per-owner sequence. The advisory lock keeps two concurrent inserts from
-- claiming the same number.
create or replace function public.notes_assign_seq()
returns trigger
language plpgsql
as $$
begin
  if new.seq is null or new.seq = 0 then
    perform pg_advisory_xact_lock(hashtext(new.owner_id::text));
    select coalesce(max(seq), 0) + 1
      into new.seq
      from public.notes
     where owner_id = new.owner_id;
  end if;
  return new;
end;
$$;

create trigger notes_assign_seq
  before insert on public.notes
  for each row execute function public.notes_assign_seq();

-- Tags are lifted out of the body on write, so search never has to parse.
create or replace function public.notes_derive_tags()
returns trigger
language plpgsql
as $$
begin
  new.tags := coalesce(
    (
      select array_agg(distinct lower(m[1]))
        from regexp_matches(
               new.body, '#([[:alnum:]][[:alnum:]_-]*)', 'g'
             ) as m
    ),
    '{}'::text[]
  );
  return new;
end;
$$;

create trigger notes_derive_tags_insert
  before insert on public.notes
  for each row execute function public.notes_derive_tags();

create trigger notes_derive_tags_update
  before update of body on public.notes
  for each row execute function public.notes_derive_tags();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

-- Twelve unnamed worlds per new account. The taxonomy emerges from use.
create or replace function public.seed_default_colors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.colors (owner_id, hex, position)
  select new.id, swatch, ord - 1
    from unnest(array[
           '#F2E14C', '#A8C64F', '#5FC9A8', '#6FA8F0',
           '#A98BE0', '#E87FB4', '#E85D5D', '#F29441',
           '#F0B92E', '#CE8BE8', '#6FD8E8', '#7ED97E'
         ]) with ordinality as t(swatch, ord);
  return new;
end;
$$;

create trigger seed_default_colors_on_signup
  after insert on auth.users
  for each row execute function public.seed_default_colors();

-- -------------------------------------------------------------------- RLS ---

alter table public.notes       enable row level security;
alter table public.colors      enable row level security;
alter table public.note_images enable row level security;

create policy note_images_owner_all on public.note_images
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy notes_owner_all on public.notes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy colors_owner_all on public.colors
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Written now, unused until sharing ships. Costs nothing to carry.
create policy notes_public_read on public.notes
  for select
  using (visibility = 'public' and archived_at is null);
