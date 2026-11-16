#!/usr/bin/env python3
"""Corrige solo el prefijo QR instalado. Conserva entorno, SQLite y trabajos previos."""
import datetime
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

OLD = 'https://script.google.com/a/macros/rotoformas.com/s/'
NEW = 'https://script.google.com/macros/s/'
DEPLOYMENT = 'AKfycbw5LAL2__An-gyUsq8qDYNKfYZ5tfJys8INv7__MpmHx32SuZWxonaFiygbsO92tBsN5Q'


def corrected_source(source):
    if DEPLOYMENT + '/exec' not in source or 'def check_url(url):' not in source:
        raise RuntimeError('El programa instalado no coincide con el puente esperado.')
    old = 'QR_PREFIX = ("' + OLD + '"'
    new = 'QR_PREFIX = ("' + NEW + '"'
    if source.count(old) == 1:
        updated = source.replace(old, new, 1)
    elif source.count(new) == 1:
        updated = source
    else:
        raise RuntimeError('No se identifica de forma unica QR_PREFIX; no se modifica el programa.')
    compile(updated, 'bridge.py', 'exec')
    return updated


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Ejecuta con sudo python3 corregir_qr_equipos.py')
    target = Path('/opt/rotoformas-bridge/bridge.py')
    python = '/opt/rotoformas-bridge/venv/bin/python'
    source = target.read_text(encoding='utf-8')
    updated = corrected_source(source)
    subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge'], check=True)
    if updated == source:
        print('El puente ya acepta el QR publico correcto. No se modifica ni reinicia.')
        return
    staging = target.with_name('bridge.py.qr-nuevo')
    staging.write_text(updated, encoding='utf-8')
    staging.chmod(0o644)
    # Importa sin ejecutar main; no abre puertos USB, CUPS ni conexiones al laser.
    check = (
        "import runpy,sys; m=runpy.run_path(sys.argv[1],run_name='qr_check'); "
        "expected=sys.argv[2]; assert m['QR_PREFIX']==expected; "
        "url=expected+'?lote=OX%20DISAIR%20BASIC-102026-OF0002'; "
        "assert m['check_url'](url)==url"
    )
    subprocess.run([python, '-c', check, str(staging), NEW + DEPLOYMENT + '/exec'], check=True)
    backup = target.with_name('bridge.py.antes-qr-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    shutil.copy2(str(target), str(backup))
    os.replace(str(staging), str(target))
    try:
        subprocess.run(['systemctl', 'restart', 'rotoformas-bridge'], check=True)
        time.sleep(5)
        subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge'], check=True)
    except Exception:
        shutil.copy2(str(backup), str(target))
        subprocess.run(['systemctl', 'restart', 'rotoformas-bridge'])
        raise RuntimeError('Fallo de arranque. Programa anterior restaurado; revisar servicio.')
    print('QR corregido: Zebra y laser V1 aceptan la misma URL publica del lote.')
    print('No se han reenviado trabajos anteriores ni modificado entorno o SQLite.')
    print('Respaldo: ' + str(backup))
    subprocess.run(['systemctl', 'status', 'rotoformas-bridge', '--no-pager', '-l'], check=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('CORRECCION DETENIDA: ' + str(exc), file=sys.stderr)
        sys.exit(1)
