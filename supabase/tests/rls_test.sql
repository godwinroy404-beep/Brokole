\set ON_ERROR_STOP 0
\pset pager off
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','customer@example.com','{"full_name":"Test Customer"}'),
  ('22222222-2222-2222-2222-222222222222','owner@brokole.com','{"full_name":"Allan"}'),
  ('33333333-3333-3333-3333-333333333333','other@example.com','{"full_name":"Other Customer"}'),
  ('44444444-4444-4444-4444-444444444444','attacker@evil.com','{"full_name":"Mallory","role":"owner","app_role":"owner","is_admin":true}')
on conflict do nothing;
update public.profiles set role='owner' where id='22222222-2222-2222-2222-222222222222';
insert into public.addresses (id, profile_id, line1, city, pincode)
  values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','42 Park Ave','Bengaluru','560095')
on conflict do nothing;
\set QUIET off

\echo '=== T1  signup metadata claiming owner is ignored ==='
select u.email, p.role from public.profiles p join auth.users u on u.id=p.id order by u.email;

\echo ''
\echo '=== acting as CUSTOMER ==='
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo 'T2  reads live menu (expect 18)'
select count(*) from public.menu_items;
\echo 'T3  INSERT menu item (expect: permission denied)'
insert into public.menu_items (slug,name,price) values ('hacked','Free Bowl',0);
\echo 'T4  UPDATE a price (expect UPDATE 0)'
update public.menu_items set price = 1 where slug='grilled-chicken-brown-rice';
\echo 'T5  self-promote to owner (expect role still customer)'
update public.profiles set role='owner' where id='11111111-1111-1111-1111-111111111111';
select role from public.profiles where id='11111111-1111-1111-1111-111111111111';
\echo 'T6  read customer list (expect 1 = self only)'
select count(*) from public.profiles;
\echo 'T7  read audit log (expect 0)'
select count(*) from public.audit_log;
\echo 'T8  place_order via RPC'
select public.place_order(
  (select id from public.outlets where code='BKL-BLR-01'),
  jsonb_build_array(
    jsonb_build_object('menu_item_id',(select id from public.menu_items where slug='grilled-chicken-brown-rice'),'quantity',2),
    jsonb_build_object('menu_item_id',(select id from public.menu_items where slug='berry-protein-smoothie'),'quantity',1)
  ),
  'aaaaaaaa-0000-0000-0000-000000000001') is not null as order_created;
\echo 'T9  server-computed totals (2x180 + 1x125 = 485 subtotal, 24.25 GST, 29 delivery, 538.25 total)'
select order_no, subtotal, tax_amount, delivery_fee, total, total_protein, status from public.orders;
\echo 'T10 inflate own order total (expect UPDATE 0)'
update public.orders set total = 1, subtotal = 1;
\echo 'T11 mark own order delivered (expect: insufficient permission)'
select public.update_order_status((select id from public.orders limit 1), 'delivered');
\echo 'T12 direct INSERT into orders bypassing the RPC (expect permission denied)'
insert into public.orders (order_no,outlet_id,customer_id,business_date,total)
  values ('FAKE-1',(select id from public.outlets limit 1),'11111111-1111-1111-1111-111111111111',current_date,0);
reset role; reset request.jwt.claims; reset request.jwt.claim.sub;

\echo ''
\echo '=== acting as A DIFFERENT CUSTOMER ==='
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
\echo 'T13 see other people''s orders / lines / addresses (expect 0, 0, 0)'
select (select count(*) from public.orders)     as orders,
       (select count(*) from public.order_lines) as lines,
       (select count(*) from public.addresses)   as addresses;
reset role; reset request.jwt.claims; reset request.jwt.claim.sub;

\echo ''
\echo '=== acting as OWNER ==='
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo 'T14 sees all orders (expect 1)'
select count(*) from public.orders;
\echo 'T15 illegal transition placed -> delivered (expect: illegal transition)'
select public.update_order_status((select id from public.orders limit 1), 'delivered');
\echo 'T16 legal chain placed -> accepted -> in_kitchen'
select public.update_order_status((select id from public.orders limit 1), 'accepted');
select public.update_order_status((select id from public.orders limit 1), 'in_kitchen');
select status from public.orders;
\echo 'T17 edits a menu price (allowed)'
update public.menu_items set price = 185 where slug='grilled-chicken-brown-rice';
select name, price from public.menu_items where slug='grilled-chicken-brown-rice';
\echo 'T18 reads the audit trail (expect rows, with actor_role)'
select table_name, action, actor_role from public.audit_log order by id desc limit 3;
\echo 'T19 owner cannot change their OWN role (expect: you cannot change your own role)'
select public.set_staff_role('22222222-2222-2222-2222-222222222222','customer');
\echo 'T20 owner promotes a real staff member (allowed)'
select public.set_staff_role('33333333-3333-3333-3333-333333333333','kitchen_staff');
reset role; reset request.jwt.claims; reset request.jwt.claim.sub;

\echo ''
\echo '=== acting as ANONYMOUS (not logged in) ==='
set role anon;
\echo 'T21 anon reads menu (expect 18) but not profiles/orders (expect denied)'
select count(*) from public.menu_items;
select count(*) from public.profiles;
select count(*) from public.orders;
reset role;
