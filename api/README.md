# Brokole API (PHP + MySQL)

Plain PHP 8, no Composer, no framework. Runs on Hostinger shared hosting.

```
api/
├─ index.php            front controller + CORS + routing
├─ config.sample.php    copy to config.php and fill in
├─ .htaccess            rewrites to index.php, blocks config/src/sql
├─ schema.sql           tables — paste into phpMyAdmin
├─ seed.sql             permissions, outlet, 18 meals, bowl modifiers
├─ src/
│  ├─ Db.php            PDO with real prepared statements + UUID v4
│  ├─ Json.php          request body + JSON responses
│  ├─ Jwt.php           HS256 sign/verify (constant-time, rejects alg:none)
│  ├─ Guard.php         THE security boundary — auth + permissions
│  ├─ Audit.php         who changed what
│  └─ routes/           auth, menu, orders, admin
└─ tests/security_test.py   40 checks; run against a dev database only
```

## Applying database changes

```bash
php api/migrate.php            # apply anything new
php api/migrate.php --status   # list what's pending, change nothing
```

Applies every `.sql` in `api/migrations/` that hasn't run yet, in filename
order, and records it in `schema_migrations` so re-running is a no-op. Command
line only — it refuses to run over HTTP.

`schema.sql` + `seed.sql` are the one-time initial setup (paste into phpMyAdmin);
everything after that is a migration file.

## Endpoints

| Method | Path | Access |
|---|---|---|
| GET | `/health` | public |
| POST | `/auth/register` | public — always creates a `customer` |
| POST | `/auth/login` | public — throttled after 8 failures / 15 min |
| GET | `/auth/me` | signed in |
| GET | `/menu` | public (staff with `menu.read` also see inactive items) |
| GET | `/categories`, `/outlets` | public |
| POST | `/addresses` | signed in — always attached to the caller |
| POST | `/orders` | signed in — **prices read from the DB, never from the request** |
| GET | `/orders` | own orders; all orders with `orders.read.all` |
| PATCH | `/orders/{id}/status` | `orders.update.status` — validates the transition |
| PATCH | `/admin/menu/{id}` | `menu.write` |
| PATCH | `/admin/users/{id}/role` | `staff.manage` — cannot change your own |
| GET | `/admin/staff` | `staff.manage` |
| GET | `/admin/customers` | `customers.read` |
| GET | `/admin/audit` | `audit.read` |

## The thing to keep in mind

MySQL has no Row Level Security. In the Postgres version the database itself
refused to return another customer's order, so a mistake in a handler could not
leak data. Here **`Guard.php` is the only thing between a request and the whole
table.** Every new protected endpoint must start with `requireUser()`,
`requirePermission(...)` or `requireStaff()` — and every query that touches
user-owned rows must filter by the caller's id.

`tests/security_test.py` exists to catch it when that slips. Run it after any
change to routes or Guard:

```bash
python3 tests/security_test.py https://your-domain.com/api
```

40 checks currently pass, covering role forcing, cross-customer isolation,
server-side pricing, token forgery (`alg:none`, tampered signature, expiry),
account enumeration, SQL injection, brute-force throttling and the order state
machine.
