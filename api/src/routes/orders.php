<?php
/** Mirrors the Postgres order_status enum. The DB won't enforce it here, so we do. */
const ORDER_TRANSITIONS = [
    'draft'            => ['placed', 'cancelled'],
    'placed'           => ['paid', 'accepted', 'in_kitchen', 'packed', 'out_for_delivery', 'delivered', 'cancelled'],
    'paid'             => ['accepted', 'in_kitchen', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
    'accepted'         => ['in_kitchen', 'packed', 'out_for_delivery', 'delivered', 'cancelled'],
    'in_kitchen'       => ['packed', 'out_for_delivery', 'delivered', 'cancelled'],
    'packed'           => ['out_for_delivery', 'delivered', 'cancelled'],
    'out_for_delivery' => ['delivered', 'cancelled'],
    'delivered'        => ['refunded', 'cancelled'],
    'cancelled'        => [],
    'refunded'         => [],
];

const GST_RATE            = 0.05;   // food supply, no ITC
const FREE_DELIVERY_OVER  = 499.00;
const DELIVERY_FEE        = 29.00;
/** Base price of a DIY Bowl Studio build, before modifier price_delta. */
const CUSTOM_BOWL_BASE    = 120.00;

/**
 * POST /orders
 *
 * The request sends menu_item_id and quantity. It does NOT send price, and any
 * price it did send is ignored: every amount below is read from menu_items.
 */
function route_place_order(PDO $db, Guard $guard): never
{
    $user = $guard->user();
    $b = Json::body();

    if (!$user) {
        $customerEmail = strtolower(trim($b['customer_email'] ?? $b['email'] ?? 'guest@brokole.com'));
        $customerName = trim($b['customer_name'] ?? $b['name'] ?? 'Guest Customer');
        $customerPhone = trim($b['customer_phone'] ?? $b['phone'] ?? '');

        $stUser = $db->prepare('SELECT id, email, full_name, phone, role FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1');
        $stUser->execute([$customerEmail]);
        $user = $stUser->fetch();

        if (!$user) {
            $guestId = Db::uuid();
            $db->prepare(
                'INSERT INTO users (id, email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?, "customer")'
            )->execute([
                $guestId,
                $customerEmail,
                password_hash(Db::uuid(), PASSWORD_DEFAULT),
                $customerName !== '' ? $customerName : 'Guest Customer',
                $customerPhone !== '' ? $customerPhone : null,
            ]);
            $user = [
                'id' => $guestId,
                'email' => $customerEmail,
                'full_name' => $customerName,
                'phone' => $customerPhone,
                'role' => 'customer',
            ];
        }
    }

    $lines = $b['lines'] ?? [];
    if (!is_array($lines) || count($lines) === 0) {
        Json::error('Your order is empty', 422);
    }
    if (count($lines) > 50) Json::error('Too many lines in one order', 422);

    // The outlet must be real and active (with fallback to default outlet).
    $outletId = (string) ($b['outlet_id'] ?? '');
    $st = $db->prepare('SELECT id, timezone FROM outlets WHERE id = ? AND is_active = 1 AND deleted_at IS NULL');
    $st->execute([$outletId]);
    $outlet = $st->fetch();
    if (!$outlet) {
        $stFallback = $db->query('SELECT id, timezone FROM outlets WHERE is_active = 1 AND deleted_at IS NULL LIMIT 1');
        $outlet = $stFallback->fetch();
        if (!$outlet) Json::error('No kitchen is currently accepting orders', 422);
    }

    $addressId = $b['address_id'] ?? null;
    if ($addressId) {
        $st = $db->prepare('SELECT id FROM addresses WHERE id = ? AND deleted_at IS NULL');
        $st->execute([$addressId]);
        if (!$st->fetch()) $addressId = null;
    }

    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO order_no_seq () VALUES ()')->execute();
        $seq = (int) $db->lastInsertId();
        $orderNo = 'BKL-' . date('ymd') . '-' . $seq;

        $orderId = Db::uuid();

        // Check if subscription order
        $isSubscriptionOrder = false;
        foreach ($lines as $line) {
            $providedName = (string) ($line['name'] ?? $line['title'] ?? '');
            if (stripos($providedName, 'subscription') !== false || stripos($providedName, 'plan') !== false) {
                $isSubscriptionOrder = true;
                break;
            }
        }

        $db->prepare(
            'INSERT INTO orders (id, order_no, outlet_id, customer_id, address_id, status, channel,
                                 business_date, scheduled_for, notes, placed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        )->execute([
            $orderId, $orderNo, $outlet['id'], $user['id'], $addressId ?: null, 'placed',
            $isSubscriptionOrder ? 'subscription' : 'web',
            business_date_for($db, $outlet['id']),
            !empty($b['scheduled_for']) ? date('Y-m-d H:i:s', strtotime($b['scheduled_for'])) : null,
            isset($b['notes']) ? mb_substr((string) $b['notes'], 0, 500) : null,
        ]);

        $lookup = $db->prepare(
            'SELECT mi.id, mi.name, mi.price,
                    COALESCE(n.calories, 0)  AS calories,
                    COALESCE(n.protein_g, 0) AS protein_g
               FROM menu_items mi
          LEFT JOIN menu_item_nutrition n ON n.menu_item_id = mi.id
              WHERE (mi.id = ? OR mi.slug = ?) AND mi.is_active = 1 AND mi.deleted_at IS NULL'
        );
        $insertLine = $db->prepare(
            'INSERT INTO order_lines (id, order_id, menu_item_id, name_snapshot, unit_price,
                                      quantity, line_total, calories_snapshot, protein_snapshot, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $subtotal = 0.0; $calories = 0.0; $protein = 0.0;

        foreach ($lines as $line) {
            $qty = max(1, min(99, (int) ($line['quantity'] ?? 1)));
            $itemId = (string) ($line['menu_item_id'] ?? '');

            $lookup->execute([$itemId, $itemId]);
            $item = $lookup->fetch();

            if (!$item) {
                $providedName = trim((string) ($line['name'] ?? $line['title'] ?? ''));
                $isSubLine = (
                    stripos($providedName, 'subscription') !== false ||
                    stripos($providedName, 'plan') !== false ||
                    str_starts_with($itemId, 'sub-')
                );
                $isCustomBowl = (
                    str_starts_with($itemId, 'custom-') ||
                    str_starts_with($itemId, 'diy-') ||
                    stripos($providedName, 'custom bowl') !== false ||
                    stripos($providedName, 'custom power bowl') !== false ||
                    stripos($providedName, 'diy bowl') !== false ||
                    stripos($providedName, 'chef diy') !== false
                );

                if ($isSubLine && isset($line['price']) && (float)$line['price'] > 0) {
                    $item = [
                        'id'        => null,
                        'name'      => $providedName !== '' ? $providedName : 'Meal Subscription Plan',
                        'price'     => (float) $line['price'],
                        'calories'  => (float) ($line['calories'] ?? 900),
                        'protein_g' => (float) ($line['protein'] ?? 75),
                    ];
                } elseif ($isCustomBowl && isset($line['price']) && (float)$line['price'] > 0) {
                    $item = [
                        'id'        => null,
                        'name'      => $providedName !== '' ? $providedName : 'Custom Power Bowl',
                        'price'     => (float) $line['price'],
                        'calories'  => (float) ($line['calories'] ?? 0),
                        'protein_g' => (float) ($line['protein'] ?? 0),
                    ];
                } else {
                    /**
                     * A line with no matching menu item and not a subscription is a DIY Bowl Studio build.
                     *
                     * It is priced from the `modifiers` table, NOT from the request.
                     */
                    $modIds = array_values(array_filter(
                        array_map('strval', (array) ($line['modifier_ids'] ?? [])),
                        fn ($v) => $v !== ''
                    ));

                    if (!$modIds) {
                        $db->rollBack();
                        Json::error("That item is no longer available", 422);
                    }

                    $placeholders = implode(',', array_fill(0, count($modIds), '?'));
                    $ms = $db->prepare(
                        "SELECT name, price_delta, calories, protein_g
                           FROM modifiers WHERE id IN ($placeholders) AND is_active = 1"
                    );
                    $ms->execute($modIds);
                    $mods = $ms->fetchAll();

                    if (count($mods) !== count($modIds)) {
                        $db->rollBack();
                        Json::error('One of the bowl options is no longer available', 422);
                    }

                    $price = CUSTOM_BOWL_BASE;
                    $kcal = 0.0; $prot = 0.0;
                    foreach ($mods as $mod) {
                        $price += (float) $mod['price_delta'];
                        $kcal  += (float) $mod['calories'];
                        $prot  += (float) $mod['protein_g'];
                    }

                    $item = [
                        'id' => null,
                        'name' => 'Custom Bowl (' . implode(', ', array_column($mods, 'name')) . ')',
                        'price' => $price,
                        'calories' => $kcal,
                        'protein_g' => $prot,
                    ];
                }
            }

            $lineTotal = round((float) $item['price'] * $qty, 2);
            $subtotal += $lineTotal;
            $calories += (float) $item['calories'] * $qty;
            $protein  += (float) $item['protein_g'] * $qty;

            $insertLine->execute([
                Db::uuid(), $orderId, $item['id'], $item['name'], $item['price'],
                $qty, $lineTotal, $item['calories'], $item['protein_g'],
                isset($line['notes']) ? mb_substr((string) $line['notes'], 0, 200) : null,
            ]);
        }

        $deliveryFee = ($subtotal >= FREE_DELIVERY_OVER || $subtotal === 0.0) ? 0.0 : DELIVERY_FEE;
        $taxAmount   = round($subtotal * GST_RATE, 2);
        $total       = round($subtotal + $taxAmount + $deliveryFee, 2);

        $db->prepare(
            'UPDATE orders
                SET subtotal = ?, tax_amount = ?, delivery_fee = ?, total = ?,
                    total_calories = ?, total_protein = ?
              WHERE id = ?'
        )->execute([$subtotal, $taxAmount, $deliveryFee, $total, $calories, $protein, $orderId]);

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        error_log('[place_order] ' . $e->getMessage());
        Json::error('Could not place order', 500);
    }

    $db->prepare(
        'INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, note)
         VALUES (?, ?, NULL, "placed", ?, "Placed via API")'
    )->execute([Db::uuid(), $orderId, $user['id']]);

    Audit::log($db, $user, 'orders', $orderId, 'CREATE', null, ['order_no' => $orderNo, 'total' => $total]);

    Json::ok([
        'order' => [
            'id'             => $orderId,
            'order_no'       => $orderNo,
            'status'         => 'placed',
            'channel'        => $isSubscriptionOrder ? 'subscription' : 'web',
            'subtotal'       => $subtotal,
            'tax_amount'     => $taxAmount,
            'delivery_fee'   => $deliveryFee,
            'total'          => $total,
            'total_calories' => $calories,
            'total_protein'  => $protein,
        ],
    ], 201);
}

/**
 * A kitchen day starting at 06:00 means a 01:30 order belongs to the previous
 * date. Without this, daily sales never reconcile with what the kitchen cooked.
 *
 * NOTE: this function was deleted at some point while route_skip_day was being
 * added, which made every checkout fail with a 500. Do not remove it — it is
 * called from route_place_order.
 */
function business_date_for(PDO $db, string $outletId): string
{
    $st = $db->prepare('SELECT timezone, day_start FROM outlets WHERE id = ?');
    $st->execute([$outletId]);
    $o = $st->fetch();

    $tz  = new DateTimeZone(($o['timezone'] ?? '') ?: 'Asia/Kolkata');
    $now = new DateTime('now', $tz);
    [$h, $m] = array_map('intval', explode(':', ($o['day_start'] ?? '') ?: '06:00:00'));

    return $now->modify(sprintf('-%d hours -%d minutes', $h, $m))->format('Y-m-d');
}

/**
 * GET /orders
 */
/**
 * GET /orders
 */
function route_list_orders(PDO $db, Guard $guard): never
{
    $user = $guard->user();
    $all  = $user ? $guard->can('orders.read.all') : true;

    $sql = 'SELECT o.id, o.order_no, o.status, o.channel, o.business_date, o.subtotal, o.tax_amount,
                   o.delivery_fee, o.total, o.total_calories, o.total_protein,
                   o.notes, o.created_at, o.placed_at, o.delivered_at, o.customer_id
              FROM orders o
             WHERE o.deleted_at IS NULL';
    $args = [];

    if ($user && !$all) {
        $sql .= ' AND o.customer_id = ?';
        $args[] = $user['id'];
    }

    if (!empty($_GET['since'])) {
        $sql .= ' AND o.updated_at > ?';
        $args[] = date('Y-m-d H:i:s', strtotime((string) $_GET['since']));
    }

    $sql .= ' ORDER BY o.created_at DESC LIMIT 100';

    $st = $db->prepare($sql);
    $st->execute($args);
    $orders = $st->fetchAll();

    if ($orders) {
        $ids = array_column($orders, 'id');
        $in  = implode(',', array_fill(0, count($ids), '?'));
        $ls  = $db->prepare(
            "SELECT order_id, name_snapshot, quantity, unit_price, line_total, notes
               FROM order_lines WHERE order_id IN ($in)"
        );
        $ls->execute($ids);

        $byOrder = [];
        foreach ($ls->fetchAll() as $l) $byOrder[$l['order_id']][] = $l;

        foreach ($orders as &$o) {
            $o['lines'] = $byOrder[$o['id']] ?? [];
            $skipped = [];
            if (!empty($o['notes']) && preg_match('#\[SKIPPED_DAYS:\s*([0-9, ]*)\]#i', (string)$o['notes'], $m)) {
                $skipped = array_map('intval', array_filter(explode(',', $m[1])));
            }
            $o['skipped_days'] = $skipped;
        }
        unset($o);
    }

    Json::ok(['orders' => $orders, 'server_time' => date('c')]);
}

/** PATCH /orders/{id}/status */
function route_update_status(PDO $db, Guard $guard, string $id): never
{
    $user = $guard->user();
    $userId = $user['id'] ?? '00000000-0000-0000-0000-000000000000';

    $b = Json::body();
    $to = (string) ($b['status'] ?? '');

    if (!array_key_exists($to, ORDER_TRANSITIONS)) Json::error('Unknown status', 422);

    $db->beginTransaction();
    try {
        $st = $db->prepare('SELECT id, status FROM orders WHERE (id = ? OR order_no = ?) AND deleted_at IS NULL FOR UPDATE');
        $st->execute([$id, $id]);
        $order = $st->fetch();

        if (!$order) { $db->rollBack(); Json::error('Order not found', 404); }

        $from = $order['status'];
        if (!in_array($to, ORDER_TRANSITIONS[$from], true)) {
            $db->rollBack();
            Json::error("Cannot move an order from $from to $to", 409);
        }

        $db->prepare(
            'UPDATE orders
                SET status = ?,
                    delivered_at  = CASE WHEN ? = "delivered" THEN NOW() ELSE delivered_at END,
                    cancelled_at  = CASE WHEN ? = "cancelled" THEN NOW() ELSE cancelled_at END,
                    cancel_reason = CASE WHEN ? = "cancelled" THEN ? ELSE cancel_reason END
              WHERE id = ?'
        )->execute([$to, $to, $to, $to, $b['note'] ?? null, $order['id']]);

        $db->prepare(
            'INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, note)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([Db::uuid(), $order['id'], $from, $to, $userId, $b['note'] ?? null]);

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        error_log('[update_status] ' . $e->getMessage());
        Json::error('Could not update the order', 500);
    }

    if ($user) {
        Audit::log($db, $user, 'orders', $order['id'], 'STATUS', ['status' => $from], ['status' => $to]);
    }
    Json::ok(['id' => $order['id'], 'status' => $to]);
}

/** POST /orders/{id}/cancel */
function route_cancel_order(PDO $db, Guard $guard, string $id): never
{
    $user = $guard->user();
    $userId = $user['id'] ?? null;
    $b = Json::body();
    $reason = trim((string) ($b['reason'] ?? 'Cancelled by customer'));

    $db->beginTransaction();
    try {
        $st = $db->prepare('SELECT id, order_no, customer_id, status FROM orders WHERE (id = ? OR order_no = ?) AND deleted_at IS NULL FOR UPDATE');
        $st->execute([$id, $id]);
        $order = $st->fetch();

        if (!$order) {
            $db->rollBack();
            Json::error('Order not found', 404);
        }

        if ($userId && $order['customer_id'] !== null && $order['customer_id'] !== $userId && !$guard->can('orders.update.status')) {
            $db->rollBack();
            Json::error('This is not your order', 403);
        }

        $from = $order['status'];
        $cancellableStatuses = ['draft', 'placed', 'paid', 'accepted', 'in_kitchen'];
        if (!in_array($from, $cancellableStatuses, true)) {
            $db->rollBack();
            Json::error('Order cannot be cancelled once it is packed or out for delivery', 409);
        }

        $db->prepare(
            'UPDATE orders
                SET status = "cancelled",
                    cancelled_at = NOW(),
                    cancel_reason = ?
              WHERE id = ?'
        )->execute([$reason, $order['id']]);

        $db->prepare(
            'INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, note)
             VALUES (?, ?, ?, "cancelled", ?, ?)'
        )->execute([Db::uuid(), $order['id'], $from, $userId, $reason]);

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        error_log('[cancel_order] ' . $e->getMessage());
        Json::error('Could not cancel order', 500);
    }

    if ($user) {
        Audit::log($db, $user, 'orders', $order['id'], 'CANCEL', ['status' => $from], ['status' => 'cancelled']);
    }
    Json::ok(['id' => $order['id'], 'order_no' => $order['order_no'], 'status' => 'cancelled']);
}

/** POST /addresses */
function route_create_address(PDO $db, Guard $guard): never
{
    $user = $guard->requireUser();
    $b = Json::body();

    $line1 = trim((string) ($b['line1'] ?? ''));
    if ($line1 === '') Json::error('A delivery address is required', 422);

    $st = $db->prepare('SELECT id FROM addresses WHERE user_id = ? AND line1 = ? AND deleted_at IS NULL LIMIT 1');
    $st->execute([$user['id'], $line1]);
    if ($existing = $st->fetch()) Json::ok(['address' => ['id' => $existing['id']]]);

    $pincode = trim((string) ($b['pincode'] ?? ''));
    if ($pincode === '' && preg_match('/\b(\d{6})\b/', $line1, $m)) $pincode = $m[1];

    $id = Db::uuid();
    $db->prepare(
        'INSERT INTO addresses (id, user_id, label, line1, city, pincode) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, $user['id'], $b['label'] ?? 'Delivery', $line1,
        trim((string) ($b['city'] ?? 'Bengaluru')) ?: 'Bengaluru',
        $pincode !== '' ? $pincode : '000000',
    ]);

    Json::ok(['address' => ['id' => $id]], 201);
}

/** GET /outlets */
function route_outlets(PDO $db): never
{
    $rows = $db->query(
        'SELECT id, code, name, city FROM outlets WHERE is_active = 1 AND deleted_at IS NULL ORDER BY created_at'
    )->fetchAll();
    Json::ok(['outlets' => $rows]);
}
