-- ============================================================================
-- BROKOLE ERP - COMPLETE DATABASE SETUP
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- No CLI, no Docker, no linking required.
--
-- Safe to run more than once: every statement is idempotent, so if it stops
-- partway you can fix the cause and simply run the whole file again.
--
-- Contents:
--   1. foundation - roles, outlets, profiles, permissions, audit trail, RLS
--   2. catalog    - categories, menu items, nutrition, bowl modifiers
--   3. orders     - addresses, orders, place_order(), the status state machine
--   4. seed       - your 18 real meals and the DIY Bowl Studio options
--
-- When it finishes, the result grid at the bottom tells you what was created.
-- ============================================================================



-- ═══════════════════════════════════════════════════════════════════════
--  0001_foundation.sql
-- ═══════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Brokole ERP - 0001 foundation
-- Roles, outlets, profiles, permissions, audit trail, RLS helper functions.
--
-- Design rules enforced here (see claude/erp-architecture.md):
--   * outlet_id exists from day one, even with a single kitchen
--   * role is NEVER settable by a client - only by an owner, via a trigger guard
--   * every table gets RLS in the same migration that creates it
--   * nothing is hard-deleted; deleted_at + audit_log instead
-- ============================================================================

-- ── enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type public.app_role as enum (
    'customer',
    'kitchen_staff',
    'delivery_rider',
    'dietitian',
    'inventory_manager',
    'accountant',
    'store_manager',
    'owner'
  );
exception when duplicate_object then null; end $$;

-- ── shared trigger: updated_at ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── outlets ─────────────────────────────────────────────────────────────────
create table if not exists public.outlets (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  address         text,
  city            text,
  pincode         text,
  timezone        text not null default 'Asia/Kolkata',
  -- the kitchen day boundary: a day that runs 06:00 -> 05:59 next morning
  day_start       time not null default '06:00',
  gstin           text,
  fssai_license   text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create or replace trigger outlets_updated_at before update on public.outlets
  for each row execute function public.set_updated_at();

-- ── profiles (1-1 with auth.users) ──────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              public.app_role not null default 'customer',
  full_name         text,
  email             text,
  phone             text,
  avatar_url        text,
  default_outlet_id uuid references public.outlets(id),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists profiles_role_idx on public.profiles(role);
create or replace trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- staff <-> outlet assignment (customers are not listed here)
create table if not exists public.staff_outlets (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  outlet_id  uuid not null references public.outlets(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, outlet_id)
);

-- ── permissions (data, not hardcoded policy strings) ────────────────────────
create table if not exists public.permissions (
  key         text primary key,
  description text not null
);

create table if not exists public.role_permissions (
  role           public.app_role not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role, permission_key)
);

insert into public.permissions(key, description) values
  ('menu.read',            'View the full menu including inactive items'),
  ('menu.write',           'Create, edit and retire menu items'),
  ('orders.read.all',      'View all orders, not just your own'),
  ('orders.update.status', 'Advance or cancel an order'),
  ('inventory.read',       'View stock levels and movements'),
  ('inventory.write',      'Record stock movements, wastage and adjustments'),
  ('vendors.read',         'View vendors and purchase orders'),
  ('vendors.write',        'Raise purchase orders and receive goods'),
  ('customers.read',       'View customer profiles and contact details'),
  ('finance.read',         'View revenue, COGS and tax reports'),
  ('staff.manage',         'Invite staff and change roles'),
  ('audit.read',           'Read the audit trail')
on conflict (key) do nothing;

