<?php
declare(strict_types=1);

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json');
    exit(json_encode(['error' => 'API not configured: copy config.sample.php to config.php and fill it in.']));
}
$cfg = require $configPath;

/**
 * Errors are never PRINTED — they are logged and returned as JSON.
 *
 * With display_errors on, an uncaught exception wrote an HTML fatal-error page
 * straight into the response body (and PHP still sent HTTP 200), so the client
 * got "Unexpected token '<' ... is not valid JSON" and no clue what happened.
 * An API must answer with JSON and a truthful status code, always.
 */
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Anything that manages to print is discarded before we emit the real response.
if (!headers_sent() && isset($_SERVER['HTTP_ACCEPT_ENCODING']) && str_contains($_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip')) {
    ob_start('ob_gzhandler');
} else {
    ob_start();
}

require __DIR__ . '/src/Json.php';
require __DIR__ . '/src/Db.php';
require __DIR__ . '/src/Jwt.php';
require __DIR__ . '/src/Guard.php';
require __DIR__ . '/src/Audit.php';
require __DIR__ . '/src/routes/auth.php';
require __DIR__ . '/src/routes/menu.php';
require __DIR__ . '/src/routes/orders.php';
require __DIR__ . '/src/routes/admin.php';
require __DIR__ . '/src/routes/skips.php';
require __DIR__ . '/src/routes/sales.php';
require __DIR__ . '/src/routes/inventory.php';

/** Turns any failure into a JSON response with an honest status code. */
$fail = function (string $detail, string $friendly = 'Something went wrong on the server.') use ($cfg): void {
    error_log('[brokole] ' . $detail);

    if (ob_get_length() !== false) ob_clean();   // drop any stray output

    $message = $friendly;

    // The single most likely cause during setup: a migration hasn't been run.
    if (str_contains($detail, '42S02') || str_contains($detail, "doesn't exist")) {
        $message = 'The database is missing a table. Run the files in api/migrations/ '
                 . 'in phpMyAdmin, then try again.';
    } elseif (str_contains($detail, '42S22')) {
        $message = 'The database is missing a column. Run the files in api/migrations/ '
                 . 'in phpMyAdmin, then try again.';
    }

    if (!empty($cfg['debug'])) {
        $message .= ' [' . $detail . ']';
    }

    Json::error($message, 500);
};

set_exception_handler(function (Throwable $e) use ($fail): void {
    $fail(get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
});

register_shutdown_function(function () use ($fail): void {
    $err = error_get_last();
    if (!$err || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    if (headers_sent()) return;
    $fail($err['message'] . ' @ ' . basename($err['file']) . ':' . $err['line']);
});

// ── CORS ────────────────────────────────────────────────────────────────────
// Strictly allowlisted. A wildcard here would let any website on the internet
// make authenticated calls with your users' tokens.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $cfg['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Max-Age: 86400');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// ── routing ─────────────────────────────────────────────────────────────────
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($base !== '' && str_starts_with($path, $base)) $path = substr($path, strlen($base));
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$db = Db::conn($cfg);
$guard = new Guard($db, $cfg['jwt_secret']);

// ── endpoints ───────────────────────────────────────────────────────────────
if ($method === 'GET'  && $path === '/health')      Json::ok(['ok' => true, 'time' => date('c')]);

if ($method === 'POST' && $path === '/auth/register') route_register($db, $cfg);
if ($method === 'POST' && $path === '/auth/login')    route_login($db, $cfg);
if ($method === 'GET'  && $path === '/auth/me')       route_me($db, $guard);

if ($method === 'GET'  && $path === '/menu')       route_menu($db, $guard);
if ($method === 'GET'  && $path === '/categories') route_categories($db);
if ($method === 'GET'  && $path === '/outlets')    route_outlets($db);

if ($method === 'GET'  && $path === '/orders')     route_list_orders($db, $guard);
if ($method === 'POST' && $path === '/orders')     route_place_order($db, $guard);
if ($method === 'POST' && $path === '/addresses')  route_create_address($db, $guard);

if ($method === 'PATCH' && preg_match('#^/orders/([0-9a-f-]{36})/status$#i', $path, $m)) {
    route_update_status($db, $guard, $m[1]);
}
if ($method === 'POST' && preg_match('#^/orders/([^/]+)/cancel$#i', $path, $m)) {
    route_cancel_order($db, $guard, $m[1]);
}
// /orders/{id}/skip-day is retired: it wrote a "[SKIPPED_DAYS: 3,5]" tag into
// orders.notes. Skips now live in the subscription_skips table via /me/skips.
if ($method === 'POST'  && $path === '/admin/menu') route_menu_create($db, $guard);
if ($method === 'PATCH' && preg_match('#^/admin/menu/([0-9a-f-]{36})$#i', $path, $m)) {
    route_menu_update($db, $guard, $m[1]);
}
if ($method === 'DELETE' && preg_match('#^/admin/menu/([0-9a-f-]{36})$#i', $path, $m)) {
    route_menu_delete($db, $guard, $m[1]);
}
if ($method === 'PATCH' && preg_match('#^/admin/users/([0-9a-f-]{36})/role$#i', $path, $m)) {
    route_set_role($db, $guard, $m[1]);
}
if ($method === 'GET' && $path === '/me/skips')  route_list_my_skips($db, $guard);
if ($method === 'PUT' && $path === '/me/skips')  route_set_my_skip($db, $guard);
if ($method === 'GET' && $path === '/admin/skips') route_admin_skips($db, $guard);
if ($method === 'GET' && $path === '/admin/sales') route_sales_report($db, $guard);

if ($method === 'GET'  && $path === '/admin/inventory') route_list_inventory($db, $guard);
if ($method === 'POST' && $path === '/admin/inventory') route_create_ingredient($db, $guard);
if (($method === 'PATCH' || $method === 'PUT') && preg_match('#^/admin/inventory/([0-9a-f-]{36})$#i', $path, $m)) {
    route_update_ingredient($db, $guard, $m[1]);
}
if ($method === 'DELETE' && preg_match('#^/admin/inventory/([0-9a-f-]{36})$#i', $path, $m)) {
    route_delete_ingredient($db, $guard, $m[1]);
}
if ($method === 'POST' && preg_match('#^/admin/inventory/([0-9a-f-]{36})/movements$#i', $path, $m)) {
    route_create_movement($db, $guard, $m[1]);
}
if ($method === 'GET' && preg_match('#^/admin/inventory/([0-9a-f-]{36})/movements$#i', $path, $m)) {
    route_list_movements($db, $guard, $m[1]);
}

if ($method === 'GET' && $path === '/admin/staff')     route_list_staff($db, $guard);
if ($method === 'GET' && $path === '/admin/customers') route_list_customers($db, $guard);
if ($method === 'GET' && preg_match('#^/admin/customers/([0-9a-f-]{36})/orders$#i', $path, $m)) {
    route_customer_orders($db, $guard, $m[1]);
}
if ($method === 'GET' && $path === '/admin/audit')     route_audit($db, $guard);

Json::error('Not found', 404);
