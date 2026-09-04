<?php
final class Db
{
    private static ?PDO $pdo = null;

    public static function conn(array $config): PDO
    {
        if (self::$pdo instanceof PDO) return self::$pdo;

        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=utf8mb4',
            $config['db_host'],
            $config['db_name']
        );

        try {
            self::$pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // Real prepared statements, not client-side interpolation.
                // With this off, PDO would build the SQL string itself and the
                // protection against injection depends on its escaping instead
                // of the server never seeing the value as SQL.
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            Json::error('Database unavailable', 503);
        }

        return self::$pdo;
    }

    /** RFC-4122 v4, generated in PHP so IDs never depend on DB defaults. */
    public static function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }
}
