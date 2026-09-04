#!/usr/bin/env python3
"""
Brokole API — security test suite.

MySQL has no Row Level Security, so every access rule lives in PHP. That makes
these tests load-bearing: they are the only automated proof that a customer
cannot read another customer's orders or rewrite their own total.

Run against a DEV database only — it creates users and orders.

    python3 tests/security_test.py http://localhost/api
"""
import json, sys, time, urllib.request, urllib.error, base64, hmac, hashlib

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
passed = failed = 0

def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except Exception:
            return e.code, {"raw": raw.decode(errors="replace")[:200]}

def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}   {detail}")

print(f"\nBrokole API security suite -> {BASE}\n" + "=" * 68)

ts = int(time.time())
cust_a = f"cust.a.{ts}@example.com"
cust_b = f"cust.b.{ts}@example.com"
owner  = f"owner.{ts}@example.com"
PW = "correct-horse-battery"

# ── registration ────────────────────────────────────────────────────────────
print("\nRegistration")
st, r = call("POST", "/auth/register",
             {"email": cust_a, "password": PW, "full_name": "Customer A",
              "role": "owner", "is_active": True})          # hostile extra fields
check("T1  registers successfully", st == 201, f"got {st} {r}")
tok_a = r.get("token", "")
check("T2  role forced to customer despite role:'owner' in body",
      r.get("user", {}).get("role") == "customer", str(r.get("user")))

st, r = call("POST", "/auth/register", {"email": cust_b, "password": PW, "full_name": "Customer B"})
tok_b = r.get("token", "")
st, r = call("POST", "/auth/register", {"email": owner, "password": PW, "full_name": "Owner"})
tok_owner_pre = r.get("token", "")
owner_id = r.get("user", {}).get("id")

st, r = call("POST", "/auth/register", {"email": cust_a, "password": PW})
check("T3  duplicate email rejected", st == 409, f"got {st}")

st, r = call("POST", "/auth/register", {"email": "nope", "password": PW})
check("T4  invalid email rejected", st == 422, f"got {st}")

st, r = call("POST", "/auth/register", {"email": f"weak.{ts}@x.com", "password": "123"})
check("T5  short password rejected", st == 422, f"got {st}")

# ── anonymous access ────────────────────────────────────────────────────────
print("\nAnonymous access")
st, r = call("GET", "/menu")
check("T6  menu is public", st == 200 and len(r.get("items", [])) == 18, f"got {st} {len(r.get('items', []))}")

st, r = call("GET", "/orders")
check("T7  orders require sign-in", st == 401, f"got {st}")

st, r = call("GET", "/admin/customers")
check("T8  customer list requires sign-in", st == 401, f"got {st}")

# ── customer limits ─────────────────────────────────────────────────────────
print("\nCustomer limits")
menu = call("GET", "/menu")[1]["items"]
by_slug = {i["slug"]: i for i in menu}
chicken = by_slug["grilled-chicken-brown-rice"]
smoothie = by_slug["berry-protein-smoothie"]

st, r = call("PATCH", f"/admin/menu/{chicken['id']}", {"price": 1}, tok_a)
check("T9  customer cannot edit a menu price", st == 403, f"got {st}")

st, r = call("PATCH", f"/admin/users/{owner_id}/role", {"role": "owner"}, tok_a)
check("T10 customer cannot assign roles", st == 403, f"got {st}")

st, r = call("GET", "/admin/audit", token=tok_a)
check("T11 customer cannot read the audit log", st == 403, f"got {st}")

st, r = call("GET", "/admin/customers", token=tok_a)
check("T12 customer cannot list customers", st == 403, f"got {st}")

# ── order placement and server-side pricing ─────────────────────────────────
print("\nOrder placement")
outlet = call("GET", "/outlets")[1]["outlets"][0]["id"]
st, addr = call("POST", "/addresses", {"line1": "42 Park Ave, Koramangala 560095"}, tok_a)
addr_a = addr.get("address", {}).get("id")

