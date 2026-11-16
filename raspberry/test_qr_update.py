import unittest
from pathlib import Path

import corregir_qr_equipos as update


class QrUpdateTests(unittest.TestCase):
    def setUp(self):
        self.current = Path(__file__).with_name('bridge.py').read_text(encoding='utf-8')
        self.previous = self.current.replace('QR_PREFIX = ("' + update.NEW + '"',
                                             'QR_PREFIX = ("' + update.OLD + '"', 1)

    def test_changes_only_prefix(self):
        self.assertEqual(update.corrected_source(self.previous), self.current)

    def test_already_correct_is_idempotent(self):
        self.assertEqual(update.corrected_source(self.current), self.current)

    def test_unexpected_program_is_not_modified(self):
        for source in ('print("otro programa")',
                       self.previous.replace(update.DEPLOYMENT, 'otro-despliegue'),
                       self.previous.replace('QR_PREFIX = ', 'OTHER_PREFIX = ')):
            with self.assertRaises(RuntimeError):
                update.corrected_source(source)
