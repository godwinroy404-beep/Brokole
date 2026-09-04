<?php
/**
 * Brokole — migration runner.
 *
 * Applies every .sql file in api/migrations/ that hasn't been applied yet,
 * in filename order, and records what it did. Safe to run repeatedly.
 *
 * Run it from the project root:
 *
 *     php api/migrate.php
 *     php api/migrate.php --status     (list without applying anything)
 *
 * Command line only — it refuses to run over HTTP, because a URL that can
 * change your schema is a URL someone else can find.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('migrate.php can only be run from the command line.');
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    fwrite(STDERR, "No api/config.php found. Copy config.sample.php to config.php first.\n");
    exit(1);
}
$cfg = require $configPath;

$statusOnly = in_array('--status', $argv ?? [], true);

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $cfg['db_host'], $cfg['db_name']),
        $cfg['db_user'],
        $cfg['db_pass'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Without this, a migration that ends in a SELECT leaves an open
            // cursor and the NEXT statement dies with "Cannot execute queries
            // while other unbuffered queries are active".
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
        ]
    );
} catch (PDOException $e) {
    fwrite(STDERR, "Could not connect to '{$cfg['db_name']}' on {$cfg['db_host']}:\n  {$e->getMessage()}\n");
    exit(1);
}

echo "Database: {$cfg['db_name']} on {$cfg['db_host']}\n\n";

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(190) NOT NULL PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

$applied = array_column($pdo->query('SELECT filename FROM schema_migrations')->fetchAll(), 'filename');

$files = glob(__DIR__ . '/migrations/*.sql') ?: [];
sort($files);

if (!$files) {
    echo "No migration files in api/migrations/.\n";
    exit(0);
}

/**
 * Splits a script into statements on semicolons, ignoring any that sit inside
 * quotes, backticks or comments. A naive explode(';') mangles perfectly valid
 * SQL and produces errors that are miserable to diagnose.
 */
function split_statements(string $sql): array
{
    $statements = [];
    $current = '';
    $len = strlen($sql);
    $quote = null;

    for ($i = 0; $i < $len; $i++) {
        $ch = $sql[$i];
        $next = $i + 1 < $len ? $sql[$i + 1] : '';

        if ($quote === null) {
            if ($ch === '-' && $next === '-') {                 // -- line comment
                while ($i < $len && $sql[$i] !== "\n") $i++;
                $current .= "\n";
                continue;
            }
            if ($ch === '/' && $next === '*') {                 // /* block comment */
                $i += 2;
                while ($i < $len - 1 && !($sql[$i] === '*' && $sql[$i + 1] === '/')) $i++;
                $i++;
                continue;
            }
            if ($ch === "'" || $ch === '"' || $ch === '`') { $quote = $ch; }
            elseif ($ch === ';') {
                if (trim($current) !== '') $statements[] = trim($current);
                $current = '';
                continue;
            }
        } else {
            if ($ch === '\\') { $current .= $ch . $next; $i++; continue; }   // escaped char
            if ($ch === $quote) $quote = null;
        }

        $current .= $ch;
    }

    if (trim($current) !== '') $statements[] = trim($current);
    return $statements;
}

$pending = 0;

foreach ($files as $file) {
    $name = basename($file);

    if (in_array($name, $applied, true)) {
        echo "  [done]    $name\n";
        continue;
    }

    $pending++;

    if ($statusOnly) {
        echo "  [PENDING] $name\n";
        continue;
    }

    echo "  [running] $name ... ";
    $statements = split_statements((string) file_get_contents($file));

    try {
        foreach ($statements as $statement) {
            // query() rather than exec() so verification SELECTs inside a
            // migration work; the result is drained so the cursor closes.
            $stmt = $pdo->query($statement);
            if ($stmt instanceof PDOStatement) {
                do { $stmt->fetchAll(); } while ($stmt->nextRowset());
                $stmt->closeCursor();
            }
        }
        $pdo->prepare('INSERT INTO schema_migrations (filename) VALUES (?)')->execute([$name]);
        echo "ok (" . count($statements) . " statements)\n";
    } catch (PDOException $e) {
        echo "FAILED\n";
        fwrite(STDERR, "\n  {$e->getMessage()}\n\n");
        fwrite(STDERR, "Nothing was recorded for $name, so fix the cause and run migrate.php again.\n");
        exit(1);
    }
}

echo "\n";
if ($statusOnly) {
    echo $pending ? "$pending migration(s) pending. Run: php api/migrate.php\n"
                  : "Everything is up to date.\n";
} else {
    echo $pending ? "Applied $pending migration(s).\n" : "Nothing to do — already up to date.\n";
}
