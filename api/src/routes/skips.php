<?php
/**
 * Meal-plan skip days.
 *
 * Every row is scoped to the signed-in customer. There is no RLS here, so the
 * user_id filter in each query IS the access control — removing it would let
 * any customer read or change anyone else's schedule.
 */

/** How far ahead a customer may plan. */
const SKIP_HORIZON_DAYS = 90;

/** Validates YYYY-MM-DD and that it is a real calendar date. */
function valid_skip_date(string $date): bool
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return false;
    [$y, $m, $d] = array_map('intval', explode('-', $date));
    return checkdate($m, $d, $y);
}

/** GET /me/skips?from=YYYY-MM-DD&to=YYYY-MM-DD */
function route_list_my_skips(PDO $db, Guard $guard): never
{
    $user = $guard->requireUser();

    $from = (string) ($_GET['from'] ?? date('Y-m-d'));
    $to   = (string) ($_GET['to']   ?? date('Y-m-d', strtotime('+' . SKIP_HORIZON_DAYS . ' days')));

    if (!valid_skip_date($from) || !valid_skip_date($to)) {
        Json::error('Dates must be YYYY-MM-DD', 422);
    }

    $st = $db->prepare(
        'SELECT skip_date, order_id, reason
           FROM subscription_skips
          WHERE user_id = ? AND skip_date BETWEEN ? AND ?
          ORDER BY skip_date'
    );
    $st->execute([$user['id'], $from, $to]);

    Json::ok(['skips' => $st->fetchAll(), 'from' => $from, 'to' => $to]);
}

/**
 * PUT /me/skips   { "date": "2026-09-08", "skipped": true, "order_id": "..." }
 *
 * Idempotent: setting a day that is already in that state is a no-op success,
 * so a double tap or a retried request cannot produce a wrong result.
 */
function route_set_my_skip(PDO $db, Guard $guard): never
{
    $user = $guard->requireUser();
    $b = Json::body();

    $date = trim((string) ($b['date'] ?? ''));
    if (!valid_skip_date($date)) Json::error('date must be YYYY-MM-DD', 422);

    $skipped = !empty($b['skipped']);
    $today   = date('Y-m-d');

    // The kitchen plans the day before; a day already cooked cannot be skipped.
    if ($date < $today) Json::error('That day has already passed', 422);
    if ($date > date('Y-m-d', strtotime('+' . SKIP_HORIZON_DAYS . ' days'))) {
        Json::error('You can only plan ' . SKIP_HORIZON_DAYS . ' days ahead', 422);
    }

    /**
     * An order reference, if supplied, must be one of this customer's own.
     *
     * Accepts EITHER the database id or the human-readable order_no. The UI
     * shows the order number, so a caller passing what it displays is an easy
     * and harmless mistake — it used to fail the ownership check and surface as
     * a confusing "That order is not yours". Both lookups stay scoped to
     * customer_id, so this is no less strict about whose order it is.
     */
    $orderRef = $b['order_id'] ?? null;
    $orderId  = null;

    if ($orderRef) {
        $st = $db->prepare(
            'SELECT id FROM orders
              WHERE (id = ? OR order_no = ?) AND customer_id = ? AND deleted_at IS NULL
              LIMIT 1'
        );
        $st->execute([$orderRef, $orderRef, $user['id']]);
        $row = $st->fetch();
        if (!$row) Json::error('That order is not yours', 403);
        $orderId = $row['id'];
    }

    if ($skipped) {
        $db->prepare(
            'INSERT INTO subscription_skips (id, user_id, order_id, skip_date, reason)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE order_id = VALUES(order_id)'
        )->execute([
            Db::uuid(), $user['id'], $orderId ?: null, $date,
            isset($b['reason']) ? mb_substr((string) $b['reason'], 0, 255) : null,
        ]);
    } else {
        $db->prepare('DELETE FROM subscription_skips WHERE user_id = ? AND skip_date = ?')
           ->execute([$user['id'], $date]);
    }

    Audit::log($db, $user, 'subscription_skips', $date, $skipped ? 'SKIP' : 'UNSKIP', null, ['date' => $date]);

    Json::ok(['date' => $date, 'skipped' => $skipped]);
}

/**
 * GET /admin/skips?date=YYYY-MM-DD
 * What the kitchen needs before it starts prepping: who is not eating today.
 */
function route_admin_skips(PDO $db, Guard $guard): never
{
    $guard->requirePermission('orders.read.all');

    // ?date=  one day (what the kitchen asks each morning)
    // ?from=&to=  a range (what the subscriptions screen shows)
    if (isset($_GET['from']) || isset($_GET['to'])) {
        $from = (string) ($_GET['from'] ?? date('Y-m-d'));
        $to   = (string) ($_GET['to']   ?? date('Y-m-d', strtotime('+30 days')));
    } else {
        $from = $to = (string) ($_GET['date'] ?? date('Y-m-d'));
    }

    if (!valid_skip_date($from) || !valid_skip_date($to)) {
        Json::error('Dates must be YYYY-MM-DD', 422);
    }
    if ($from > $to) Json::error('"from" must not be after "to"', 422);

    $st = $db->prepare(
        'SELECT s.skip_date, s.order_id, s.reason,
                u.id AS user_id, u.full_name, u.email, u.phone
           FROM subscription_skips s
           JOIN users u ON u.id = s.user_id
          WHERE s.skip_date BETWEEN ? AND ?
          ORDER BY s.skip_date, u.full_name'
    );
    $st->execute([$from, $to]);
    $rows = $st->fetchAll();

    Json::ok(['from' => $from, 'to' => $to, 'date' => $from, 'count' => count($rows), 'skips' => $rows]);
}
