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
