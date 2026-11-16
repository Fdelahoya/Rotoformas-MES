#!/usr/bin/env python3
"""Raspberry Pi Rotoformas bridge: USB scale -> Apps Script, CUPS PDF and laser V1.
No laser load/start/stop commands are sent. Only seta:data#V1=<QR URL>.
"""
import json
import logging
import os
import re
import socket
import sqlite3
import subprocess
import tempfile
import time
import threading
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import parse_qs, urlparse, quote, unquote

import requests
import serial

LOG = logging.getLogger("rotoformas-bridge")
FRAME_RE = re.compile(r"^(?:S|\x02)([+?\-])\s*(\d+(?:[.,]\d+)?)$")
QR_PREFIX = ("https://script.google.com/macros/s/"
             "AKfycbw5LAL2__An-gyUsq8qDYNKfYZ5tfJys8INv7__MpmHx32SuZWxonaFiygbsO92tBsN5Q/exec")


def required(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError("Falta variable de entorno " + name)
    return value


def output_enabled(name):
    # Fail closed: absence, typo or old environment file never enables equipment.
    return os.environ.get("ENABLE_" + name) == "true"


class OutputUncertain(RuntimeError):
    """An output might have occurred; human reconciliation is required."""


def decode_scale_frame(frame):
    """Return stable numeric kg or None for unstable/invalid frames."""
    try:
        match = FRAME_RE.fullmatch(frame.decode("ascii").strip("\r\n"))
        if not match or match.group(1) == "?":
            return None
        signed = ("-" if match.group(1) == "-" else "") + match.group(2).replace(",", ".")
        weight = Decimal(signed)
        if not weight.is_finite() or weight <= Decimal("0.100") or weight >= Decimal("100000"):
            return None
        return float(weight.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))
    except (UnicodeError, InvalidOperation, ValueError):
        return None


class ScaleReader:
    def __init__(self, port):
        self.port = port
        self.conn = None
        self.buffer = b""
        self.weight = None
        self.last_frame_at = 0.0
        self.next_retry_at = 0.0
        self.lock = threading.Lock()

    def close(self):
        if self.conn is not None:
            try:
                self.conn.close()
            except Exception:
                pass
        self.conn = None
        self.weight = None
        self.last_frame_at = 0.0
        self.buffer = b""

    def poll(self):
        with self.lock:
            self._poll()

    def _poll(self):
        now = time.monotonic()
        if self.conn is None:
            if now < self.next_retry_at:
                return
            try:
                self.conn = serial.Serial(self.port, baudrate=9600,
                                          bytesize=serial.SEVENBITS,
                                          parity=serial.PARITY_ODD,
                                          stopbits=serial.STOPBITS_ONE,
                                          timeout=0.1, xonxoff=False,
                                          rtscts=False, dsrdtr=False)
                LOG.info("Bascula conectada: %s (9600/7O1)", self.port)
            except (OSError, serial.SerialException) as exc:
                LOG.warning("Bascula desconectada: %s", exc)
                self.next_retry_at = now + 5.0
                return
        try:
            chunk = self.conn.read(self.conn.in_waiting or 1)
            if chunk:
                self.buffer += chunk
                while b"\x03" in self.buffer:
                    frame, self.buffer = self.buffer.split(b"\x03", 1)
                    self.weight = decode_scale_frame(frame)
                    self.last_frame_at = time.monotonic()
                if len(self.buffer) > 1024:
                    self.buffer = b""
                    self.weight = None
        except (OSError, serial.SerialException) as exc:
            LOG.warning("Error USB: %s", exc)
            self.close()
            self.next_retry_at = time.monotonic() + 5.0

    def snapshot(self):
        with self.lock:
            age = time.monotonic() - self.last_frame_at
            valid = self.weight is not None and 0 <= age <= 1.5
            return {"stable": bool(valid), "weight": self.weight if valid else None,
                    "measuredAt": int((time.time() - age) * 1000) if valid else None}