insert into public.role_permissions(role, permission_key) values
  ('kitchen_staff',     'menu.read'),
  ('kitchen_staff',     'orders.read.all'),
  ('kitchen_staff',     'orders.update.status'),
  ('kitchen_staff',     'inventory.read'),

  ('delivery_rider',    'orders.read.all'),
  ('delivery_rider',    'orders.update.status'),

  ('dietitian',         'menu.read'),
  ('dietitian',         'customers.read'),

  ('inventory_manager', 'menu.read'),
  ('inventory_manager', 'inventory.read'),
  ('inventory_manager', 'inventory.write'),
  ('inventory_manager', 'vendors.read'),
  ('inventory_manager', 'vendors.write'),

  ('accountant',        'orders.read.all'),
  ('accountant',        'finance.read'),
  ('accountant',        'vendors.read'),
  ('accountant',        'audit.read'),

  ('store_manager',     'menu.read'),
  ('store_manager',     'menu.write'),
  ('store_manager',     'orders.read.all'),
  ('store_manager',     'orders.update.status'),
  ('store_manager',     'inventory.read'),
  ('store_manager',     'inventory.write'),
  ('store_manager',     'vendors.read'),
  ('store_manager',     'vendors.write'),
  ('store_manager',     'customers.read'),
  ('store_manager',     'finance.read'),

  ('owner',             'menu.read'),
  ('owner',             'menu.write'),
  ('owner',             'orders.read.all'),
  ('owner',             'orders.update.status'),
  ('owner',             'inventory.read'),
  ('owner',             'inventory.write'),
  ('owner',             'vendors.read'),
  ('owner',             'vendors.write'),
  ('owner',             'customers.read'),
  ('owner',             'finance.read'),
  ('owner',             'staff.manage'),
  ('owner',             'audit.read')
on conflict do nothing;

-- ── auth helper functions ───────────────────────────────────────────────────
-- SECURITY DEFINER so they bypass RLS and cannot recurse when used inside a
-- policy on profiles itself. Reads the JWT claim first (no table hit per row),
-- falls back to the profiles table when the access-token hook isn't enabled.
create or replace function public.auth_role()
returns public.app_role
language plpgsql stable security definer set search_path = public
as $$
declare
  v_claim text;
  v_role  public.app_role;
begin
  if auth.uid() is null then
    return null;
  end if;

  begin
    v_claim := nullif(coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', ''), '');
    if v_claim is not null then
      return v_claim::public.app_role;
    end if;
  exception when others then
    v_claim := null;   -- malformed claim: fall through to the table
  end;

  select p.role into v_role
    from public.profiles p
   where p.id = auth.uid()
     and p.is_active
     and p.deleted_at is null;

  return v_role;
end $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.auth_role() is not null
                  and public.auth_role() <> 'customer', false)
$$;

create or replace function public.has_permission(p_key text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.role_permissions rp
     where rp.role = public.auth_role()
       and rp.permission_key = p_key
  )
$$;

-- ── audit trail ─────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,
  actor_role   public.app_role,
  table_name   text not null,
  record_id    text,
  action       text not null,
  before       jsonb,
  after        jsonb
);
create index if not exists audit_log_table_record_idx
  on public.audit_log(table_name, record_id, occurred_at desc);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_record_id text;
begin
  v_record_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
  insert into public.audit_log(actor_id, actor_role, table_name, record_id, action, before, after)
  values (
    auth.uid(),
    public.auth_role(),
    tg_table_name,
    v_record_id,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create or replace trigger outlets_audit after insert or update or delete on public.outlets
  for each row execute function public.audit_trigger();
create or replace trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();

-- ── new signups always land as customers ────────────────────────────────────
-- The client cannot choose its own role: this ignores anything in raw_user_meta_data
-- except display fields. Staff are created by an owner (see 0003 invite flow notes).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    'customer',
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── role escalation guard ───────────────────────────────────────────────────
-- Even if an UPDATE policy would allow the row, this trigger silently reverts
-- any role/is_active change unless the caller holds staff.manage.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- No change to a privileged column: nothing to police.
  if new.role is not distinct from old.role
     and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  -- auth.uid() is null only for server-side callers: the service_role key, the
  -- SQL editor, migrations and seeds. Those must be able to create the very
  -- first owner - otherwise the system can never be bootstrapped. Every request
  -- that arrives through PostgREST with an anon or user JWT has a uid, so this
  -- is not a hole a browser can reach: anon holds no grant on profiles at all.
  if auth.uid() is null then
    return new;
  end if;

  if not public.has_permission('staff.manage') then
    new.role      := old.role;
    new.is_active := old.is_active;
  end if;

  return new;
end $$;

create or replace trigger profiles_guard_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ── custom access token hook (enable in Dashboard > Auth > Hooks) ───────────
-- Puts app_role into the JWT so RLS reads a claim instead of hitting profiles.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_role   public.app_role;
  v_claims jsonb;
begin
  select p.role into v_role from public.profiles p
   where p.id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(
    v_claims,
    '{app_metadata}',
    coalesce(v_claims -> 'app_metadata', '{}'::jsonb)
      || jsonb_build_object('app_role', coalesce(v_role::text, 'customer'))
  );

  return jsonb_set(event, '{claims}', v_claims);
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant all on table public.profiles to supabase_auth_admin;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.outlets          enable row level security;
alter table public.profiles         enable row level security;
alter table public.staff_outlets    enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_log        enable row level security;

-- outlets: anyone may see an active outlet (the storefront needs it); staff manage
drop policy if exists outlets_public_read on public.outlets;
create policy outlets_public_read on public.outlets
  for select to anon, authenticated
  using (is_active and deleted_at is null);

drop policy if exists outlets_staff_write on public.outlets;
create policy outlets_staff_write on public.outlets
  for all to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- profiles: you see yourself; customers.read sees everyone
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles
  for select to authenticated
  using (public.has_permission('customers.read'));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());          -- role changes reverted by the guard trigger

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- staff_outlets: staff read their own assignments; owners manage
drop policy if exists staff_outlets_self_read on public.staff_outlets;
create policy staff_outlets_self_read on public.staff_outlets
  for select to authenticated
  using (profile_id = auth.uid() or public.has_permission('staff.manage'));

