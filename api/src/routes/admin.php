<?php
/** GET /admin/staff — requires staff.manage. */
function route_list_staff(PDO $db, Guard $guard): never
{
    $guard->requirePermission('staff.manage');
    $rows = $db->query(
        "SELECT id, email, full_name, phone, role, is_active, created_at
           FROM users WHERE deleted_at IS NULL AND role <> 'customer' ORDER BY created_at"
    )->fetchAll();
    Json::ok(['staff' => $rows]);
}

/** PATCH /admin/users/{id}/role — the only way a role ever changes. */
function route_set_role(PDO $db, Guard $guard, string $id): never
{
    $actor = $guard->requirePermission('staff.manage');
    $b = Json::body();
    $role = (string) ($b['role'] ?? '');

    $valid = ['customer','kitchen_staff','delivery_rider','dietitian',
              'inventory_manager','accountant','store_manager','owner'];
    if (!in_array($role, $valid, true)) Json::error('Unknown role', 422);

    // You cannot change your own role. Stops an owner locking themselves out,
    // and stops a compromised session quietly escalating and covering tracks.
    if ($id === $actor['id']) Json::error('You cannot change your own role', 403);

    $st = $db->prepare('SELECT id, email, role FROM users WHERE id = ? AND deleted_at IS NULL');
    $st->execute([$id]);
    $before = $st->fetch();
    if (!$before) Json::error('User not found', 404);

    $db->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $id]);
    Audit::log($db, $actor, 'users', $id, 'ROLE', $before, ['role' => $role]);

    Json::ok(['id' => $id, 'role' => $role]);
}

/** GET /admin/customers — requires customers.read. */
function route_list_customers(PDO $db, Guard $guard): never
{
    $guard->requirePermission('customers.read');
    $rows = $db->query(
        "SELECT u.id, u.email, u.full_name, u.phone, u.created_at,
                COUNT(o.id) AS orders_count, COALESCE(SUM(o.total), 0) AS total_spent,
                MAX(o.created_at) AS last_order_at
           FROM users u
      LEFT JOIN orders o ON o.customer_id = u.id AND o.deleted_at IS NULL
          WHERE u.role = 'customer' AND u.deleted_at IS NULL
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200"
    )->fetchAll();

    if ($rows) {
        $uids = array_column($rows, 'id');
        $in = implode(',', array_fill(0, count($uids), '?'));

        // Batch fetch primary addresses
        $stAddr = $db->prepare(
            "SELECT user_id, line1
               FROM addresses
              WHERE user_id IN ($in) AND deleted_at IS NULL
           ORDER BY created_at DESC"
        );
        $stAddr->execute($uids);
        $addresses = [];
        foreach ($stAddr->fetchAll() as $a) {
            if (!isset($addresses[$a['user_id']])) {
                $addresses[$a['user_id']] = $a['line1'];
            }
        }

        // Batch fetch subscription counts
        $stSub = $db->prepare(
            "SELECT sub_o.customer_id, COUNT(DISTINCT sub_o.id) AS cnt
               FROM orders sub_o
               JOIN order_lines sub_l ON sub_l.order_id = sub_o.id
              WHERE sub_o.customer_id IN ($in) AND sub_o.deleted_at IS NULL
                AND (sub_l.name_snapshot LIKE '%Subscription%' OR sub_l.name_snapshot LIKE '%Plan%')
           GROUP BY sub_o.customer_id"
        );
        $stSub->execute($uids);
        $subCounts = [];
        foreach ($stSub->fetchAll() as $s) {
            $subCounts[$s['customer_id']] = (int) $s['cnt'];
        }

        foreach ($rows as &$r) {
            $r['address'] = $addresses[$r['id']] ?? null;
            $r['subscription_count'] = $subCounts[$r['id']] ?? 0;
        }
        unset($r);
    }

    Json::ok(['customers' => $rows]);
}

/** GET /admin/customers/{id}/orders — requires customers.read. */
function route_customer_orders(PDO $db, Guard $guard, string $customerId): never
{
    $guard->requirePermission('customers.read');

    $st = $db->prepare(
        'SELECT o.id, o.order_no, o.status, o.business_date, o.subtotal, o.tax_amount,
                o.delivery_fee, o.total, o.total_calories, o.total_protein,
                o.notes, o.created_at, o.placed_at, o.delivered_at
           FROM orders o
          WHERE o.customer_id = ? AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC LIMIT 100'
    );
    $st->execute([$customerId]);
    $orders = $st->fetchAll();

    if ($orders) {
        $ids = array_column($orders, 'id');
        $in  = implode(',', array_fill(0, count($ids), '?'));
        $ls  = $db->prepare(
            "SELECT order_id, name_snapshot, quantity, unit_price, line_total
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

    Json::ok(['orders' => $orders]);
}

/** GET /admin/audit — requires audit.read. */
function route_audit(PDO $db, Guard $guard): never
{
    $guard->requirePermission('audit.read');
    $rows = $db->query(
        'SELECT id, occurred_at, actor_id, actor_role, table_name, record_id, action
           FROM audit_log ORDER BY id DESC LIMIT 200'
    )->fetchAll();
    Json::ok(['entries' => $rows]);
}