def check_url(url):
    if not isinstance(url, str) or len(url) > 500:
        raise ValueError("URL de trazabilidad inesperada; laser no actualizado.")
    if re.fullmatch(r'https://qr\.rotoformas\.com/[a-f0-9]{12}', url):
        return url
    if url.startswith(QR_PREFIX + '?lote/'):
        lot = unquote(url[len(QR_PREFIX + '?lote/'):])
        if (not lot.strip() or not url.isascii() or '=' in url or url.count('?') != 1 or '#' in url or
                any(ord(c) < 32 or ord(c) == 127 for c in lot) or
                url != QR_PREFIX + '?lote/' + quote(lot, safe="~()*!.'")):
            raise ValueError("Ruta QR de lote no canonica")
        return url
    # Compatibilidad con trabajos existentes; nuevos trabajos no usan '='.
    if not url.startswith(QR_PREFIX + "?"):
        raise ValueError("URL de trazabilidad inesperada; laser no actualizado.")
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if (parsed.fragment or not query.get("lote") or len(query["lote"]) != 1 or
            set(query) != {"lote"} or any(ord(c) < 32 or ord(c) == 127 for c in url)):
        raise ValueError("URL sin parametro lote valido.")
    if not url.isascii():
        raise ValueError("URL QR debe ser ASCII con lote codificado.")
    if url != QR_PREFIX + '?lote=' + quote(query['lote'][0], safe="~()*!.'"):
        raise ValueError("URL QR no canonica")
    return url


def label_date(value):
    """Fecha compacta, conservando la hora local enviada por Apps Script."""
    text = str(value).strip()
    if re.fullmatch(r'\d{2}/\d{2}/\d{4} \d{2}:\d{2}', text):
        return datetime.strptime(text, '%d/%m/%Y %H:%M').strftime('%d/%m/%Y %H:%M')
    match = re.fullmatch(
        r'[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4}) '
        r'(\d{2}):(\d{2}):(\d{2}) GMT[+-]\d{4}(?: \([^\r\n]*\))?', text)
    if match:
        months = dict(zip(('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'), range(1, 13)))
        month, day, year, hour, minute, second = match.groups()
        if month in months:
            return datetime(int(year), months[month], int(day), int(hour),
                            int(minute), int(second)).strftime('%d/%m/%Y %H:%M')
    raise ValueError('Formato de fecha del pesaje no reconocido')