drop policy if exists staff_outlets_admin_write on public.staff_outlets;
create policy staff_outlets_admin_write on public.staff_outlets
  for all to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- permission catalogue: readable by staff, writable by nobody through the API
drop policy if exists permissions_staff_read on public.permissions;
create policy permissions_staff_read on public.permissions
  for select to authenticated using (public.is_staff());

drop policy if exists role_permissions_staff_read on public.role_permissions;
create policy role_permissions_staff_read on public.role_permissions
  for select to authenticated using (public.is_staff());

-- audit log: read-only, and only for those allowed. Writes happen through the
-- SECURITY DEFINER trigger, which bypasses RLS.
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
  for select to authenticated using (public.has_permission('audit.read'));

-- ── seed the first outlet ───────────────────────────────────────────────────
insert into public.outlets (code, name, city, timezone)
values ('BKL-BLR-01', 'Brokole Central Kitchen', 'Bengaluru', 'Asia/Kolkata')
on conflict (code) do nothing;

-- ── grants ──────────────────────────────────────────────────────────────────
-- RLS decides WHICH rows; grants decide whether the role may touch the table
-- at all. Both are required. Supabase applies default privileges, but stating
-- them here keeps the schema portable and reviewable.
grant usage on schema public to anon, authenticated;

grant select on public.outlets                        to anon, authenticated;
grant insert, update, delete on public.outlets        to authenticated;
grant select, insert, update, delete on public.profiles       to authenticated;
grant select, insert, update, delete on public.staff_outlets  to authenticated;
grant select on public.permissions                    to authenticated;
grant select on public.role_permissions               to authenticated;
grant select on public.audit_log                      to authenticated;

grant execute on function public.auth_role()            to anon, authenticated;
grant execute on function public.is_staff()             to anon, authenticated;
grant execute on function public.has_permission(text)   to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════
--  0002_catalog.sql
-- ═══════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════
--  0003_orders.sql
-- ═══════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Brokole ERP - 0003 orders
-- Addresses, orders, order lines, status history, and the two RPCs that carry
-- all the money logic.
--
-- The rule this migration exists to enforce: the client asks for an order,
-- it never states the price. place_order() reads price from menu_items.
-- ============================================================================

