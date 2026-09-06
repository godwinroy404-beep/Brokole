# Brokole - get it running in ~10 minutes

No CLI. No Docker. No `supabase link`. Six steps.

---

## 1 · Create the project

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**

| Field | Use |
|---|---|
| Name | `brokole` |
| Database password | Generate one and **save it in your password manager** - it isn't shown again |
| Region | **South Asia (Mumbai)** - closest to Bengaluru |
| Plan | Free is fine to start |

Provisioning takes a minute or two. Wait for the dashboard to go green.

---

## 2 · Create the schema

Left sidebar → **SQL Editor** → **New query**.

Open `supabase/setup-all.sql` from this folder, copy **the whole file**, paste it in, press **Run**.

That one file contains all three migrations plus the seed - tables, roles, permissions,
Row Level Security, the audit trail, `place_order()`, your 18 meals and the bowl modifiers.

At the bottom you'll get a result grid. **Every row should say `ok`:**

```
 item             | actual | expected | status
------------------+--------+----------+--------
 categories       |      6 |        6 | ok
 menu_items       |     18 |       18 | ok
 modifiers        |     18 |       18 | ok
 permissions      |     12 |       12 | ok
 tables with RLS  |     18 |       18 | ok
 ...
```

If something says `CHECK THIS`, or the editor reports an error, fix the cause and just run the
whole file again - it's idempotent and safe to re-run (verified over three consecutive runs).

---

## 3 · Create your account

**Authentication** → **Users** → **Add user** → *Create new user*

- Email: the one you'll actually sign in with
- Password: **you choose it** - pick something long and store it in your password manager
- ✅ **Auto Confirm User** (otherwise you'll wait on a confirmation email)

---

## 4 · Make that account the owner

Back to **SQL Editor**, new query, replacing the email with yours:

```sql
update public.profiles
   set role = 'owner'
 where email = 'you@example.com';
```

It should report `UPDATE 1`. If it says `UPDATE 0`, the email doesn't match a user - check step 3.

> This only works from the SQL Editor. From a browser it's silently reverted, which is what
> stops anyone promoting themselves. That's test T5 in `supabase/tests/rls_test.sql`.

---

## 5 · Connect both apps

**Settings** → **API Keys**. You need two values:

- **Project URL** - `https://xxxxxxxx.supabase.co`
- **Publishable key** - `sb_publishable_...` (older projects show an `anon` key starting `eyJ...`; either works)

⚠️ **Not** the `service_role` / `sb_secret_...` key. It bypasses every security rule in step 2 and
would be compiled into the JavaScript every visitor downloads.

Then in PowerShell, from `G:\gradent\Bro-Ko-Le`:

```powershell
.\scripts\set-supabase-env.ps1
```

It prompts for those two values and writes both `.env.local` files correctly. Your key is typed
into your own terminal and never leaves the machine.

---

## 6 · Restart both dev servers

**Stop them first.** Vite reads `.env.local` only at startup, so editing it while a server is
running changes nothing - the single most common reason this step appears to fail.

```powershell
# terminal 1 - storefront
npm run dev              # http://localhost:5174

# terminal 2 - admin console
cd apps\admin
npm run dev              # http://localhost:5175
```

The amber "Not connected to the database" banner should be gone from both.

---

## Prove it works end to end

1. Open **5175**, sign in with the account from step 3. You should see the empty order board
   and, under **Menu**, all 18 meals from the database.
2. Open **5174**, create a customer account, add a bowl, and place the order.
3. Watch **5175** - the order appears **without a refresh**. That's Supabase Realtime.
4. Click *Mark Accepted* on 5175, then look at 5174 - the customer's tracker updates too.

Then the test that matters most: sign out of 5175 and try to sign in there with the **customer**
account. It's refused. Open devtools and try to force past the UI check - every query still comes
back empty, because the refusal is happening in Postgres, not in React.

---

## If something doesn't work

| Symptom | Cause |
|---|---|
| Amber banner still showing | Dev server wasn't restarted, or a stray `.env.local.txt` (Windows hides extensions) |
| "Invalid login credentials" | Wrong password, or **Auto Confirm** wasn't ticked in step 3 |
| Signs in, then "no access to the operations console" | Step 4 didn't run, or the email didn't match |
| Menu shows but the order board stays empty | Expected - no orders exist yet. Place one from 5174 |
| Order placed but never appears on 5175 | Signed in as a customer on 5174? `place_order` needs a real session |

---

## After this works

1. **Delete `src/routes/kitchen.tsx`** - the old console with the blank-password login. Port
   its inventory and customer screens into `apps/admin` first if you want them.
2. `git init` - this folder still isn't under version control.
3. Enable **MFA** for owner accounts, and put the admin app behind Cloudflare Access before it
   goes anywhere near a public domain.

Full architecture and the phase 3–5 roadmap: `claude/erp-architecture.md` in your Brokole project.