def write_label_pdf(job, target):
    """PDF sized EXACTLY 100x150mm; CUPS queue must be calibrated accordingly."""
    # La fase de solo bascula no necesita instalar ni importar PDF/imagen.
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics import renderPDF

    url = check_url(job["url"])
    c = canvas.Canvas(str(target), pagesize=(100 * mm, 150 * mm))
    c.setTitle("Rotoformas " + str(job["jobId"]))
    left, top = 7 * mm, 143 * mm
    logo = os.environ.get("ROTOFORMAS_LOGO_PNG", "")
    if logo and Path(logo).is_file():
        try:
            c.drawImage(logo, left, top - 11 * mm, width=67 * mm, height=11 * mm,
                        preserveAspectRatio=True, anchor="sw", mask="auto")
        except Exception as exc:
            LOG.warning("Logo omitido: %s", exc)
            c.setFont("Helvetica-Bold", 19)
            c.drawString(left, top - 7 * mm, "ROTOFORMAS")
    else:
        c.setFont("Helvetica-Bold", 19)
        c.drawString(left, top - 7 * mm, "ROTOFORMAS")

    def line(text, y, size=11, bold=False):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        value = str(text).replace("\n", " ").replace("\r", " ")
        # Reduce font size for long product/lot names, never truncate identifiers.
        font = "Helvetica-Bold" if bold else "Helvetica"
        while size > 8 and c.stringWidth(value, font, size) > 86 * mm:
            size -= 0.5
        if c.stringWidth(value, font, size) > 86 * mm:
            raise ValueError("Texto demasiado largo para la etiqueta: " + value[:60])
        c.setFont(font, size)
        c.drawString(left, y * mm, value)

    line(job["product"], 119, 15, True)
    line(job["sku"], 112, 10)
    line("LOTE", 99, 9)
    line(job["lot"], 91, 13, True)
    line("Peso bruto", 79, 9)
    line(format(Decimal(str(job["weight"])), ".3f").replace(".", ",") + " kg", 72, 14, True)
    line("Pieza " + str(job["pieceNumber"]), 62, 11, True)
    line("Fecha " + label_date(job["measuredAt"]), 55, 10)
    line("OF " + job["orderId"], 48, 10)

    widget = QrCodeWidget(url)
    bounds = widget.getBounds()
    size = 40 * mm
    drawing = Drawing(size, size, transform=[
        size / (bounds[2] - bounds[0]), 0, 0,
        size / (bounds[3] - bounds[1]), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, (100 * mm - size) / 2, 5 * mm)
    c.showPage()
    c.save()


def print_zebra(job):
    if not output_enabled("PRINT"):
        raise PermissionError("Impresion deshabilitada localmente")
    queue = required("ZEBRA_CUPS_QUEUE")
    with tempfile.TemporaryDirectory(prefix="rotoformas-") as directory:
        pdf = Path(directory) / "etiqueta.pdf"
        write_label_pdf(job, pdf)
        # Paper size and thermal-transfer settings are configured in CUPS defaults.
        try:
            result = subprocess.run(["lp", "-d", queue, "-o", "media=Custom.100x150mm",
                                     "-t", "MES " + str(job["jobId"]), str(pdf)],
                                    capture_output=True, text=True, timeout=25, check=False)
        except subprocess.TimeoutExpired as exc:
            raise OutputUncertain("CUPS no confirma; comprobar cola sin reimprimir") from exc
        if result.returncode:
            raise OutputUncertain("CUPS no confirma aceptacion; revisar cola: " +
                                  (result.stderr or result.stdout).strip()[:300])
        return result.stdout.strip()[:250]  # Queue accepted != physically printed


def send_laser_v1(url):
    if not output_enabled("LASER"):
        raise PermissionError("Laser V1 deshabilitado localmente")
    url = check_url(url)
    if '=' in url:
        raise ValueError("El laser requiere el formato ?lote/ sin signo igual.")
    host = required("LASER_HOST")
    port = int(required("LASER_PORT"))
    packet = b"\x02\x05seta:data#V1=" + url.encode("ascii") + b"\x03"
    with socket.create_connection((host, port), timeout=4) as conn:
        conn.settimeout(4)
        try:
            conn.sendall(packet)
            reply = bytearray()
            while len(reply) < 2048 and b"\x03" not in reply:
                block = conn.recv(512)
                if not block:
                    break
                reply.extend(block)
        except OSError as exc:
            raise OutputUncertain("V1 sin confirmacion; revisar controlador") from exc
    expected = b"\x02\x06seta:1:data#V1=" + url.encode("ascii") + b"\x03"
    if expected not in reply:
        raise OutputUncertain("Laser no confirma exactamente V1")
    # El acuse seta puede repetir una URL que el objeto QR haya truncado.
    with socket.create_connection((host, port), timeout=4) as conn:
        conn.settimeout(4)
        try:
            conn.sendall(b'\x02\x05get_currtext\x03')
            actual = bytearray()
            while len(actual) < 16384 and b'\x03' not in actual:
                block = conn.recv(4096)
                if not block:
                    break
                actual.extend(block)
        except OSError as exc:
            raise OutputUncertain("No se pudo comprobar el QR B1 del laser") from exc
    prefix = b'\x02\x06get_currtext:'
    if prefix not in actual or b'\x03' not in actual:
        raise OutputUncertain("Respuesta de contenido QR incompleta")
    text = bytes(actual).split(prefix, 1)[1].split(b'\x03', 1)[0].decode('ascii', errors='replace')
    fields = dict(part.strip().split('=', 1) for part in text.split(' ** ') if '=' in part)
    if fields.get('B1') != url:
        raise OutputUncertain("El QR B1 del laser no coincide con el QR de Zebra")
    return "V1 aceptada y QR B1 verificado (no confirma marcado)"


def db_connect(path):
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE IF NOT EXISTS jobs "
                 "(job_id TEXT PRIMARY KEY, state TEXT NOT NULL, result TEXT)")
    conn.commit()
    return conn


def recover_unknown_jobs(conn):
    # After a power loss do not repeat an uncertain physical print or laser write.
    rows = conn.execute("SELECT job_id FROM jobs WHERE state='RUNNING'").fetchall()
    for (job_id,) in rows:
        result = {"jobId": job_id, "print": "INCIERTO", "laser": "INCIERTO",
                  "detail": "Interrupcion durante ejecucion; comprobar equipos sin repetir automaticamente."}
        conn.execute("UPDATE jobs SET state='RESULT',result=? WHERE job_id=?",
                     (json.dumps(result), job_id))
    conn.commit()


