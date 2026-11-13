<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

function reply(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $config = require __DIR__ . '/config.php';
    require __DIR__ . '/service.php';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $secure = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['SERVER_PORT'] ?? '') === '443';
    // No forwarded headers or client-supplied host are trusted.
    if (!$secure && !($config['local_test'] ?? false)) {
        if (!in_array($method, ['GET', 'HEAD'], true)) {
            reply(426, ['ok' => false, 'message' => 'Se requiere HTTPS.']);
        }
        header('Location: ' . $config['public_base'] . (is_string($path) ? $path : '/'), true, 308);
        exit;
    }
    if (($_SERVER['QUERY_STRING'] ?? '') !== '') {
        reply(404, ['ok' => false, 'message' => 'Enlace no encontrado.']);
    }
    if ($path === '/' && in_array($method, ['GET', 'HEAD'], true)) {
        header('Content-Type: text/html; charset=utf-8');
        if ($method === 'GET') {
            echo '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rotoformas · Trazabilidad</title><body style="font-family:Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#153d50"><h1>Rotoformas</h1><p>Escanea el código QR de tu pieza para consultar su trazabilidad.</p></body></html>';
        }
        exit;
    }
    $registry = new LotLinks($config);
    if ($path === '/api/links' && $method === 'POST') {
        $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        $digest = $config['token_sha256'] ?? '';
        if (!preg_match('/\A[a-f0-9]{64}\z/', $digest)
            || !preg_match('/\ABearer ([a-f0-9]{64})\z/', $authorization, $match)
            || !hash_equals($digest, hash('sha256', $match[1]))) {
            reply(401, ['ok' => false, 'message' => 'Acceso no autorizado.']);
        }
        $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        if ($type !== 'application/json') {
            reply(415, ['ok' => false, 'message' => 'Se requiere JSON.']);
        }
        $body = file_get_contents('php://input', false, null, 0, 2049);
        if ($body === false || strlen($body) > 2048) {
            reply(413, ['ok' => false, 'message' => 'Solicitud demasiado grande.']);
        }
        try {
            $input = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
        } catch (Throwable $e) {
            reply(400, ['ok' => false, 'message' => 'Solicitud no válida.']);
        }
        if (!is_array($input) || array_keys($input) !== ['lot'] || !LotLinks::validLot($input['lot'])) {
            reply(400, ['ok' => false, 'message' => 'Lote no válido.']);
        }
        $link = $registry->register($input['lot']);
        reply($link['existing'] ? 200 : 201, ['ok' => true] + $link);
    }
    if (is_string($path) && preg_match('~\A/([a-f0-9]{12})\z~', $path, $match)
        && in_array($method, ['GET', 'HEAD'], true)) {
        $destination = $registry->resolve($match[1]);
        if ($destination !== null) {
            header('Location: ' . $destination, true, 302);
            exit;
        }
    }
    reply(404, ['ok' => false, 'message' => 'Enlace no encontrado.']);
} catch (Throwable $e) {
    // Never reveal paths, credentials, registry content or exception messages.
    reply(503, ['ok' => false, 'message' => 'Servicio temporalmente no disponible.']);
}
