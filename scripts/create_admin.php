<?php
$cfg = require __DIR__ . '/../api/config.php';
require __DIR__ . '/../api/src/Db.php';

$db = Db::conn($cfg);
$hash = password_hash('admin12345', PASSWORD_DEFAULT);
$email = 'admin@brokole.com';

$st = $db->prepare('SELECT id FROM users WHERE email = ?');
$st->execute([$email]);
$user = $st->fetch();

if ($user) {
    $st = $db->prepare('UPDATE users SET role = "owner", password_hash = ? WHERE email = ?');
    $st->execute([$hash, $email]);
    echo "Updated existing user admin@brokole.com to owner role.\n";
} else {
    $st = $db->prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)');
    $st->execute([Db::uuid(), $email, $hash, 'Brokole Admin', 'owner']);
    echo "Created new owner user admin@brokole.com.\n";
}
