<?php
/**
 * Script to clear all Order History, Order Lines, Status Logs, and Stock Movement Transaction Ledgers.
 */
if (php_sapi_name() !== 'cli') {
    exit('Can only be run from CLI.');
}

$configPath = __DIR__ . '/../api/config.php';
if (!is_file($configPath)) {
    echo "No api/config.php found.\n";
    exit(1);
}
$cfg = require $configPath;

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $cfg['db_host'], $cfg['db_name']),
        $cfg['db_user'],
        $cfg['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $pdo->exec('TRUNCATE TABLE order_lines');
    $pdo->exec('TRUNCATE TABLE order_status_history');
    $pdo->exec('TRUNCATE TABLE subscription_skips');
    $pdo->exec('TRUNCATE TABLE stock_movements');
    $pdo->exec('TRUNCATE TABLE orders');
    $pdo->exec('TRUNCATE TABLE order_no_seq');
    $pdo->exec('ALTER TABLE order_no_seq AUTO_INCREMENT = 1000');
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    echo "SUCCESS: All Order History, Order Lines, Status Logs & Stock Movement Transaction Ledgers cleared cleanly!\n";
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
