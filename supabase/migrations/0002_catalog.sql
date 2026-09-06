-- ============================================================================
-- Brokole ERP - 0002 catalog
-- Categories, menu items, nutrition, modifiers (the DIY Bowl Studio),
-- and per-outlet availability.
--
-- Nutrition lives in its own table on purpose: in phase 3 it is replaced by a
-- view derived from recipe_lines, and nothing else has to change.
-- ============================================================================

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create or replace trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references public.categories(id),
  slug          text not null unique,
  name          text not null,
  description   text,
  -- money: exact decimal, never float
  price         numeric(12,2) not null check (price >= 0),
  image_url     text,
  prep_time     text,
  tags          text[] not null default '{}',
  is_popular    boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  deleted_at    timestamptz
);
create index if not exists menu_items_category_idx on public.menu_items(category_id);
create index if not exists menu_items_active_idx   on public.menu_items(is_active) where deleted_at is null;
create or replace trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create or replace trigger menu_items_audit after insert or update or delete on public.menu_items
  for each row execute function public.audit_trigger();

create table if not exists public.menu_item_nutrition (
  menu_item_id uuid primary key references public.menu_items(id) on delete cascade,
  calories     numeric(8,2)  not null default 0,
  protein_g    numeric(8,2)  not null default 0,
  carbs_g      numeric(8,2)  not null default 0,
  fat_g        numeric(8,2)  not null default 0,
  fiber_g      numeric(8,2)  not null default 0,
  -- set true once the value is derived from recipe_lines rather than typed in
  is_derived   boolean not null default false,
  updated_at   timestamptz not null default now()
);
create or replace trigger menu_item_nutrition_updated_at before update on public.menu_item_nutrition
  for each row execute function public.set_updated_at();

