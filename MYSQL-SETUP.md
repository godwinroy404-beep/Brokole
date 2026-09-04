# Brokole on MySQL — setup

Everything runs on the Hostinger plan you already pay for. No Supabase account,
no CLI, no Docker.

```
storefront (5174) ─┐
                   ├──►  /api  (PHP)  ──►  MySQL
admin (5175) ──────┘
```

---

## 1 · Create the database

hPanel → **Databases → MySQL Databases** → *Create a New Database*.

Hostinger prefixes both names, so you'll end up with something like
`u123456789_brokole`. **Write down the database name, username and password** —
the password is shown only once.

## 2 · Create the tables

hPanel → **Databases → phpMyAdmin** → open your database → **SQL** tab.

1. Paste all of `api/schema.sql` → **Go**
2. Paste all of `api/seed.sql` → **Go**

The seed ends with a table showing what was created — all seven rows should
match the expected column (18 menu items, 18 modifiers, 39 role permissions).
Both files are safe to run more than once.

## 3 · Configure the API

Copy `api/config.sample.php` to `api/config.php` and fill in the four database
values from step 1.

Then generate a signing secret — anywhere with PHP, or hPanel's terminal:

```bash
php -r "echo bin2hex(random_bytes(32));"
```

Paste that into `jwt_secret`. **Don't reuse the example.** It's what stops
someone minting their own login tokens.

Set `allowed_origins` to the sites allowed to call the API. Keep it tight —
this is what stops another website making requests as your signed-in users.

## 4 · Upload

hPanel → **File Manager** (or FTP). Upload the whole `api/` folder into
`public_html/`, so it lives at `public_html/api/`.

Check it: open `https://your-domain.com/api/health` — you should see
`{"ok":true,...}`.

If you get a 500, `config.php` is missing or the database values are wrong.
If you get a 404, the `.htaccess` didn't upload (it's a hidden file — turn on
"show hidden files" in File Manager).

## 5 · Point the apps at it

`.env.local` in **both** app folders:

```
VITE_API_URL=https://your-domain.com/api
```

For local development against the live API, that same line works. Then
**restart both dev servers** — Vite reads `.env.local` only at startup.

## 6 · Make yourself the owner

Register through the storefront first, then in **phpMyAdmin → SQL**:

```sql
UPDATE users SET role = 'owner' WHERE email = 'you@example.com';
```

`UPDATE 1` means it worked. This is the only way the first owner is created:
the API refuses to set a role for anyone without `staff.manage`, and refuses to
let anyone change their own.

---

## Prove it works

1. **5175** — sign in as the owner. Empty order board; 18 items under Menu.
2. **5174** — register a customer, add a bowl, place the order.
3. **5175** — the order appears within ~6 seconds.
4. Advance it. The customer's tracker on 5174 follows.

Then the test that matters: sign out of 5175 and sign in with the **customer**
account. Refused. Patch the JavaScript in devtools to skip that check and the
API still returns 403 on every admin call.

---

## What's different from the Postgres version

| | Postgres/Supabase | MySQL/PHP |
|---|---|---|
| Access rules | Row Level Security, in the database | `Guard.php`, in the API |
| Live updates | Realtime push | Polling every 6s (paused when the tab is hidden) |
| Audit trail | DB triggers — caught every write | API only — **phpMyAdmin edits aren't logged** |
| Auth | Supabase Auth | JWT + `password_hash` in `auth.php` |

The practical consequence: **the API is now the only thing protecting your
data.** A handler that forgets to filter by the caller's id leaks every
customer's orders, and nothing downstream will catch it. That's what
`api/tests/security_test.py` is for — 40 checks, currently all passing. Run it
after any change to `src/routes/` or `Guard.php`.

## Before you go live

1. **Serve the site over HTTPS only.** Tokens travel in a header; on plain HTTP
   anyone on the same wifi can take one.
2. Set `'debug' => false` in `config.php` so stack traces aren't shown.
3. Confirm `https://your-domain.com/api/config.php` returns 403 — the
   `.htaccess` should block it. If it shows PHP source, stop and fix that first.
4. Delete `src/routes/kitchen.tsx` from the storefront (the old blank-password
   console).
5. Take database backups — hPanel → Databases → Backups.