do $$ begin
  create type public.order_status as enum (
    'draft','placed','paid','accepted','in_kitchen','packed',
    'out_for_delivery','delivered','cancelled','refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_channel as enum ('web','app','phone','walk_in','subscription');
exception when duplicate_object then null; end $$;

-- ── addresses ───────────────────────────────────────────────────────────────
create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  label        text,
  line1        text not null,
  line2        text,
  landmark     text,
  city         text not null,
  pincode      text not null,
  latitude     numeric(10,7),
  longitude    numeric(10,7),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists addresses_profile_idx on public.addresses(profile_id);
create or replace trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- ── business date helper ────────────────────────────────────────────────────
-- A kitchen day that starts at 06:00 means an order placed at 01:30 belongs to
-- the previous business date. Reports never tie out without this.
create or replace function public.business_date_for(p_outlet_id uuid, p_at timestamptz)
returns date language sql stable security definer set search_path = public
as $$
  select ((p_at at time zone o.timezone) - (o.day_start - time '00:00'))::date
    from public.outlets o
   where o.id = p_outlet_id
$$;

-- ── orders ──────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text not null unique,
  outlet_id      uuid not null references public.outlets(id),
  customer_id    uuid not null references public.profiles(id),
  address_id     uuid references public.addresses(id),
  channel        public.order_channel not null default 'web',
  status         public.order_status  not null default 'draft',
  business_date  date not null,
  scheduled_for  timestamptz,
  notes          text,

  subtotal       numeric(12,2) not null default 0 check (subtotal     >= 0),
  discount       numeric(12,2) not null default 0 check (discount     >= 0),
  tax_amount     numeric(12,2) not null default 0 check (tax_amount   >= 0),
  delivery_fee   numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total          numeric(12,2) not null default 0 check (total        >= 0),

  -- denormalised roll-ups, handy for the kitchen board and macro reporting
  total_calories numeric(10,2) not null default 0,
  total_protein  numeric(10,2) not null default 0,

  placed_at      timestamptz,
  delivered_at   timestamptz,
  cancelled_at   timestamptz,
  cancel_reason  text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists orders_outlet_date_idx on public.orders(outlet_id, business_date desc);
create index if not exists orders_customer_idx    on public.orders(customer_id, created_at desc);
create index if not exists orders_status_idx      on public.orders(status) where deleted_at is null;
create or replace trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create or replace trigger orders_audit after insert or update or delete on public.orders
  for each row execute function public.audit_trigger();

create sequence if not exists public.order_no_seq start 1000;

create table if not exists public.order_lines (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  menu_item_id       uuid references public.menu_items(id),
  -- snapshots: the menu may change, the invoice may not
  name_snapshot      text not null,
  unit_price         numeric(12,2) not null check (unit_price >= 0),
  quantity           integer not null check (quantity > 0),
  line_total         numeric(12,2) not null check (line_total >= 0),
  calories_snapshot  numeric(8,2) not null default 0,
  protein_snapshot   numeric(8,2) not null default 0,
  notes              text,
  created_at         timestamptz not null default now()
);
create index if not exists order_lines_order_idx on public.order_lines(order_id);

create table if not exists public.order_line_modifiers (
  id             uuid primary key default gen_random_uuid(),
  order_line_id  uuid not null references public.order_lines(id) on delete cascade,
  modifier_id    uuid references public.modifiers(id),
  name_snapshot  text not null,
  price_delta    numeric(12,2) not null default 0
);

create table if not exists public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references public.profiles(id),
  note        text,
  changed_at  timestamptz not null default now()
);
create index if not exists osh_order_idx on public.order_status_history(order_id, changed_at);