def execute_once(conn, job):
    if job.get("protocolVersion") != 2 or job.get("outputs", {}).get("print") is not True:
        raise ValueError("Trabajo sin autorizacion de salida del protocolo 2")
    if not output_enabled("PRINT"):
        raise PermissionError("Impresion deshabilitada; trabajo no ejecutado")
    check_url(job["url"])
    job_id = str(job["jobId"])
    row = conn.execute("SELECT state FROM jobs WHERE job_id=?", (job_id,)).fetchone()
    if row:
        LOG.info("Trabajo ya conocido: %s (%s)", job_id, row[0])
        return
    conn.execute("INSERT INTO jobs(job_id,state) VALUES (?, 'RUNNING')", (job_id,))
    conn.commit()
    results = {"jobId": job_id, "print": "INCIERTO", "laser": "INCIERTO", "detail": ""}
    details = []
    try:
        details.append(print_zebra(job))
        results["print"] = "COLA_CUPS"
    except OutputUncertain as exc:
        details.append("Zebra: " + str(exc)[:250])
    except Exception as exc:
        results["print"] = "ERROR"
        details.append("Zebra: " + str(exc)[:250])
        LOG.exception("Impresion fallida %s", job_id)
    if job.get("outputs", {}).get("laser") is True and output_enabled("LASER"):
        try:
            details.append(send_laser_v1(job["url"]))
            results["laser"] = "V1_ACEPTADA"
        except OutputUncertain as exc:
            details.append("Laser: " + str(exc)[:250])
        except Exception as exc:
            results["laser"] = "ERROR"
            details.append("Laser: " + str(exc)[:250])
            LOG.exception("Envio V1 fallido %s", job_id)
    else:
        results["laser"] = "DESHABILITADO"
    results["detail"] = " | ".join(details)[:850]
    conn.execute("UPDATE jobs SET state='RESULT',result=? WHERE job_id=?",
                 (json.dumps(results), job_id))
    conn.commit()


def pending_results(conn):
    rows = conn.execute("SELECT result FROM jobs WHERE state='RESULT' LIMIT 10").fetchall()
    return [json.loads(row[0]) for row in rows]


def sync(url, token, sample, results):
    response = requests.post(url, json={"action": "sync", "token": token, "protocolVersion": 2,
                                         "capabilities": {"print": output_enabled("PRINT"),
                                                          "laser": output_enabled("LASER")},
                                         "sample": sample, "results": results},
                             timeout=25)
    response.raise_for_status()
    data = response.json()
    if data.get("ok") is not True:
        raise RuntimeError("Apps Script: " + str(data.get("error", "sin respuesta valida")))
    return data


def main():
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"),
                        format="%(asctime)s %(levelname)s %(message)s")
    url, token = required("BRIDGE_URL"), required("RPI_BRIDGE_TOKEN")
    if not re.fullmatch(r"https://script\.google\.com/(?:a/macros/rotoformas\.com|macros)/s/[A-Za-z0-9_-]+/exec", url) or not re.fullmatch(r"[a-fA-F0-9]{64}", token):
        raise RuntimeError("BRIDGE_URL o RPI_BRIDGE_TOKEN invalidos")
    if output_enabled("LASER") and not output_enabled("PRINT"):
        raise RuntimeError("Laser requiere fase de impresion habilitada")
    if output_enabled("PRINT"):
        required("ZEBRA_CUPS_QUEUE")
    db_path = Path(os.environ.get("BRIDGE_DB", "/var/lib/rotoformas-bridge/jobs.sqlite3"))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = db_connect(str(db_path))
    recover_unknown_jobs(conn)
    scale = ScaleReader(os.environ.get("SCALE_PORT", "/dev/ttyUSB0"))
    stop_reader = threading.Event()

    def read_continuously():
        while not stop_reader.is_set():
            scale.poll()
            stop_reader.wait(0.05)

    reader = threading.Thread(target=read_continuously, name='scale-reader', daemon=True)
    reader.start()
    interval = max(2.0, float(os.environ.get("SYNC_INTERVAL_SECONDS", "3")))
    next_sync = 0.0
    try:
        while True:
            if time.monotonic() >= next_sync:
                try:
                    payload = sync(url, token, scale.snapshot(), pending_results(conn))
                    for job_id in payload.get("ack", []):
                        conn.execute("UPDATE jobs SET state='ACKED' WHERE job_id=? AND state='RESULT'",
                                     (str(job_id),))
                    conn.commit()
                    if payload.get("job"):
                        execute_once(conn, payload["job"])
                except Exception:
                    LOG.exception("Sincronizacion fallida; no se repiten trabajos ya ejecutados")
                next_sync = time.monotonic() + interval
            time.sleep(0.05)
    finally:
        stop_reader.set()
        reader.join(timeout=2)
        scale.close()
        conn.close()


if __name__ == "__main__":
    main()
