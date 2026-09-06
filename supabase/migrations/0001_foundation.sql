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
