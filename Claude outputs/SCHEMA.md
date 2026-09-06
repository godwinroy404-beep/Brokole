# Brokole database - what's in it and why

49 tables, 3 derived views. Apply everything with:

```bash
php api/migrate.php
```

Fresh install order: `schema.sql` → `seed.sql` → then `migrate.php` for the rest.

---

## The three rules the schema is built on

**1. Derived numbers are never stored.** On-hand stock is `SUM(stock_movements)`.
Food cost comes from `recipe_lines` × ingredient price. A stored copy of either
becomes a lie the moment anything changes, and you can't tell which number is
wrong.

**2. Money is `DECIMAL(12,2)`, never a float**, and prices are read from the
database, never from a request.

**3. Reporting runs on `business_date`, not `created_at`.** A 01:30 order
belongs to the previous kitchen day. Without this the books never agree with
what the kitchen cooked.

---

## Core (schema.sql)

| Table | Holds |
|---|---|
| `outlets` | Kitchens. Every operational table carries `outlet_id` - cheap now, agonising to retrofit |
| `users` | Auth + profile + `role`. Role is set only by an owner through the API |
| `permissions`, `role_permissions` | Permissions are **data**, so a new role is a row, not a code change |
| `audit_log` | Who changed what, before and after |
| `login_attempts` | Brute-force throttling |
| `categories`, `menu_items`, `menu_item_nutrition` | The menu |
| `modifier_groups`, `modifiers` | The DIY Bowl Studio |
| `addresses`, `orders`, `order_lines`, `order_status_history` | Ordering |

## Subscriptions

| Table | Holds |
|---|---|
| `plans` | Weekly/monthly plans - 4 seeded |
| `subscriptions` | One customer on one plan. `ends_on` moves forward on every skip, which is the whole promise |
| `subscription_schedule` | What is delivered on each day. A nightly job turns tomorrow's rows into **real orders**, so production, delivery, stock and the books all see subscriptions as ordinary orders instead of a parallel pipeline |
| `subscription_skips` | Single skipped days (already live - your calendar writes here) |
| `subscription_pauses` | A skipped *range* |
| `subscription_invoices` | Recurring billing periods |

## Recipes - the backbone

| Table / view | Holds |
|---|---|
| `recipes`, `recipe_lines` | Ingredients per menu item, with `yield_factor` for trim and cooking loss |
| `recipe_costs` *(view)* | Food cost per portion, derived |
| `menu_item_margins` *(view)* | Price vs cost, gross margin, margin % |

This is what turns a menu app into an ERP: the same rows feed the customer's
nutrition label **and** your margin report, so they can never disagree.
Verified: Quinoa Paneer Bowl at ₹160 → ₹76.72 food cost → **52.1% margin**.

## Inventory

| Table / view | Holds |
|---|---|
| `ingredients` | The shelf - SKU, unit, reorder threshold, cost, supplier |
| `stock_movements` | **Append-only ledger.** receipt / issue / wastage / adjustment. The API applies the sign |
| `stock_on_hand` *(view)* | Derived quantity, last restock, total wasted |

## Procurement

`vendors` → `purchase_orders` → `purchase_order_lines` → `goods_receipts` →
`goods_receipt_lines` → `vendor_invoices`.

`goods_receipt_lines` carries `batch_code` and `expires_on` - for fresh food
that's the difference between wastage you planned for and wastage you discover.
`vendor_invoices.status` supports the **three-way match**: nothing is payable
until PO, receipt and invoice agree.

## Production

`production_plans` (one per outlet per business date) → `production_lines`
(aggregated from confirmed orders + tomorrow's subscription schedule), plus
`kitchen_tickets` for the physical slips.

## Payments, tax, invoices

| Table | Holds |
|---|---|
| `payments` | Razorpay/UPI/card. `provider_payment_id` is **unique**, so a replayed webhook can't double-credit an order |
| `refunds` | Against a payment |
| `tax_rates` | GST as data - 5% food supply without ITC, 12% packaged, 18% services, 0% fresh |
| `invoices`, `invoice_lines` | GST invoices with HSN codes |

## Delivery

`delivery_zones` + `delivery_zone_pincodes` (5 Bengaluru zones seeded, resolve
by pincode) and `delivery_assignments` - one row per order, rider and timestamps.

## Nutrition

`customer_profiles` (goal, activity, allergies), `macro_targets` (dated, so
history is kept), `meal_logs`, `consultations`.

---

## What's seeded

4 plans · 4 tax rates · 5 vendors · 5 delivery zones · 6 pincodes ·
12 ingredients with opening stock · 18 menu items · 18 bowl modifiers ·
21 permissions across 7 roles.

## What still has no API

The tables exist and are correct; these have no endpoints yet:
procurement, production, payments, delivery assignment, nutrition, and
subscription writes. Ask for whichever you need next and it's a routes file
plus tests against a schema that already holds the shape.