-- ── place_order: the only way an order is created ───────────────────────────
-- p_lines shape: [{"menu_item_id":"<uuid>","quantity":2,"notes":"no onion"}]
create or replace function public.place_order(
  p_outlet_id    uuid,
  p_lines        jsonb,
  p_address_id   uuid default null,
  p_scheduled_for timestamptz default null,
  p_notes        text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_order_id  uuid;
  v_line      jsonb;
  v_item      record;
  v_qty       integer;
  v_line_id   uuid;
  v_subtotal  numeric(12,2) := 0;
  v_calories  numeric(10,2) := 0;
  v_protein   numeric(10,2) := 0;
  v_tax       numeric(12,2);
  v_delivery  numeric(12,2);
  v_tax_rate  numeric(5,4) := 0.05;    -- GST on restaurant food supply, no ITC
  v_free_delivery_over numeric(12,2) := 499;
  v_delivery_fee_flat  numeric(12,2) := 29;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'order must contain at least one line';
  end if;

  if p_address_id is not null and not exists (
       select 1 from public.addresses a
        where a.id = p_address_id and a.profile_id = v_user and a.deleted_at is null) then
    raise exception 'address does not belong to this customer' using errcode = '42501';
  end if;

  insert into public.orders (
    order_no, outlet_id, customer_id, address_id, status,
    business_date, scheduled_for, notes, placed_at
  ) values (
    'BKL-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || nextval('public.order_no_seq'),
    p_outlet_id, v_user, p_address_id, 'placed',
    public.business_date_for(p_outlet_id, now()), p_scheduled_for, p_notes, now()
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := greatest(1, coalesce((v_line ->> 'quantity')::integer, 1));

    -- price and macros come from the database, never from the request body
    select mi.id, mi.name, mi.price,
           coalesce(n.calories, 0)  as calories,
           coalesce(n.protein_g, 0) as protein_g
      into v_item
      from public.menu_items mi
      left join public.menu_item_nutrition n on n.menu_item_id = mi.id
     where mi.id = (v_line ->> 'menu_item_id')::uuid
       and mi.is_active
       and mi.deleted_at is null;

    if not found then
      raise exception 'menu item % is unavailable', v_line ->> 'menu_item_id';
    end if;

    insert into public.order_lines (
      order_id, menu_item_id, name_snapshot, unit_price, quantity, line_total,
      calories_snapshot, protein_snapshot, notes
    ) values (
      v_order_id, v_item.id, v_item.name, v_item.price, v_qty, v_item.price * v_qty,
      v_item.calories, v_item.protein_g, nullif(v_line ->> 'notes', '')
    ) returning id into v_line_id;

    v_subtotal := v_subtotal + (v_item.price * v_qty);
    v_calories := v_calories + (v_item.calories  * v_qty);
    v_protein  := v_protein  + (v_item.protein_g * v_qty);
  end loop;

  v_delivery := case when v_subtotal >= v_free_delivery_over then 0 else v_delivery_fee_flat end;
  v_tax      := round(v_subtotal * v_tax_rate, 2);

  update public.orders
     set subtotal       = v_subtotal,
         tax_amount     = v_tax,
         delivery_fee   = v_delivery,
         total          = v_subtotal + v_tax + v_delivery,
         total_calories = v_calories,
         total_protein  = v_protein
   where id = v_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order_id, 'draft', 'placed', v_user);

  return v_order_id;
end $$;

revoke all on function public.place_order(uuid, jsonb, uuid, timestamptz, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, uuid, timestamptz, text) to authenticated;

-- ── update_order_status: the state machine lives here, not in React ─────────
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_current public.order_status;
  v_allowed public.order_status[];
begin
  if not public.has_permission('orders.update.status') then
    raise exception 'insufficient permission' using errcode = '42501';
  end if;

  select status into v_current from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;

  v_allowed := case v_current
    when 'draft'            then array['placed','cancelled']::public.order_status[]
    when 'placed'           then array['paid','accepted','cancelled']::public.order_status[]
    when 'paid'             then array['accepted','cancelled','refunded']::public.order_status[]
    when 'accepted'         then array['in_kitchen','cancelled']::public.order_status[]
    when 'in_kitchen'       then array['packed','cancelled']::public.order_status[]
    when 'packed'           then array['out_for_delivery','cancelled']::public.order_status[]
    when 'out_for_delivery' then array['delivered','cancelled']::public.order_status[]
    when 'delivered'        then array['refunded']::public.order_status[]
    else array[]::public.order_status[]
  end;

  if not (p_status = any(v_allowed)) then
    raise exception 'illegal transition % -> %', v_current, p_status;
  end if;

  update public.orders
     set status       = p_status,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancel_reason= case when p_status = 'cancelled' then p_note else cancel_reason end
   where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_current, p_status, auth.uid(), p_note);
end $$;

revoke all on function public.update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;

