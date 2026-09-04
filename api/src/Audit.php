<?php
/**
 * Append-only trail of who changed what.
 *
 * In Postgres this was a database trigger, so it caught every write including
 * ones made directly in a SQL console. Here it is called from the API, which
 * means a change made straight in phpMyAdmin will NOT be recorded. Treat
 * phpMyAdmin as a break-glass tool and make changes through the app.
 */
final class Audit
{
    public static function log(
        PDO $db, ?array $actor, string $table, ?string $recordId,
        string $action, ?array $before = null, ?array $after = null
    ): void {
        try {
            $st = $db->prepare(
                'INSERT INTO audit_log (actor_id, actor_role, table_name, record_id, action, before_json, after_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $st->execute([
                $actor['id']   ?? null,
                $actor['role'] ?? null,
                $table,
                $recordId,
                $action,
                $before !== null ? json_encode($before) : null,
                $after  !== null ? json_encode($after)  : null,
            ]);
        } catch (Throwable $e) {
            // Auditing must never take down the request it is recording.
            error_log('[audit] ' . $e->getMessage());
        }
    }
}
