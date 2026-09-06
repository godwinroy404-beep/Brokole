# Brokole ERP - setup

Everything here was written into `G:\gradent\Bro-Ko-Le` alongside your existing app.
**Nothing existing was modified or deleted.** Your site still builds and runs exactly as before.

---

## 0. Before anything else: close the `/kitchen` hole

`src/routes/kitchen.tsx` currently unlocks on an **empty password** (`adminPassword === ''`),
ships the accepted passwords in the customer bundle, and gates on a `sessionStorage` flag anyone
can set. It also has a `handleQuickDemoLogin()` button that skips even that.

Your deployed build doesn't include it yet - I checked, `/kitchen` 404s - so **you are not exposed
right now**. But do not run `npm run build` and upload until this route is gone.

Once the admin console below is running, delete `src/routes/kitchen.tsx`. TanStack Router
regenerates `routeTree.gen.ts` automatically on the next `npm run dev`. I did not delete it for
you because it contains layout work worth porting into `apps/admin` screen by screen.

---

## 1. Create the Supabase project

1. supabase.com → **New project**. Region: **Mumbai (ap-south-1)** - closest to Bengaluru.
2. Save the database password somewhere safe.
3. **Project Settings → API** gives you the two values used below.

## 2. Install the Supabase CLI and push the schema

```powershell
npm install -g supabase

cd G:\gradent\Bro-Ko-Le
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push          # applies migrations 0001, 0002, 0003
```

Then load the 18 meals - **SQL Editor** in the dashboard, paste `supabase/seed.sql`, run.

> Prefer to try it locally first? `supabase start` runs the whole stack in Docker and
> `supabase db reset` applies the migrations **and** the seed in one go.

## 3. Make yourself the owner

Sign up once through the app (or **Authentication → Add user** in the dashboard), then in the
**SQL Editor**:

```sql
update public.profiles
   set role = 'owner'
 where email = 'your@email.com';
```

This works from the SQL editor and the service role only. It cannot be done from a browser -
see `guard_profile_privileges()` in migration 0001.

## 4. Turn on the access-token hook (recommended)

**Authentication → Hooks → Custom Access Token** → select `public.custom_access_token_hook`.

This stamps the role into the JWT so RLS reads a claim instead of querying `profiles` on every
row. Everything works without it - just slower once orders grow.

## 5. Run the admin console

```powershell
cd G:\gradent\Bro-Ko-Le\apps\admin
copy .env.example .env.local     # then fill in your URL + anon key
npm install
npm run dev                      # http://localhost:5174
```

Sign in with the owner account. You should see the live order board and the menu.

**Now run the test that matters:** sign out, then sign in with a *customer* account.
You get "This account has no access to the operations console." Then open devtools and try to
force your way past the UI check - you'll find every query comes back empty, because the refusal
is happening in Postgres, not in React.

## 6. Point the customer app at the database

I added two files to your existing app (new files, nothing overwritten):

- `src/lib/supabase.ts` - the customer Supabase client
- `src/lib/menu.ts` - `fetchMenu()`, `placeOrder()`, `fetchMyOrders()`

```powershell
cd G:\gradent\Bro-Ko-Le
npm install @supabase/supabase-js
copy .env.example .env.local     # same URL + anon key
```

Then in `src/lib/shopify.ts`, make `fetchProducts()` call `fetchMenu()` from `./menu`. It returns
the identical `Product` shape, so every card, filter and detail page keeps working - and
`SAMPLE_PRODUCTS` can be deleted.

`placeOrder()` deliberately sends **no price and no total**. The database reads the price from
`menu_items` and computes the total itself.

## 7. Promote to the monorepo (optional, do it when step 6 works)

```powershell
cd G:\gradent\Bro-Ko-Le
.\scripts\migrate-to-monorepo.ps1
pnpm install
```

Moves your app into `apps/web`, installs the workspace root. `apps/admin` already resolves
`@brokole/domain` by path, so it works before *and* after this step.

---

## What's here

```
supabase/migrations/0001_foundation.sql   roles, profiles, permissions, audit, RLS helpers
supabase/migrations/0002_catalog.sql      categories, menu items, nutrition, modifiers
supabase/migrations/0003_orders.sql       addresses, orders, place_order(), state machine
supabase/seed.sql                         your 18 real meals + DIY Bowl Studio modifiers
supabase/tests/rls_test.sql               21 security tests (see below)

packages/domain/src/index.ts              roles, order state machine, pricing, macro math

apps/admin/                               the operations console
  src/lib/useSession.ts                   loads profile + permissions; NOT the security boundary
  src/components/LoginScreen.tsx          no signup, no demo button, no password in the bundle
  src/screens/OrdersScreen.tsx            live board via Supabase Realtime
  src/screens/MenuScreen.tsx              menu list with a macro-plausibility warning

src/lib/supabase.ts, src/lib/menu.ts      added to your existing customer app
scripts/migrate-to-monorepo.ps1           the promotion above
```

## The security tests

`supabase/tests/rls_test.sql` runs 21 checks as four different personas. Run it against a local
`supabase start` instance - **never production**, it inserts users and orders.

All 21 pass on the schema as shipped. The ones worth knowing about:

| | Test |
|---|---|
| T1 | Signing up with `{"role":"owner"}` in the metadata still produces a **customer** |
| T3 | A customer inserting a menu item - *rejected by RLS* |
| T4 | A customer changing a price - *0 rows* |
| T5 | A customer promoting themselves to owner - *silently reverted* |
| T6/T7 | Customer sees 1 profile (their own) and 0 audit rows |
| T10 | A customer rewriting the total on their **own** order - *0 rows* |
| T12 | A customer inserting straight into `orders`, bypassing the RPC - *permission denied* |
| T13 | A different customer reading someone's orders, lines, addresses - *0, 0, 0* |
| T15 | Owner attempting `placed → delivered` - *illegal transition* |
| T19 | Owner changing their **own** role - *refused* |
| T21 | Anonymous can read the menu, cannot touch profiles or orders |

## Two things I'd fix before you go live

1. **Enable MFA** for `store_manager` and `owner` (Authentication → Providers → MFA).
2. **Put `admin.brokole.com` behind Cloudflare Access or an IP allowlist.** It's an internal
   tool; it doesn't need to be reachable from the open internet.

## Deliberately not built yet

Recipes and food cost, stock ledger, procurement, subscriptions, GST invoices, the nutrition
layer. Phases 3–5 in `claude/erp-architecture.md`. Get real orders flowing through phases 0–2
first - an inventory module for a business with no order volume teaches you nothing.