-- ── invite_staff: the only way a non-customer role is ever created ──────────
create or replace function public.set_staff_role(p_profile_id uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission('staff.manage') then
    raise exception 'insufficient permission' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'you cannot change your own role';
  end if;
  update public.profiles set role = p_role where id = p_profile_id;
end $$;

revoke all on function public.set_staff_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_staff_role(uuid, public.app_role) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.addresses             enable row level security;
alter table public.orders                enable row level security;
alter table public.order_lines           enable row level security;
alter table public.order_line_modifiers  enable row level security;
alter table public.order_status_history  enable row level security;

drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists addresses_staff_read on public.addresses;
create policy addresses_staff_read on public.addresses
  for select to authenticated using (public.has_permission('orders.read.all'));

-- A customer sees their own orders. Full stop. No client code required.
drop policy if exists orders_own_read on public.orders;
create policy orders_own_read on public.orders
  for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists orders_staff_read on public.orders;
create policy orders_staff_read on public.orders
  for select to authenticated
  using (public.has_permission('orders.read.all'));

-- Deliberately NO insert/update policy for customers: orders are created only
-- through place_order(), and advanced only through update_order_status().
drop policy if exists orders_manager_write on public.orders;
create policy orders_manager_write on public.orders
  for update to authenticated
  using (public.has_permission('orders.update.status'))
  with check (public.has_permission('orders.update.status'));

drop policy if exists order_lines_read on public.order_lines;
create policy order_lines_read on public.order_lines
  for select to authenticated
  using (
    exists (select 1 from public.orders o
             where o.id = order_lines.order_id
               and (o.customer_id = auth.uid() or public.has_permission('orders.read.all')))
  );

drop policy if exists order_line_modifiers_read on public.order_line_modifiers;
create policy order_line_modifiers_read on public.order_line_modifiers
  for select to authenticated
  using (
    exists (select 1 from public.order_lines ol
             join public.orders o on o.id = ol.order_id
            where ol.id = order_line_modifiers.order_line_id
              and (o.customer_id = auth.uid() or public.has_permission('orders.read.all')))
  );

drop policy if exists osh_read on public.order_status_history;
create policy osh_read on public.order_status_history
  for select to authenticated
  using (
    exists (select 1 from public.orders o
             where o.id = order_status_history.order_id
               and (o.customer_id = auth.uid() or public.has_permission('orders.read.all')))
  );

-- ── grants ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.addresses to authenticated;

-- deliberately narrow: a customer may READ orders, never write them. Creation
-- happens only inside place_order(), which is SECURITY DEFINER.
grant select on public.orders               to authenticated;
grant update on public.orders               to authenticated;   -- gated by RLS to orders.update.status
grant select on public.order_lines          to authenticated;
grant select on public.order_line_modifiers to authenticated;
grant select on public.order_status_history to authenticated;
grant usage  on sequence public.order_no_seq to authenticated;

grant execute on function public.business_date_for(uuid, timestamptz) to authenticated;

-- realtime for the kitchen board (idempotent: re-running must not error)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════
--  seed.sql
-- ═══════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Brokole ERP - seed
-- The 18 meals currently live on the storefront, with their real prices and
-- macros. Idempotent: safe to run repeatedly.
-- ============================================================================

insert into public.categories (slug, name, sort_order) values
  ('grain-protein-bowls', 'Grain & Protein Bowls', 10),
  ('wraps',               'Wraps',                 20),
  ('salads-bowls',        'Salads & Bowls',        30),
  ('smoothies-juices',    'Smoothies & Juices',    40),
  ('breakfast',           'Breakfast',             50),
  ('snacks-sides',        'Snacks & Sides',        60)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

with data(slug, name, category_slug, price, kcal, protein, carbs, fat, fiber, popular, sort_order) as (
  values
    -- Grain & Protein Bowls
    ('quinoa-paneer-bowl',            'Quinoa Paneer Bowl',                    'grain-protein-bowls', 160.00, 460, 32, 45, 15, 8, true,  10),
    ('grilled-chicken-brown-rice',    'Grilled Chicken & Brown Rice',          'grain-protein-bowls', 180.00, 520, 38, 45, 12, 6, true,  20),
    ('paneer-tikka-millet-bowl',      'Paneer Tikka Millet Bowl',              'grain-protein-bowls', 165.00, 480, 26, 48, 16, 7, false, 30),
    ('sprouts-peanut-bowl',           'Sprouts & Peanut Bowl',                 'grain-protein-bowls', 155.00, 380, 18, 36, 14, 9, false, 40),
    ('mediterranean-chicken-hummus',  'Mediterranean Chicken & Hummus Bowl',   'grain-protein-bowls', 160.00, 450, 36, 42, 14, 7, true,  50),
    -- Breakfast
    ('protein-oats-honey-pancakes',   'Protein Oats & Honey Pancakes',         'breakfast',           149.00, 410, 28, 46, 10, 5, true,  10),
    -- Wraps
    ('hummus-veg-wrap',               'Hummus & Veg Wrap',                     'wraps',               150.00, 360, 12, 44, 14, 6, false, 10),
    ('grilled-chicken-wrap',          'Grilled Chicken Wrap',                  'wraps',               175.00, 450, 32, 36, 12, 4, true,  20),
    ('egg-white-avocado-wrap',        'Egg White & Avocado Wrap',              'wraps',               160.00, 390, 22, 32, 16, 5, false, 30),
    ('paneer-tikka-wrap',             'Paneer Tikka Wrap',                     'wraps',               170.00, 430, 20, 38, 18, 5, false, 40),
    -- Smoothies & Juices
    ('green-detox',                   'Green Detox',                           'smoothies-juices',    110.00, 170,  4, 34,  2, 4, false, 10),
    ('berry-protein-smoothie',        'Berry Protein Smoothie',                'smoothies-juices',    125.00, 290, 26, 28,  6, 5, true,  20),
    ('peanut-butter-banana-smoothie', 'Peanut Butter Banana Smoothie',         'smoothies-juices',    120.00, 350, 18, 42, 14, 4, false, 30),
    ('cold-pressed-abc-juice',        'Cold-Pressed ABC Juice',                'smoothies-juices',    105.00, 140,  2, 30,  1, 2, false, 40),
    -- Salads & Bowls
    ('mediterranean-chicken-salad',   'Mediterranean Chicken Salad',           'salads-bowls',        155.00, 340, 34, 18, 14, 6, false, 10),
    ('grilled-chicken-caesar-lite',   'Grilled Chicken Caesar (Lite)',         'salads-bowls',        180.00, 390, 36, 16, 14, 5, true,  20),
    ('sprout-feta-salad',             'Sprout & Feta Salad',                   'salads-bowls',        160.00, 320, 16, 28, 14, 7, false, 30),
    -- Snacks & Sides
    ('fresh-mix-cut-fruit-bowl',      'Fresh Mix Cut Fruit Bowl',              'snacks-sides',         85.00, 120,  3, 28, 0.5, 3, false, 10)
)
insert into public.menu_items (slug, name, category_id, price, is_popular, sort_order, is_active)
select d.slug, d.name, c.id, d.price, d.popular, d.sort_order, true
  from data d join public.categories c on c.slug = d.category_slug
on conflict (slug) do update
  set name        = excluded.name,
      category_id = excluded.category_id,
      price       = excluded.price,
      is_popular  = excluded.is_popular,
      sort_order  = excluded.sort_order;

with data(slug, kcal, protein, carbs, fat, fiber) as (
  values
    ('quinoa-paneer-bowl',            460, 32, 45, 15,   8),
    ('grilled-chicken-brown-rice',    520, 38, 45, 12,   6),
    ('paneer-tikka-millet-bowl',      480, 26, 48, 16,   7),
    ('sprouts-peanut-bowl',           380, 18, 36, 14,   9),
    ('mediterranean-chicken-hummus',  450, 36, 42, 14,   7),
    ('protein-oats-honey-pancakes',   410, 28, 46, 10,   5),
    ('hummus-veg-wrap',               360, 12, 44, 14,   6),
    ('grilled-chicken-wrap',          450, 32, 36, 12,   4),
    ('egg-white-avocado-wrap',        390, 22, 32, 16,   5),
    ('paneer-tikka-wrap',             430, 20, 38, 18,   5),
    ('green-detox',                   170,  4, 34,  2,   4),
    ('berry-protein-smoothie',        290, 26, 28,  6,   5),
    ('peanut-butter-banana-smoothie', 350, 18, 42, 14,   4),
    ('cold-pressed-abc-juice',        140,  2, 30,  1,   2),
    ('mediterranean-chicken-salad',   340, 34, 18, 14,   6),
    ('grilled-chicken-caesar-lite',   390, 36, 16, 14,   5),
    ('sprout-feta-salad',             320, 16, 28, 14,   7),
    ('fresh-mix-cut-fruit-bowl',      120,  3, 28,  0.5, 3)
)
insert into public.menu_item_nutrition (menu_item_id, calories, protein_g, carbs_g, fat_g, fiber_g, is_derived)
select mi.id, d.kcal, d.protein, d.carbs, d.fat, d.fiber, false
  from data d join public.menu_items mi on mi.slug = d.slug
on conflict (menu_item_id) do update
  set calories = excluded.calories, protein_g = excluded.protein_g,
      carbs_g  = excluded.carbs_g,  fat_g     = excluded.fat_g,
      fiber_g  = excluded.fiber_g;

-- make everything available at the first outlet
insert into public.outlet_menu_items (outlet_id, menu_item_id, is_available)
select o.id, mi.id, true
  from public.outlets o cross join public.menu_items mi
 where o.code = 'BKL-BLR-01'
on conflict do nothing;

-- ── DIY Bowl Studio modifier groups ─────────────────────────────────────────
insert into public.modifier_groups (slug, name, min_select, max_select, sort_order) values
  ('bowl-base',     'Choose your base',    1, 1, 10),
  ('bowl-protein',  'Choose your protein', 1, 1, 20),
  ('bowl-veggies',  'Pick 4 veggies',      1, 4, 30),
  ('bowl-dressing', 'House dressing',      1, 1, 40)
on conflict (slug) do update set name = excluded.name;

with data(group_slug, slug, name, price_delta, kcal, protein, carbs, fat, sort_order) as (
  values
    ('bowl-base',     'quinoa',        'Quinoa',            20.00, 160,  6, 28,  3, 10),
    ('bowl-base',     'brown-rice',    'Brown Rice',         0.00, 150,  4, 32,  1, 20),
    ('bowl-base',     'millet',        'Millet',            10.00, 145,  5, 30,  1, 30),
    ('bowl-base',     'greens',        'Mixed Greens',       0.00,  25,  2,  4,  0, 40),
    ('bowl-protein',  'chicken',       'Grilled Chicken',   60.00, 165, 31,  0,  4, 10),
    ('bowl-protein',  'salmon',        'Teriyaki Salmon',  120.00, 208, 22,  3, 12, 20),
    ('bowl-protein',  'paneer',        'Paneer',            50.00, 265, 18,  6, 20, 30),
    ('bowl-protein',  'tofu',          'Tofu',              40.00, 144, 15,  3,  9, 40),
    ('bowl-veggies',  'broccoli',      'Broccoli',           0.00,  34,  3,  7,  0, 10),
    ('bowl-veggies',  'bell-pepper',   'Bell Pepper',        0.00,  26,  1,  6,  0, 20),
    ('bowl-veggies',  'cherry-tomato', 'Cherry Tomato',      0.00,  18,  1,  4,  0, 30),
    ('bowl-veggies',  'cucumber',      'Cucumber',           0.00,  16,  1,  4,  0, 40),
    ('bowl-veggies',  'red-onion',     'Red Onion',          0.00,  40,  1,  9,  0, 50),
    ('bowl-veggies',  'sweet-corn',    'Sweet Corn',        10.00,  86,  3, 19,  1, 60),
    ('bowl-dressing', 'lemon-herb',    'Lemon Herb',         0.00,  45,  0,  2,  4, 10),
    ('bowl-dressing', 'tahini',        'Tahini',            15.00,  89,  3,  3,  8, 20),
    ('bowl-dressing', 'peri-peri',     'Peri Peri',         10.00,  60,  1,  4,  5, 30),
    ('bowl-dressing', 'curd-mint',     'Curd & Mint',        0.00,  35,  2,  3,  2, 40)
)
insert into public.modifiers (modifier_group_id, slug, name, price_delta, calories, protein_g, carbs_g, fat_g, sort_order)
select g.id, d.slug, d.name, d.price_delta, d.kcal, d.protein, d.carbs, d.fat, d.sort_order
  from data d join public.modifier_groups g on g.slug = d.group_slug
on conflict (modifier_group_id, slug) do update
  set name = excluded.name, price_delta = excluded.price_delta;


-- ═══════════════════════════════════════════════════════════════════════════
--  Verification - every row below should read "ok"
-- ═══════════════════════════════════════════════════════════════════════════

with checks as (
  select 'outlets'         as item, count(*) as actual, 1  as expected from public.outlets
  union all select 'categories',      count(*), 6  from public.categories
  union all select 'menu_items',      count(*), 18 from public.menu_items
  union all select 'nutrition rows',  count(*), 18 from public.menu_item_nutrition
  union all select 'modifier_groups', count(*), 4  from public.modifier_groups
  union all select 'modifiers',       count(*), 18 from public.modifiers
  union all select 'permissions',     count(*), 12 from public.permissions
  union all select 'role_permissions',count(*), 39 from public.role_permissions
  union all select 'tables with RLS', count(*), 18
    from pg_tables where schemaname = 'public' and rowsecurity = true
)
select item, actual, expected,
       case when actual = expected then 'ok' else 'CHECK THIS' end as status
  from checks
 order by item;
