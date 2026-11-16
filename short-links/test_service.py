"""Real PHP HTTP and concurrent registry tests; all data in a temporary directory."""
import concurrent.futures
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.parse import quote

PHP = os.environ.get('PHP_BIN', 'php')
SOURCE = Path(__file__).resolve().parent
TOKEN = '9' * 64  # Test credential only; never used in the installation package.
TARGET = 'https://script.google.com/macros/s/test-deployment/exec'


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.public = self.root / 'public'
        self.public.mkdir()
        for name in ('index.php', 'service.php'):
            shutil.copyfile(SOURCE / name, self.public / name)
        self.storage = self.root / 'private'
        self.write_config(True)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        self.process = subprocess.Popen(
            [PHP, '-n', '-S', '127.0.0.1:' + str(self.port), 'index.php'],
            cwd=self.public, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(70):
            try:
                self.request('GET', '/')
                break
            except OSError:
                if self.process.poll() is not None:
                    self.fail('PHP server exited')
                time.sleep(0.05)
        else:
            self.fail('PHP server did not start')

    def tearDown(self):
        self.process.terminate()
        self.process.wait(timeout=5)
        self.temp.cleanup()

    def write_config(self, local):
        config = {
            'public_base': 'https://qr.rotoformas.com', 'target': TARGET,
            'storage': self.storage.as_posix(),
            'token_sha256': hashlib.sha256(TOKEN.encode()).hexdigest(),
            'local_test': local,
        }
        encoded = json.dumps(json.dumps(config))
        (self.public / 'config.php').write_text(
            '<?php return json_decode(' + "'" + json.dumps(config).replace("'", "\\'") + "'" + ', true);',
            encoding='utf-8')

    def request(self, method, path, data=None, token=TOKEN, raw=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        headers = {'Content-Type': 'application/json', 'Host': 'attacker.invalid'}
        if token is not None:
            headers['Authorization'] = 'Bearer ' + token
        body = raw if raw is not None else json.dumps(data) if data is not None else None
        connection.request(method, path, body, headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def register(self, lot):
        status, _, body = self.request('POST', '/api/links', {'lot': lot})
        self.assertIn(status, (200, 201), body)
        return status, json.loads(body)

    def test_persistent_unique_links_and_exact_redirect(self):
        lot = 'OX DISAIR BÁSIC-102026-OF0002'
        status, first = self.register(lot)
        self.assertEqual(status, 201)
        self.assertRegex(first['url'], r'^https://qr\.rotoformas\.com/[a-f0-9]{12}$')
        status, second = self.register(lot)
        self.assertEqual(status, 200)
        self.assertEqual(first['url'], second['url'])
        self.assertNotEqual(first['url'], self.register('OTRO LOTE')[1]['url'])
        path = '/' + first['url'].rsplit('/', 1)[1]
        for method in ('GET', 'HEAD'):
            status, headers, body = self.request(method, path, token=None)
            self.assertEqual(status, 302)
            self.assertEqual(headers['Location'], TARGET + '?lote/' + quote(lot, safe=''))
            self.assertEqual(body, b'')
        # New process reads the on-disk mapping, not an in-memory cache.
        command = ('require ' + repr(str(self.public / 'service.php')).replace('\\', '/') + ';'
                   '$s=new LotLinks(require "config.php");echo json_encode($s->register($argv[1]));')
        result = subprocess.check_output([PHP, '-n', '-r', command, lot], cwd=self.public)
        self.assertEqual(json.loads(result)['url'], first['url'])

    def test_requires_authentication_before_creating_files(self):
        for token in (None, '', 'f' * 64, TOKEN + '\n'):
            if token and '\n' in token:
                continue  # HTTP client refuses malformed header values.
            status, _, body = self.request('POST', '/api/links', {'lot': 'A'}, token=token)
            self.assertEqual(status, 401, body)
        self.assertFalse(self.storage.exists())

    def test_rejects_bad_input_and_arbitrary_destinations(self):
        for data in ({'lot': ''}, {'lot': ' A'}, {'lot': 'A\nB'}, {'lot': 'x' * 201},
                     {'lot': []}, {'lot': 'A', 'url': 'https://attacker.invalid'},
                     {'lot': 'A', 'code': 'existing'}, {}, []):
            self.assertEqual(self.request('POST', '/api/links', data)[0], 400, data)
        self.assertEqual(self.request('POST', '/api/links', raw='{')[0], 400)
        self.assertEqual(self.request('POST', '/api/links', raw=' ' * 2049)[0], 413)
        self.assertFalse(self.storage.exists())

    def test_no_public_registry_or_admin_mutations(self):
        self.register('Lote A')
        for method, path in [('GET', '/config.php'), ('GET', '/service.php'), ('GET', '/php.ini'),
                             ('GET', '/links.json'), ('GET', '/api/links'),
                             ('DELETE', '/api/links'), ('GET', '/ffffffffffff'),
                             ('GET', '/aaaaaaaaaaaa?redirect=https://attacker.invalid')]:
            status, _, body = self.request(method, path)
            self.assertEqual(status, 404)
            self.assertNotIn(TOKEN.encode(), body)
            self.assertNotIn(b'Lote A', body)

    def test_damaged_registry_is_not_overwritten(self):
        self.register('Lote A')
        registry = self.storage / 'links.json'
        registry.write_text('{damaged', encoding='utf-8')
        status, _, body = self.request('POST', '/api/links', {'lot': 'Lote B'})
        self.assertEqual(status, 503)
        self.assertNotIn(str(self.storage).encode(), body)
        self.assertEqual(registry.read_text(encoding='utf-8'), '{damaged')

    def test_http_uses_fixed_https_host_and_refuses_write(self):
        self.write_config(False)
        status, headers, _ = self.request('GET', '/aaaaaaaaaaaa')
        self.assertEqual(status, 308)
        self.assertEqual(headers['Location'], 'https://qr.rotoformas.com/aaaaaaaaaaaa')
        self.assertEqual(self.request('POST', '/api/links', {'lot': 'A'})[0], 426)
        self.assertFalse(self.storage.exists())

    def test_concurrent_writers_preserve_all_lots_and_idempotency(self):
        command = 'require "service.php";$s=new LotLinks(require "config.php");echo json_encode($s->register($argv[1]));'
        lots = ['Lote compartido'] * 8 + ['Lote ' + str(i) for i in range(12)]
        def create(lot):
            output = subprocess.check_output([PHP, '-n', '-r', command, lot], cwd=self.public)
            try:
                return json.loads(output)
            except ValueError as error:
                raise AssertionError('PHP did not return JSON: ' + output.decode('utf-8', errors='replace')) from error
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(create, lots))
        self.assertEqual(len({item['url'] for item in results[:8]}), 1)
        registry = json.loads((self.storage / 'links.json').read_text(encoding='utf-8'))
        self.assertEqual(len(registry['links']), 13)
        self.assertEqual(set(registry['links'].values()), set(lots))


if __name__ == '__main__':
    unittest.main(verbosity=2)