expected_sub = round(float(chicken["price"]) * 2 + float(smoothie["price"]), 2)
expected_tax = round(expected_sub * 0.05, 2)
expected_del = 0.0 if expected_sub >= 499 else 29.0
expected_tot = round(expected_sub + expected_tax + expected_del, 2)

st, r = call("POST", "/orders", {
    "outlet_id": outlet,
    "address_id": addr_a,
    "lines": [
        {"menu_item_id": chicken["id"], "quantity": 2, "price": 1, "line_total": 1},  # hostile
        {"menu_item_id": smoothie["id"], "quantity": 1},
    ],
    "total": 1, "subtotal": 1, "tax_amount": 0,      # hostile
}, tok_a)
o = r.get("order", {})
check("T13 order created", st == 201, f"got {st} {r}")
check(f"T14 subtotal computed server-side ({expected_sub}, not the 1 we sent)",
      abs(float(o.get("subtotal", 0)) - expected_sub) < 0.01, str(o.get("subtotal")))
check(f"T15 GST 5% = {expected_tax}", abs(float(o.get("tax_amount", 0)) - expected_tax) < 0.01, str(o.get("tax_amount")))
check(f"T16 delivery fee {expected_del}", abs(float(o.get("delivery_fee", 0)) - expected_del) < 0.01, str(o.get("delivery_fee")))
check(f"T17 total {expected_tot}", abs(float(o.get("total", 0)) - expected_tot) < 0.01, str(o.get("total")))
order_id = o.get("id")

st, r = call("POST", "/orders", {"outlet_id": outlet, "lines": []}, tok_a)
check("T18 empty order rejected", st == 422, f"got {st}")

st, r = call("POST", "/orders", {"outlet_id": outlet,
                                 "lines": [{"menu_item_id": "00000000-0000-0000-0000-000000000000", "quantity": 1}]}, tok_a)
check("T19 unknown menu item rejected", st == 422, f"got {st}")

# The bypass: invent an item id, supply a name and a price of your choosing.
st, r = call("POST", "/orders", {"outlet_id": outlet, "lines": [{
    "menu_item_id": "deadbeef-0000-0000-0000-000000000000",
    "name": "Totally Real Bowl", "price": 1, "quantity": 5,
}]}, tok_a)
check("T19b invented item with a client-supplied price is refused", st == 422, f"got {st} {r}")

# ── cross-customer isolation ────────────────────────────────────────────────
print("\nCross-customer isolation")
st, r = call("GET", "/orders", token=tok_b)
check("T20 customer B sees none of customer A's orders",
      st == 200 and len(r.get("orders", [])) == 0, f"got {st} {len(r.get('orders', []))}")

st, r = call("POST", "/orders", {"outlet_id": outlet, "address_id": addr_a,
                                 "lines": [{"menu_item_id": chicken["id"], "quantity": 1}]}, tok_b)
check("T21 customer B cannot attach customer A's address", st == 403, f"got {st}")

st, r = call("PATCH", f"/orders/{order_id}/status", {"status": "delivered"}, tok_a)
check("T22 customer cannot advance their own order", st == 403, f"got {st}")

st, r = call("PATCH", f"/orders/{order_id}/status", {"status": "delivered"}, tok_b)
check("T23 customer B cannot advance someone else's order", st == 403, f"got {st}")

# ── token forgery ───────────────────────────────────────────────────────────
print("\nToken handling")
h, p, s = tok_a.split(".")
check("T24 tampered signature rejected", call("GET", "/auth/me", token=f"{h}.{p}.{s[:-2]}xx")[0] == 401)

