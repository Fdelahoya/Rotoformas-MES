import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import bridge


class ScaleProtocolTests(unittest.TestCase):
    def test_stable_mobba_frame(self):
        self.assertEqual(bridge.decode_scale_frame(b"S+     16.9"), 16.9)
        self.assertEqual(bridge.decode_scale_frame(b"\x02-0.200"), None)
        self.assertEqual(bridge.decode_scale_frame(b"S+0.101"), 0.101)

    def test_unstable_empty_and_minimum(self):
        for frame in (b"S? 16.9", b"S+0.100", b"S+0", b"garbage",
                      b"S+XX", b"S+999999999999999999999999999999999999"):
            if frame != b"S+999999999999999999999999999999999999":
                self.assertIsNone(bridge.decode_scale_frame(frame))

    def test_negative_and_decimal_comma(self):
        self.assertIsNone(bridge.decode_scale_frame(b"S-1.200"))
        self.assertEqual(bridge.decode_scale_frame(b"S+4,200"), 4.2)


class HardwareJobTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = bridge.db_connect(str(Path(self.tmp.name) / "bridge.sqlite3"))
        self.url = bridge.QR_PREFIX + "?lote=OX%20DISAIR%20BASIC-102026-OF0002"
        self.job = {
            "jobId": "OF-2026-0002|P1", "orderId": "OF-2026-0002",
            "pieceNumber": 1, "sku": "OX DISAIR BASIC", "product": "OX DISAIR BASIC",
            "lot": "OX DISAIR BASIC-102026-OF0002", "weight": 8.8,
            "measuredAt": "03/11/2026 10:15", "url": self.url
        }

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_url_only_allows_existing_traceability(self):
        self.assertEqual(bridge.check_url(self.url), self.url)
        for value in ("http://example.test/?lote=ABC",
                      "https://rotoformas.com/?lote=ABC",
                      bridge.QR_PREFIX + "?x=1",
                      bridge.QR_PREFIX + "?lote=A&other=1"):
            with self.assertRaises(ValueError):
                bridge.check_url(value)

    def test_pdf_has_correct_media(self):
        pdf = Path(self.tmp.name) / "test.pdf"
        bridge.write_label_pdf(self.job, pdf)
        contents = pdf.read_bytes()
        self.assertTrue(contents.startswith(b"%PDF-"))
        # ReportLab writes 100*mm x 150*mm page media box in points.
        self.assertIn(b"283.4646", contents)
        self.assertIn(b"425.1969", contents)

    def test_deduplicate_and_report_independent_outcomes(self):
        with patch.object(bridge, "print_zebra", side_effect=RuntimeError("No CUPS")), \
             patch.object(bridge, "send_laser_v1", return_value="V1 ok") as laser:
            bridge.execute_once(self.db, self.job)
            bridge.execute_once(self.db, self.job)
        laser.assert_called_once_with(self.url)
        results = bridge.pending_results(self.db)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["print"], "ERROR")
        self.assertEqual(results[0]["laser"], "V1_ACEPTADA")

    def test_crash_never_reexecutes_job(self):
        self.db.execute("INSERT INTO jobs(job_id,state) VALUES (?,?)", (self.job["jobId"], "RUNNING"))
        self.db.commit()
        bridge.recover_unknown_jobs(self.db)
        with patch.object(bridge, "print_zebra") as printer:
            bridge.execute_once(self.db, self.job)
        printer.assert_not_called()
        result = bridge.pending_results(self.db)[0]
        self.assertEqual(result["print"], "INCIERTO")
        self.assertEqual(result["laser"], "INCIERTO")


if __name__ == "__main__":
    unittest.main()
