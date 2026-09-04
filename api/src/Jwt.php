<?php
/**
 * Minimal HS256 JWT. No Composer dependency — Hostinger shared hosting has no
 * reliable composer, and this is ~40 lines of well-understood code.
 */
final class Jwt
{
    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    private static function unb64(string $s): string
    {
        return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
    }

    public static function sign(array $claims, string $secret, int $ttl): string
    {
        $now = time();
        $payload = $claims + ['iat' => $now, 'exp' => $now + $ttl];

        $h = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $p = self::b64(json_encode($payload));
        $sig = self::b64(hash_hmac('sha256', "$h.$p", $secret, true));

        return "$h.$p.$sig";
    }

    /** Returns the claims, or null if the token is missing, forged or expired. */
    public static function verify(?string $token, string $secret): ?array
    {
        if (!$token) return null;

        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$h, $p, $sig] = $parts;

        $header = json_decode(self::unb64($h), true);
        // Reject "alg": "none" and algorithm-substitution attacks outright.
        if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') return null;

        $expected = self::b64(hash_hmac('sha256', "$h.$p", $secret, true));
        // Constant-time: a plain === leaks the signature one byte at a time.
        if (!hash_equals($expected, $sig)) return null;

        $claims = json_decode(self::unb64($p), true);
        if (!is_array($claims)) return null;
        if (!isset($claims['exp']) || time() >= (int) $claims['exp']) return null;

        return $claims;
    }
}
