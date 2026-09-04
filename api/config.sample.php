<?php
/**
 * Copy this file to config.php and fill in your own values.
 * config.php must NEVER be committed or served — the .htaccess blocks it.
 */
return [
    // hPanel -> Databases -> MySQL Databases (Hostinger prefixes both names)
    'db_host' => 'localhost',
    'db_name' => 'uXXXXXXXX_brokole',
    'db_user' => 'uXXXXXXXX_brokole',
    'db_pass' => 'YOUR-DATABASE-PASSWORD',

    /**
     * Signs the login tokens. Generate a fresh random one — never reuse an
     * example. On any machine with PHP:
     *     php -r "echo bin2hex(random_bytes(32));"
     * Changing it later signs everyone out, which is a fine emergency measure.
     */
    'jwt_secret' => 'REPLACE-ME-WITH-64-RANDOM-HEX-CHARACTERS',
    'jwt_ttl'    => 43200, // 12 hours

    /**
     * Only these origins may call the API from a browser. Keep it tight: this
     * is what stops another site making authenticated requests as your users.
     */
    'allowed_origins' => [
        'http://localhost:5174',
        'http://localhost:5175',
        // 'https://brokole.com',
        // 'https://admin.brokole.com',
    ],

    // Set false once you are live so errors aren't shown to users.
    'debug' => true,
];
