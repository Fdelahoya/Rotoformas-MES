<?php
declare(strict_types=1);
return [
    // The deployment package replaces this placeholder with a hash, never the API key.
    'token_sha256' => 'REPLACE_WITH_SHA256_OF_API_TOKEN',
    'public_base' => 'https://qr.rotoformas.com',
    'target' => 'https://script.google.com/macros/s/AKfycbw5LAL2__An-gyUsq8qDYNKfYZ5tfJys8INv7__MpmHx32SuZWxonaFiygbsO92tBsN5Q/exec',
    'storage' => dirname(__DIR__) . '/rotoformas-qr-private',
];
