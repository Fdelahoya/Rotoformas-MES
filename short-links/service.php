<?php
declare(strict_types=1);

/** Persistent, append-only lot registry. Data lives outside the document root. */
final class LotLinks
{
    private $directory;
    private $target;
    private $publicBase;

    public function __construct(array $config)
    {
        $this->directory = $config['storage'];
        $this->target = $config['target'];
        $this->publicBase = $config['public_base'];
    }

    public static function validLot($lot): bool
    {
        return is_string($lot) && $lot === trim($lot)
            && preg_match('/\A[^\x00-\x1f\x7f]{1,200}\z/u', $lot) === 1;
    }

    private function read(): array
    {
        $path = $this->directory . '/links.json';
        if (!file_exists($path)) {
            return ['version' => 1, 'links' => []];
        }
        if (filesize($path) > 32 * 1024 * 1024) {
            throw new RuntimeException('Registry size limit');
        }
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('Cannot read registry');
        }
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data) || ($data['version'] ?? null) !== 1 || !is_array($data['links'] ?? null)) {
            throw new RuntimeException('Invalid registry');
        }
        $lots = [];
        foreach ($data['links'] as $code => $lot) {
            if (!preg_match('/\A[a-f0-9]{12}\z/', (string) $code) || !self::validLot($lot)
                || isset($lots[hash('sha256', $lot)])) {
                throw new RuntimeException('Invalid registry entry');
            }
            $lots[hash('sha256', $lot)] = true;
        }
        return $data;
    }

    public function register(string $lot): array
    {
        if (!self::validLot($lot)) {
            throw new InvalidArgumentException('Invalid lot');
        }
        // Another first request may create the directory between the two checks.
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0700, true) && !is_dir($this->directory)) {
            throw new RuntimeException('Cannot create storage');
        }
        $lock = fopen($this->directory . '/registry.lock', 'c');
        if ($lock === false) {
            throw new RuntimeException('Cannot open lock');
        }
        $temporary = null;
        try {
            $deadline = microtime(true) + 3;
            while (!flock($lock, LOCK_EX | LOCK_NB)) {
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Registry busy');
                }
                usleep(10000);
            }
            $data = $this->read();
            foreach ($data['links'] as $code => $existingLot) {
                if ($existingLot === $lot) {
                    return ['url' => $this->publicBase . '/' . $code, 'existing' => true];
                }
            }
            do {
                // Numeric-only codes are prefixed to avoid PHP numeric array-key coercion.
                $code = 'a' . substr(bin2hex(random_bytes(6)), 0, 11);
            } while (array_key_exists($code, $data['links']));
            $data['links'][$code] = $lot;
            $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            if (strlen($encoded) > 32 * 1024 * 1024) {
                throw new RuntimeException('Registry size limit');
            }
            $temporary = tempnam($this->directory, '.links-');
            if ($temporary === false || file_put_contents($temporary, $encoded) !== strlen($encoded)
                || !chmod($temporary, 0600) || !rename($temporary, $this->directory . '/links.json')) {
                throw new RuntimeException('Cannot commit registry');
            }
            $temporary = null;
            return ['url' => $this->publicBase . '/' . $code, 'existing' => false];
        } finally {
            if ($temporary !== null && is_file($temporary)) {
                unlink($temporary);
            }
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function resolve(string $code): ?string
    {
        if (!preg_match('/\A[a-f0-9]{12}\z/', $code)) {
            return null;
        }
        // Atomic rename ensures readers observe the complete old or new registry.
        $data = $this->read();
        if (!array_key_exists($code, $data['links'])) {
            return null;
        }
        return $this->target . '?lote/' . rawurlencode($data['links'][$code]);
    }
}
