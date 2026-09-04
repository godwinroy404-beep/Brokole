<?php
/**
 * Sales reporting.
 *
 * Gated on finance.read, which kitchen staff and riders do not hold: they need
 * the live board, not revenue figures.
 *
 * Money rule: revenue counts DELIVERED orders only. An order that was placed
 * but cancelled never earned anything, and a refunded one gave it back — both
 * are reported separately rather than quietly folded into the total.
 */

const REVENUE_STATUSES = "'delivered'";

function valid_report_date(string $d): bool
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return false;
    [$y, $m, $day] = array_map('intval', explode('-', $d));
    return checkdate($m, $day, $y);
}

/** GET /admin/sales?from=YYYY-MM-DD&to=YYYY-MM-DD */
function route_sales_report(PDO $db, Guard $guard): never
{
    $guard->requirePermission('finance.read');

    $to   = (string) ($_GET['to']   ?? date('Y-m-d'));
    $from = (string) ($_GET['from'] ?? date('Y-m-d', strtotime('-29 days')));

    if (!valid_report_date($from) || !valid_report_date($to)) {
        Json::error('Dates must be YYYY-MM-DD', 422);
    }
    if ($from > $to) Json::error('"from" must not be after "to"', 422);

    // By business_date, not created_at: an order placed at 01:30 belongs to the
    // previous kitchen day, and the books have to agree with what was cooked.
    $window = 'business_date BETWEEN ? AND ? AND deleted_at IS NULL';

    $summary = $db->prepare(
        "SELECT
            COUNT(*)                  AS orders_total,
            SUM(status = 'delivered') AS orders_delivered,
            SUM(status = 'cancelled') AS orders_cancelled,
            SUM(status = 'refunded')  AS orders_refunded,
            COALESCE(SUM(CASE WHEN status IN (" . REVENUE_STATUSES . ") THEN subtotal      END), 0) AS net_sales,
            COALESCE(SUM(CASE WHEN status IN (" . REVENUE_STATUSES . ") THEN tax_amount    END), 0) AS gst_collected,
            COALESCE(SUM(CASE WHEN status IN (" . REVENUE_STATUSES . ") THEN delivery_fee  END), 0) AS delivery_fees,
            COALESCE(SUM(CASE WHEN status IN (" . REVENUE_STATUSES . ") THEN total         END), 0) AS gross_revenue,
            COALESCE(SUM(CASE WHEN status = 'refunded' THEN total END), 0)                          AS refunded_value,
            COALESCE(SUM(CASE WHEN status IN (" . REVENUE_STATUSES . ") THEN total_protein END), 0) AS protein_delivered
           FROM orders WHERE $window"
    );
    $summary->execute([$from, $to]);
    $totals = $summary->fetch() ?: [];

    $delivered = (int) ($totals['orders_delivered'] ?? 0);
    $totals['average_order_value'] = $delivered > 0
        ? round(((float) $totals['gross_revenue']) / $delivered, 2) : 0;

    $daily = $db->prepare(
        "SELECT business_date AS day, COUNT(*) AS orders,
                SUM(status = 'delivered') AS delivered,
                COALESCE(SUM(CASE WHEN status IN (" . REVENUE_STATUSES . ") THEN total END), 0) AS revenue
           FROM orders WHERE $window
       GROUP BY business_date ORDER BY business_date"
    );
    $daily->execute([$from, $to]);

    $orders = $db->prepare(
        "SELECT o.id, o.order_no, o.status, o.business_date, o.subtotal, o.tax_amount,
                o.delivery_fee, o.total, o.total_protein, o.delivered_at, o.created_at,
                u.full_name AS customer_name, u.email AS customer_email
           FROM orders o
      LEFT JOIN users u ON u.id = o.customer_id
          WHERE o.business_date BETWEEN ? AND ? AND o.deleted_at IS NULL
            AND o.status IN ('delivered','refunded','cancelled')
       ORDER BY o.business_date DESC, o.created_at DESC LIMIT 500"
    );
    $orders->execute([$from, $to]);

    Json::ok([
        'from' => $from, 'to' => $to,
        'summary' => $totals,
        'daily' => $daily->fetchAll(),
        'orders' => $orders->fetchAll(),
    ]);
}