-- per-outlet availability: an item can exist but be off today at one kitchen
create table if not exists public.outlet_menu_items (
  outlet_id    uuid not null references public.outlets(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  is_available boolean not null default true,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  primary key (outlet_id, menu_item_id)
);

-- ── modifiers: this is the DIY Bowl Studio ──────────────────────────────────
create table if not exists public.modifier_groups (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  min_select    integer not null default 0,
  max_select    integer not null default 1,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint modifier_group_select_range check (max_select >= min_select)
);
create or replace trigger modifier_groups_updated_at before update on public.modifier_groups
  for each row execute function public.set_updated_at();

create table if not exists public.modifiers (
  id                uuid primary key default gen_random_uuid(),
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  slug              text not null,
  name              text not null,
  price_delta       numeric(12,2) not null default 0,
  calories          numeric(8,2) not null default 0,
  protein_g         numeric(8,2) not null default 0,
  carbs_g           numeric(8,2) not null default 0,
  fat_g             numeric(8,2) not null default 0,
  sort_order        integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (modifier_group_id, slug)
);
create or replace trigger modifiers_updated_at before update on public.modifiers
  for each row execute function public.set_updated_at();

create table if not exists public.menu_item_modifier_groups (
  menu_item_id      uuid not null references public.menu_items(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  sort_order        integer not null default 0,
  primary key (menu_item_id, modifier_group_id)
);

-- ── convenience view for the storefront ─────────────────────────────────────
-- security_invoker is essential: without it a view runs with the OWNER's
-- rights and quietly bypasses the RLS of every table beneath it.
create or replace view public.menu_view with (security_invoker = true) as
  select
    mi.id, mi.slug, mi.name, mi.description, mi.price, mi.image_url,
    mi.prep_time, mi.tags, mi.is_popular, mi.sort_order,
    c.slug as category_slug, c.name as category_name,
    n.calories, n.protein_g, n.carbs_g, n.fat_g, n.fiber_g
  from public.menu_items mi
  left join public.categories c on c.id = mi.category_id
  left join public.menu_item_nutrition n on n.menu_item_id = mi.id
  where mi.is_active and mi.deleted_at is null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.categories                enable row level security;
alter table public.menu_items                enable row level security;
alter table public.menu_item_nutrition       enable row level security;
alter table public.outlet_menu_items         enable row level security;
alter table public.modifier_groups           enable row level security;
alter table public.modifiers                 enable row level security;
alter table public.menu_item_modifier_groups enable row level security;

-- Public read of the *live* menu only. Note the predicate: an inactive or
-- soft-deleted item is invisible to the storefront even if it guesses the id.
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active and deleted_at is null);

drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read on public.menu_items
  for select to anon, authenticated using (is_active and deleted_at is null);

drop policy if exists menu_items_staff_read on public.menu_items;
create policy menu_items_staff_read on public.menu_items
  for select to authenticated using (public.has_permission('menu.read'));

drop policy if exists nutrition_public_read on public.menu_item_nutrition;
create policy nutrition_public_read on public.menu_item_nutrition
  for select to anon, authenticated using (true);

drop policy if exists outlet_menu_items_public_read on public.outlet_menu_items;
create policy outlet_menu_items_public_read on public.outlet_menu_items
  for select to anon, authenticated using (true);

drop policy if exists modifier_groups_public_read on public.modifier_groups;
create policy modifier_groups_public_read on public.modifier_groups
  for select to anon, authenticated using (is_active);

drop policy if exists modifiers_public_read on public.modifiers;
create policy modifiers_public_read on public.modifiers
  for select to anon, authenticated using (is_active);

drop policy if exists mimg_public_read on public.menu_item_modifier_groups;
create policy mimg_public_read on public.menu_item_modifier_groups
  for select to anon, authenticated using (true);

-- Writes require menu.write. Customers hold no such permission, so the whole
-- admin surface is closed to them at the database, not in React.
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories
  for all to authenticated
  using (public.has_permission('menu.write'))
  with check (public.has_permission('menu.write'));

drop policy if exists menu_items_write on public.menu_items;
create policy menu_items_write on public.menu_items
  for all to authenticated
  using (public.has_permission('menu.write'))
  with check (public.has_permission('menu.write'));

drop policy if exists nutrition_write on public.menu_item_nutrition;
create policy nutrition_write on public.menu_item_nutrition
  for all to authenticated
  using (public.has_permission('menu.write'))
  with check (public.has_permission('menu.write'));

drop policy if exists outlet_menu_items_write on public.outlet_menu_items;
create policy outlet_menu_items_write on public.outlet_menu_items
  for all to authenticated
  using (public.has_permission('menu.write'))
  with check (public.has_permission('menu.write'));

drop policy if exists modifier_groups_write on public.modifier_groups;
create policy modifier_groups_write on public.modifier_groups
  for all to authenticated
  using (public.has_permission('menu.write'))
  with check (public.has_permission('menu.write'));

drop policy if exists modifiers_write on public.modifiers;
create policy modifiers_write on public.modifiers
  for all to authenticated
  using (public.has_permission('menu.write'))
  with check (public.has_permission('menu.write'));

drop policy if exists mimg_write on public.menu_item_modifier_groups;
create policy mimg_write on public.menu_item_modifier_groups
  for all to authenticated
  using (public.has_permission('menu.write'))
  with check (public.has_permission('menu.write'));

-- ── grants ──────────────────────────────────────────────────────────────────
grant select on public.categories                to anon, authenticated;
grant select on public.menu_items                to anon, authenticated;
grant select on public.menu_item_nutrition       to anon, authenticated;
grant select on public.outlet_menu_items         to anon, authenticated;
grant select on public.modifier_groups           to anon, authenticated;
grant select on public.modifiers                 to anon, authenticated;
grant select on public.menu_item_modifier_groups to anon, authenticated;
grant select on public.menu_view                 to anon, authenticated;

grant insert, update, delete on public.categories                to authenticated;
grant insert, update, delete on public.menu_items                to authenticated;
grant insert, update, delete on public.menu_item_nutrition       to authenticated;
grant insert, update, delete on public.outlet_menu_items         to authenticated;
grant insert, update, delete on public.modifier_groups           to authenticated;
grant insert, update, delete on public.modifiers                 to authenticated;
grant insert, update, delete on public.menu_item_modifier_groups to authenticated;
