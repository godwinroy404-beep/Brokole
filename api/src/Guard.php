<?php
/**
 * The security boundary.
 *
 * In the Postgres build this job belonged to Row Level Security: the database
 * itself refused to return rows the caller shouldn't see, so a bug in a handler
 * could not leak data. MySQL has no such feature, so every rule lives here and
 * every protected handler MUST call one of these methods first. Nothing else
 * stands between a request and the whole table.
 */
final class Guard
{
    private PDO $db;
    private string $secret;
    private ?array $user = null;
    private ?array $permissions = null;

    public function __construct(PDO $db, string $secret)
    {
        $this->db = $db;
        $this->secret = $secret;
    }

    private function bearer(): ?string
    {
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if ($h === '' && function_exists('apache_request_headers')) {
            foreach (apache_request_headers() as $k => $v) {
                if (strcasecmp($k, 'Authorization') === 0) { $h = $v; break; }
            }
        }
        return preg_match('/^Bearer\s+(\S+)$/i', $h, $m) ? $m[1] : null;
    }

    /** The signed-in user, or null. Role is re-read from the DB, never trusted from the token. */
    public function user(): ?array
    {
        if ($this->user !== null) return $this->user;

        $claims = Jwt::verify($this->bearer(), $this->secret);
        if (!$claims || empty($claims['sub'])) return null;

        // Deliberately NOT using the role inside the token. If an owner demotes
        // someone, that must take effect immediately, not when their token
        // happens to expire.
        $st = $this->db->prepare(
            'SELECT id, email, full_name, phone, role, is_active
               FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1'
        );
        $st->execute([$claims['sub']]);
        $row = $st->fetch();

        if (!$row || (int) $row['is_active'] !== 1) return null;

        return $this->user = $row;
    }

    public function requireUser(): array
    {
        $u = $this->user();
        if (!$u) Json::error('Sign in required', 401);
        return $u;
    }

    /** @return string[] */
    public function permissions(): array
    {
        if ($this->permissions !== null) return $this->permissions;

        $u = $this->user();
        if (!$u) return $this->permissions = [];

        $st = $this->db->prepare('SELECT permission_key FROM role_permissions WHERE role = ?');
        $st->execute([$u['role']]);

        return $this->permissions = array_column($st->fetchAll(), 'permission_key');
    }

    public function can(string $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }

    public function requirePermission(string $permission): array
    {
        $u = $this->requireUser();
        if (!$this->can($permission)) {
            Json::error('You do not have permission to do that', 403);
        }
        return $u;
    }

    /** Staff = anything that isn't a plain customer. Gate for the admin app. */
    public function requireStaff(): array
    {
        $u = $this->requireUser();
        if ($u['role'] === 'customer') {
            Json::error('This account has no access to the operations console', 403);
        }
        return $u;
    }
}
