<?php
/** POST /auth/register — always creates a customer. Role is never taken from input. */
function route_register(PDO $db, array $cfg): never
{
    $b = Json::body();
    $email = strtolower(trim($b['email'] ?? ''));
    $pass  = (string) ($b['password'] ?? '');
    $name  = trim($b['full_name'] ?? $b['name'] ?? '');
    $phone = trim($b['phone'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Json::error('Enter a valid email address', 422);
    if (strlen($pass) < 8) Json::error('Password must be at least 8 characters', 422);

    $st = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $st->execute([$email]);
    if ($st->fetch()) Json::error('That email is already registered', 409);

    $id = Db::uuid();
    $db->prepare(
        'INSERT INTO users (id, email, password_hash, full_name, phone, role)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, $email, password_hash($pass, PASSWORD_DEFAULT),
        $name !== '' ? $name : null,
        $phone !== '' ? $phone : null,
        // Hardcoded. Anything the client sent as "role" is ignored entirely.
        'customer',
    ]);

    $user = ['id' => $id, 'email' => $email, 'full_name' => $name, 'phone' => $phone, 'role' => 'customer'];
    Audit::log($db, $user, 'users', $id, 'REGISTER', null, ['email' => $email, 'role' => 'customer']);

    Json::ok([
        'token' => Jwt::sign(['sub' => $id], $cfg['jwt_secret'], $cfg['jwt_ttl']),
        'user'  => $user,
    ], 201);
}

/** POST /auth/login */
function route_login(PDO $db, array $cfg): never
{
    $b = Json::body();
    $email = strtolower(trim($b['email'] ?? ''));
    $pass  = (string) ($b['password'] ?? '');
    $ip    = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    // Throttle before doing any work. Without RLS, a leaked password is total
    // access, so brute force has to be expensive.
    $st = $db->prepare(
        'SELECT COUNT(*) AS n FROM login_attempts
          WHERE email = ? AND succeeded = 0 AND attempted_at > (NOW() - INTERVAL 15 MINUTE)'
    );
    $st->execute([$email]);
    if ((int) $st->fetch()['n'] >= 8) {
        Json::error('Too many failed attempts. Try again in 15 minutes.', 429);
    }

    $st = $db->prepare(
        'SELECT id, email, password_hash, full_name, phone, role, is_active
           FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1'
    );
    $st->execute([$email]);
    $user = $st->fetch();

    $record = $db->prepare('INSERT INTO login_attempts (email, ip, succeeded) VALUES (?, ?, ?)');

    // password_verify against a dummy hash when the user is missing, so the
    // response time doesn't reveal whether the account exists.
    $hash = $user['password_hash'] ?? '$2y$12$'.str_repeat('x', 53);
    $valid = password_verify($pass, $hash) && $user && (int) $user['is_active'] === 1;

    if (!$valid) {
        $record->execute([$email, $ip, 0]);
        // Same message either way: no account enumeration.
        Json::error('Invalid email or password', 401);
    }

    $record->execute([$email, $ip, 1]);
    unset($user['password_hash'], $user['is_active']);

    Json::ok([
        'token' => Jwt::sign(['sub' => $user['id']], $cfg['jwt_secret'], $cfg['jwt_ttl']),
        'user'  => $user,
    ]);
}

/** GET /auth/me — current user plus their permission list. */
function route_me(PDO $db, Guard $guard): never
{
    $user = $guard->requireUser();
    Json::ok(['user' => $user, 'permissions' => $guard->permissions()]);
}
