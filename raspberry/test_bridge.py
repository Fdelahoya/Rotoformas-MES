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
        self.environment = patch.dict(os.environ, {"ENABLE_PRINT": "true", "ENABLE_LASER": "true"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.db = bridge.db_connect(str(Path(self.tmp.name) / "bridge.sqlite3"))
        self.url = bridge.QR_PREFIX + "?lote=OX%20DISAIR%20BASIC-102026-OF0002"
        self.job = {
            "protocolVersion": 2, "outputs": {"print": True, "laser": True},
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

    def test_apps_script_date_from_real_failed_job_generates_pdf(self):
        self.job['measuredAt'] = 'Thu Nov 05 2026 06:41:00 GMT+0100 (hora estándar de Europa central)'
        self.assertEqual(bridge.label_date(self.job['measuredAt']), '05/11/2026 06:41')
        pdf = Path(self.tmp.name) / 'real-date.pdf'
        bridge.write_label_pdf(self.job, pdf)
        self.assertTrue(pdf.read_bytes().startswith(b'%PDF-'))

    def test_label_date_preserves_local_time_and_validates_calendar(self):
        self.assertEqual(bridge.label_date('03/11/2026 10:15'), '03/11/2026 10:15')
        self.assertEqual(bridge.label_date('Wed Jul 01 2026 00:05:00 GMT+0200 (hora de verano de Europa central)'), '01/07/2026 00:05')
        for value in ('fecha incorrecta', '31/02/2026 10:15', 'Thu Nov 05 2026 25:41:00 GMT+0100'):
            with self.assertRaises(ValueError):
                bridge.label_date(value)

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

    def test_outputs_disabled_by_default_even_for_authorized_job(self):
        with patch.dict(os.environ, {"ENABLE_PRINT": "false", "ENABLE_LASER": "false"}), \
             patch.object(bridge.subprocess, "run") as cups, \
             patch.object(bridge.socket, "create_connection") as laser:
            with self.assertRaises(PermissionError):
                bridge.execute_once(self.db, self.job)
            with self.assertRaises(PermissionError):
                bridge.print_zebra(self.job)
            with self.assertRaises(PermissionError):
                bridge.send_laser_v1(self.url)
            cups.assert_not_called()
            laser.assert_not_called()
            self.assertEqual(self.db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0], 0)

    def test_print_phase_does_not_send_laser(self):
        self.job['outputs']['laser'] = False
        with patch.object(bridge, 'print_zebra', return_value='CUPS accepted') as cups, \
             patch.object(bridge, 'send_laser_v1') as laser:
            bridge.execute_once(self.db, self.job)
            cups.assert_called_once()
            laser.assert_not_called()
        self.assertEqual(bridge.pending_results(self.db)[0]['laser'], 'DESHABILITADO')

    def test_timeout_is_uncertain_and_never_retried(self):
        with patch.object(bridge, 'print_zebra', side_effect=bridge.OutputUncertain('timeout')) as cups, \
             patch.object(bridge, 'send_laser_v1', side_effect=bridge.OutputUncertain('timeout')) as laser:
            bridge.execute_once(self.db, self.job)
            bridge.execute_once(self.db, self.job)
            cups.assert_called_once()
            laser.assert_called_once()
        result = bridge.pending_results(self.db)[0]
        self.assertEqual(result['print'], 'INCIERTO')
        self.assertEqual(result['laser'], 'INCIERTO')

    def test_exact_cups_arguments_and_pdf_only_with_explicit_permission(self):
        from unittest.mock import Mock
        with patch.dict(os.environ, {'ZEBRA_CUPS_QUEUE': 'Zebra_ZT231_USB'}), \
             patch.object(bridge.subprocess, 'run', return_value=Mock(returncode=0, stdout='queued')) as cups:
            bridge.print_zebra(self.job)
            command = cups.call_args[0][0]
            self.assertEqual(command[:5], ['lp', '-d', 'Zebra_ZT231_USB', '-o', 'media=Custom.100x150mm'])
            cups.return_value = Mock(returncode=1, stderr='connection lost')
            with self.assertRaises(bridge.OutputUncertain):
                bridge.print_zebra(self.job)
            cups.side_effect = bridge.subprocess.TimeoutExpired('lp', 25)
            with self.assertRaises(bridge.OutputUncertain):
                bridge.print_zebra(self.job)

    def test_laser_packet_is_exact_v1_and_never_marks(self):
        from unittest.mock import MagicMock
        conn = MagicMock()
        conn.__enter__.return_value = conn
        conn.recv.return_value = b'\x02\x06seta:1:data#V1=' + self.url.encode('ascii') + b'\x03'
        with patch.dict(os.environ, {'LASER_HOST': '127.0.0.1', 'LASER_PORT': '8050'}), \
             patch.object(bridge.socket, 'create_connection', return_value=conn):
            bridge.send_laser_v1(self.url)
        conn.sendall.assert_called_once_with(b'\x02\x05seta:data#V1=' + self.url.encode('ascii') + b'\x03')
        packet = conn.sendall.call_args[0][0]
        for forbidden in (b'start:', b'load:', b'stop:'):
            self.assertNotIn(forbidden, packet)

    def test_invalid_url_never_reaches_either_output(self):
        for suffix in ('?lote=A&other=', '?lote=A&lote=B', '?lote=A#', '?lote=A\n'):
            with self.assertRaises(ValueError):
                bridge.check_url(bridge.QR_PREFIX + suffix)

    def test_telemetry_request_declares_outputs_disabled(self):
        from unittest.mock import Mock
        response = Mock()
        response.json.return_value = {'ok': True, 'job': None}
        with patch.dict(os.environ, {'ENABLE_PRINT': 'false', 'ENABLE_LASER': 'false'}), \
             patch.object(bridge.requests, 'post', return_value=response) as post:
            bridge.sync('https://example.invalid', 'test-only', {}, [])
        payload = post.call_args[1]['json']
        self.assertEqual(payload['protocolVersion'], 2)
        self.assertEqual(payload['capabilities'], {'print': False, 'laser': False})


class ScaleFreshnessTests(unittest.TestCase):
    def test_scale_module_imports_without_pdf_dependencies(self):
        import runpy
        import sys
        with patch.dict(sys.modules, {'reportlab': None}):
            module = runpy.run_path(bridge.__file__, run_name='scale_import_test')
            self.assertEqual(module['decode_scale_frame'](b'S+8.800'), 8.8)
            self.assertFalse(module['ScaleReader']('/not-opened').snapshot()['stable'])

    def test_snapshot_is_recent_stable_and_timestamped(self):
        reader = bridge.ScaleReader('/not-opened')
        with patch.object(bridge.time, 'monotonic', return_value=100), \
             patch.object(bridge.time, 'time', return_value=200):
            reader.weight = 8.8
            reader.last_frame_at = 99
            self.assertEqual(reader.snapshot(), {'stable': True, 'weight': 8.8, 'measuredAt': 199000})
            reader.last_frame_at = 98
            self.assertEqual(reader.snapshot()['stable'], False)
            reader.weight = None
            self.assertIsNone(reader.snapshot()['weight'])

    def test_huge_weights_rejected(self):
        for frame in (b'S+100000', b'S+999999999999999999999999999999999999'):
            self.assertIsNone(bridge.decode_scale_frame(frame))


class ScalePilotTests(unittest.TestCase):
    def test_entry_point_forces_disabled_outputs_without_equipment(self):
        import scale_pilot
        with patch.dict(os.environ, {}, clear=True), patch.object(bridge, 'main') as run:
            scale_pilot.main()
            run.assert_called_once_with()
            self.assertEqual(os.environ['ENABLE_PRINT'], 'false')
            self.assertEqual(os.environ['ENABLE_LASER'], 'false')

    def test_entry_point_rejects_output_configuration_before_start(self):
        import scale_pilot
        for name in ('ENABLE_PRINT', 'ENABLE_LASER'):
            with patch.dict(os.environ, {'ENABLE_PRINT':'false', 'ENABLE_LASER':'false', name:'true'}), \
                 patch.object(bridge, 'main') as run:
                with self.assertRaises(RuntimeError):
                    scale_pilot.main()
                run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