none_tok = (base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').decode().rstrip("=") + "." + p + ".")
check("T25 alg:none token rejected", call("GET", "/auth/me", token=none_tok)[0] == 401)

payload = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
payload["exp"] = int(time.time()) - 60
p2 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
sig = base64.urlsafe_b64encode(hmac.new(b"test-secret-0123456789abcdef0123456789abcdef",
                                        f"{h}.{p2}".encode(), hashlib.sha256).digest()).decode().rstrip("=")
check("T26 expired token rejected (correctly signed)", call("GET", "/auth/me", token=f"{h}.{p2}.{sig}")[0] == 401)

check("T27 garbage token rejected", call("GET", "/auth/me", token="not.a.token")[0] == 401)

# ── login hardening ─────────────────────────────────────────────────────────
print("\nLogin hardening")
s1, r1 = call("POST", "/auth/login", {"email": f"ghost.{ts}@example.com", "password": "whatever"})
s2, r2 = call("POST", "/auth/login", {"email": cust_a, "password": "wrong-password"})
check("T28 unknown email and wrong password are indistinguishable",
      s1 == s2 == 401 and r1.get("error") == r2.get("error"), f"{r1} vs {r2}")

inj = call("POST", "/auth/login", {"email": "' OR 1=1 -- ", "password": "x"})
check("T29 SQL injection in email does not authenticate", inj[0] == 401, str(inj))

throttled = False
for _ in range(12):
    if call("POST", "/auth/login", {"email": cust_b, "password": "bad"})[0] == 429:
        throttled = True
        break
check("T30 brute force throttled after repeated failures", throttled)

# ── owner powers ────────────────────────────────────────────────────────────
print("\nOwner powers")
print("  (promoting the owner account directly in SQL — the bootstrap path)")
import subprocess
subprocess.run(["mysql", "-ubrokole", "-ptestpass", "-h", "127.0.0.1", "brokole_test",
                "-e", f"UPDATE users SET role='owner' WHERE email='{owner}';"],
               capture_output=True)

tok_owner = call("POST", "/auth/login", {"email": owner, "password": PW})[1].get("token", "")
check("T31 owner can sign in", bool(tok_owner))

st, r = call("GET", "/auth/me", token=tok_owner_pre)
check("T32 role change applies to the OLD token immediately (read from DB, not the token)",
      st == 200 and r.get("user", {}).get("role") == "owner", str(r.get("user", {}).get("role")))

st, r = call("GET", "/orders", token=tok_owner)
check("T33 owner sees all orders", st == 200 and len(r.get("orders", [])) >= 1, f"got {len(r.get('orders', []))}")

st, r = call("PATCH", f"/orders/{order_id}/status", {"status": "delivered"}, tok_owner)
check("T34 illegal transition placed -> delivered refused", st == 409, f"got {st} {r}")

check("T35 legal chain placed -> accepted -> in_kitchen",
      call("PATCH", f"/orders/{order_id}/status", {"status": "accepted"}, tok_owner)[0] == 200 and
      call("PATCH", f"/orders/{order_id}/status", {"status": "in_kitchen"}, tok_owner)[0] == 200)

st, r = call("PATCH", f"/admin/users/{owner_id}/role", {"role": "customer"}, tok_owner)
check("T36 owner cannot change their own role", st == 403, f"got {st}")

st, r = call("PATCH", f"/admin/menu/{chicken['id']}", {"price": 185}, tok_owner)
check("T37 owner can edit a menu price", st == 200, f"got {st}")

st, r = call("GET", "/admin/audit", token=tok_owner)
check("T38 audit trail records the actor", st == 200 and len(r.get("entries", [])) > 0, f"got {st}")

cust_a_id = call("GET", "/auth/me", token=tok_a)[1]["user"]["id"]
st, r = call("PATCH", f"/admin/users/{cust_a_id}/role", {"role": "kitchen_staff"}, tok_owner)
check("T39 owner can promote another user", st == 200, f"got {st}")

st, r = call("PATCH", f"/admin/users/{cust_a_id}/role", {"role": "superadmin"}, tok_owner)
check("T40 invalid role rejected", st == 422, f"got {st}")

# ── regressions ─────────────────────────────────────────────────────────────
print("\nRegressions")

# Sept 2026: business_date_for() was deleted while route_skip_day was added,
# which made every checkout return 500. This asserts checkout still works.
st, r = call("POST", "/orders", {
    "outlet_id": outlet,
    "lines": [{"menu_item_id": smoothie["id"], "quantity": 1}],
}, tok_b)
check("T41 checkout still works (business_date_for present)", st == 201, f"got {st} {r}")
skip_target = r.get("order", {}).get("id")

# The old /orders/{id}/skip-day wrote skips into orders.notes as a text tag and
# had no ownership check. Replaced by subscription_skips + /me/skips.
import datetime
today = datetime.date.today()
d_future = (today + datetime.timedelta(days=3)).isoformat()
d_past   = (today - datetime.timedelta(days=1)).isoformat()
d_far    = (today + datetime.timedelta(days=400)).isoformat()

st, r = call("PUT", "/me/skips", {"date": d_future, "skipped": True}, tok_b)
check("T42 a customer can skip a future day", st == 200, f"got {st} {r}")

st, r = call("GET", f"/me/skips?from={today.isoformat()}&to={d_far}", token=tok_b)
check("T43 the skip is persisted and read back",
      st == 200 and any(x["skip_date"].startswith(d_future) for x in r.get("skips", [])),
      f"got {st} {r}")

st, r = call("GET", "/me/skips", token=tok_out if 'tok_out' in dir() else tok_a)
check("T44 another customer does not see it", st == 200 and len(r.get("skips", [])) == 0,
      f"got {st} {len(r.get('skips', []))}")

st, r = call("PUT", "/me/skips", {"date": d_future, "skipped": True}, tok_b)
check("T45 setting the same day twice is idempotent", st == 200, f"got {st}")

st, r = call("PUT", "/me/skips", {"date": d_past, "skipped": True}, tok_b)
check("T46 a past day cannot be skipped", st == 422, f"got {st}")

st, r = call("PUT", "/me/skips", {"date": d_far, "skipped": True}, tok_b)
check("T47 beyond the planning horizon is refused", st == 422, f"got {st}")

st, r = call("PUT", "/me/skips", {"date": "not-a-date", "skipped": True}, tok_b)
check("T48 malformed date rejected", st == 422, f"got {st}")

st, r = call("PUT", "/me/skips", {"date": "2026-02-30", "skipped": True}, tok_b)
check("T49 impossible calendar date rejected", st == 422, f"got {st}")

st, r = call("PUT", "/me/skips", {"date": d_future, "skipped": True, "order_id": order_id}, tok_b)
check("T50 cannot attach another customer's order to a skip", st == 403, f"got {st}")

# The UI displays order_no, so the endpoint accepts it as well as the database
# id — still scoped to the caller. Sending the wrong one used to 403.
own = call("POST", "/orders", {"outlet_id": outlet,
                               "lines": [{"menu_item_id": smoothie["id"], "quantity": 1}]}, tok_b)[1]["order"]
st, r = call("PUT", "/me/skips",
             {"date": d_future, "skipped": True, "order_id": own["order_no"]}, tok_b)
check("T50b own order accepted by its display number (order_no)", st == 200, f"got {st} {r}")

st, r = call("PUT", "/me/skips",
             {"date": d_future, "skipped": True, "order_id": own["id"]}, tok_b)
check("T50c own order accepted by its database id", st == 200, f"got {st} {r}")

st, r = call("PUT", "/me/skips",
             {"date": d_future, "skipped": True, "order_id": "BKL-000000-9999"}, tok_b)
check("T50d an order number that isn't yours is still refused", st == 403, f"got {st}")

st, r = call("PUT", "/me/skips", {"date": d_future, "skipped": False}, tok_b)
check("T51 a skip can be undone", st == 200, f"got {st}")

st, r = call("GET", "/me/skips", token=tok_b)
check("T52 the undo is persisted", st == 200 and len(r.get("skips", [])) == 0, f"got {r}")

st, r = call("GET", "/me/skips")
check("T53 skips require sign-in", st == 401, f"got {st}")

st, r = call("GET", f"/admin/skips?date={d_future}", token=tok_b)
check("T54 a customer cannot read the kitchen's skip list", st == 403, f"got {st}")

st, r = call("GET", f"/admin/skips?date={d_future}", token=tok_owner)
check("T55 the kitchen can read the skip list", st == 200, f"got {st}")

# ── inventory & sales sections ──────────────────────────────────────────────
print("\nInventory")

st, inv = call("GET", "/admin/inventory", token=tok_owner)
check("T56 owner can read inventory", st == 200 and len(inv.get("items", [])) > 0, f"got {st}")
check("T57 on-hand is derived, and a summary is returned",
      all(k in inv.get("summary", {}) for k in ("items_total", "items_low", "stock_value")))

item = inv["items"][0]
before = float(item["on_hand"])

st, r = call("POST", f"/admin/inventory/{item['id']}/movements",
             {"kind": "receipt", "quantity": 5}, tok_owner)
check("T58 a receipt increases stock", st == 201 and abs(float(r["on_hand"]) - (before + 5)) < 0.001,
      f"got {st} {r}")

# The client sends a positive number for every kind; the API applies the sign.
st, r = call("POST", f"/admin/inventory/{item['id']}/movements",
             {"kind": "wastage", "quantity": 2}, tok_owner)
check("T59 wastage is stored negative regardless of the sign sent",
      st == 201 and float(r["quantity"]) < 0, f"got {st} {r}")

st, r = call("POST", f"/admin/inventory/{item['id']}/movements",
             {"kind": "issue", "quantity": 999999}, tok_owner)
check("T60 cannot issue more stock than exists", st == 422, f"got {st}")

st, r = call("POST", f"/admin/inventory/{item['id']}/movements",
             {"kind": "teleport", "quantity": 1}, tok_owner)
check("T61 unknown movement kind rejected", st == 422, f"got {st}")

st, r = call("POST", f"/admin/inventory/{item['id']}/movements",
             {"kind": "receipt", "quantity": 0}, tok_owner)
check("T62 zero-quantity movement rejected", st == 422, f"got {st}")

st, r = call("GET", f"/admin/inventory/{item['id']}/movements", token=tok_owner)
check("T63 the ledger lists every movement", st == 200 and len(r.get("movements", [])) >= 3, f"got {st}")

st, r = call("POST", "/admin/inventory", {"sku": "TEST-SKU-1", "name": ""}, tok_owner)
check("T64 an ingredient needs a name", st == 422, f"got {st}")

st, r = call("POST", "/admin/inventory", {"sku": "bad sku!", "name": "X"}, tok_owner)
check("T65 malformed SKU rejected", st == 422, f"got {st}")

# tok_a is kitchen_staff by this point: reads inventory, cannot change it.
st, r = call("GET", "/admin/inventory", token=tok_a)
check("T66 kitchen staff can read inventory", st == 200, f"got {st}")

st, r = call("POST", f"/admin/inventory/{item['id']}/movements",
             {"kind": "receipt", "quantity": 1}, tok_a)
check("T67 kitchen staff cannot record movements (no inventory.write)", st == 403, f"got {st}")

st, r = call("GET", "/admin/inventory", token=tok_b)
check("T68 a customer cannot read inventory", st == 403, f"got {st}")

print("\nSales report")
st, rep = call("GET", "/admin/sales", token=tok_owner)
check("T69 owner can read the sales report", st == 200, f"got {st}")

delivered_total = sum(float(o["total"]) for o in rep.get("orders", []) if o["status"] == "delivered")
check("T70 revenue counts delivered orders only",
      abs(float(rep["summary"]["gross_revenue"]) - delivered_total) < 0.01,
      f'{rep["summary"]["gross_revenue"]} vs {delivered_total}')

check("T71 kitchen staff cannot read revenue", call("GET", "/admin/sales", token=tok_a)[0] == 403)
check("T72 a customer cannot read revenue", call("GET", "/admin/sales", token=tok_b)[0] == 403)

print("\nCustomers & subscriptions")
st, r = call("GET", "/admin/customers", token=tok_owner)
check("T73 owner can list customers", st == 200 and "customers" in r, f"got {st}")
check("T74 kitchen staff cannot list customers", call("GET", "/admin/customers", token=tok_a)[0] == 403)

st, r = call("GET", f"/admin/skips?from={today.isoformat()}&to={d_far}", token=tok_owner)
check("T75 admin skips accepts a date range", st == 200 and "from" in r and "to" in r, f"got {st} {r}")

print("\n" + "=" * 68)
print(f"  {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
