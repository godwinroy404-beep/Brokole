<?php
final class Json
{
    public static function send(array $body, int $status = 200): never
    {
        // Discard anything a warning or stray echo may have written, so the
        // body is always valid JSON and never JSON with HTML glued in front.
        while (ob_get_level() > 0 && ob_get_length() !== false) {
            ob_clean();
            break;
        }

        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok(array $data = [], int $status = 200): never
    {
        self::send($data, $status);
    }

    /**
     * Error responses stay deliberately vague about *why* where it matters
     * (see Auth: a wrong email and a wrong password must look identical, or
     * the endpoint becomes an account-enumeration oracle).
     */
    public static function error(string $message, int $status = 400, array $extra = []): never
    {
        self::send(['error' => $message] + $extra, $status);
    }

    /** Reads and validates the JSON request body. */
    public static function body(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === '' || $raw === false) return [];
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) Json::error('Request body must be a JSON object', 400);
        return $decoded;
    }
}
