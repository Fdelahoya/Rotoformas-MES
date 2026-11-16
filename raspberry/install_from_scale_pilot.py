#!/usr/bin/env python3
"""Instala el puente Zebra usando la conexion del piloto, sin revelar secretos."""
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

ROOT = Path('/opt/rotoformas-bridge')
PILOT_ENV = Path('/etc/rotoformas-scale-pilot.env')
TARGET_ENV = Path('/etc/rotoformas-bridge.env')
UNIT = Path('/etc/systemd/system/rotoformas-bridge.service')
QUEUE = 'Zebra_Technologies_ZTC_ZT231-203dpi_ZPL'
BUNDLE = Path(__file__).resolve().parent


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def values(text):
    result = {}
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            result[key.strip()] = value.strip().strip('\"\'')
    return result


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Ejecuta con sudo python3 install_from_scale_pilot.py')
    if subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge']).returncode == 0:
        raise RuntimeError('El puente ya esta activo. Revisar antes de reinstalar.')
    if subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-scale-pilot']).returncode != 0:
        raise RuntimeError('El piloto no esta activo. Revisar antes de continuar.')

    python = str(ROOT / 'venv/bin/python')
    for name in ('bridge.py', 'rotoformas-bridge.service'):
        if not (BUNDLE / name).is_file():
            raise RuntimeError('Falta archivo del paquete: ' + name)
    compile((BUNDLE / 'bridge.py').read_text(), 'bridge.py', 'exec')
    run([python, '-c', 'import serial, requests, reportlab'])
    uri = subprocess.check_output(['lpstat', '-v', QUEUE], universal_newlines=True)
    if not re.search(r'socket://192\.168\.0\.167(?::9100)?\s*$', uri):
        raise RuntimeError('La cola Zebra no apunta a 192.168.0.167.')
    run(['sudo', '-u', 'rotoformas', 'lpstat', '-p', QUEUE])

    original = PILOT_ENV.read_text()
    config = values(original)
    if not re.fullmatch(r'[a-fA-F0-9]{64}', config.get('RPI_BRIDGE_TOKEN', '')):
        raise RuntimeError('Token del piloto no valido. No se ha cambiado nada.')
    if not re.fullmatch(r'https://script\.google\.com/(?:a/macros/rotoformas\.com|macros)/s/[A-Za-z0-9_-]+/exec', config.get('BRIDGE_URL', '')):
        raise RuntimeError('URL del piloto no valida. No se ha cambiado nada.')
    if not Path(config.get('SCALE_PORT', '/puerto-inexistente')).exists():
        raise RuntimeError('El puerto de bascula del piloto no existe.')

    # Comprobar conexion con salidas apagadas; no pedir trabajos ni guardar pesajes.
    probe = dict(config, ENABLE_PRINT='false', ENABLE_LASER='false')
    check_code = '''import importlib.util,json,os,sys
os.environ.update(json.load(sys.stdin))
s=importlib.util.spec_from_file_location('bridge',sys.argv[1])
b=importlib.util.module_from_spec(s)
s.loader.exec_module(b)
r=b.sync(os.environ['BRIDGE_URL'],os.environ['RPI_BRIDGE_TOKEN'],None,[])
assert r.get('ok') is True and r.get('job') is None
print('Conexion con MES correcta; sin solicitar trabajos.')
'''
    run([python, '-c', check_code, str(BUNDLE / 'bridge.py')], input=json.dumps(probe), universal_newlines=True)

    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup = ROOT / ('respaldo-zebra-' + stamp)
    backup.mkdir(mode=0o700)
    for src in (ROOT / 'bridge.py', TARGET_ENV, UNIT):
        if src.exists():
            shutil.copy2(str(src), str(backup / src.name))
    enabled = subprocess.run(['systemctl', 'is-enabled', '--quiet', 'rotoformas-scale-pilot']).returncode == 0
    (backup / 'piloto-habilitado.txt').write_text(str(enabled))

    replace = {'ENABLE_PRINT', 'ENABLE_LASER', 'ZEBRA_CUPS_QUEUE', 'BRIDGE_DB'}
    lines = [line for line in original.splitlines() if line.split('=', 1)[0].strip() not in replace]
    lines += ['ENABLE_PRINT=true', 'ENABLE_LASER=false', 'ZEBRA_CUPS_QUEUE=' + QUEUE,
              'BRIDGE_DB=/var/lib/rotoformas-bridge/jobs.sqlite3']
    staging = backup / 'nuevo.env'
    staging.write_text('\n'.join(lines) + '\n')
    staging.chmod(0o600)

    # No arrancar dos lectores USB. No borrar ni reiniciar SQLite ni trabajos previos.
    try:
        run(['systemctl', 'disable', '--now', 'rotoformas-scale-pilot'])
        shutil.copyfile(str(BUNDLE / 'bridge.py'), str(ROOT / 'bridge.py'))
        (ROOT / 'bridge.py').chmod(0o644)
        shutil.copyfile(str(BUNDLE / 'rotoformas-bridge.service'), str(UNIT))
        UNIT.chmod(0o644)
        shutil.copyfile(str(staging), str(TARGET_ENV))
        TARGET_ENV.chmod(0o600)
        run(['systemctl', 'daemon-reload'])
        run(['systemctl', 'enable', '--now', 'rotoformas-bridge'])
        time.sleep(5)
        run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge'])
        run(['systemctl', 'status', 'rotoformas-bridge', '--no-pager', '-l'])
    except Exception:
        subprocess.run(['systemctl', 'disable', '--now', 'rotoformas-bridge'])
        for dst in (ROOT / 'bridge.py', TARGET_ENV, UNIT):
            saved = backup / dst.name
            if saved.exists():
                shutil.copy2(str(saved), str(dst))
        subprocess.run(['systemctl', 'daemon-reload'])
        if enabled:
            subprocess.run(['systemctl', 'enable', 'rotoformas-scale-pilot'])
        subprocess.run(['systemctl', 'start', 'rotoformas-scale-pilot'])
        raise RuntimeError('Fallo de arranque; se ha intentado restaurar el piloto. Revisar su estado.')

    print('Puente activo: bascula + Zebra. Laser apagado.')
    print('Respaldo privado: ' + str(backup))
    print('Falta confirmar RPI_PRINT_ENABLED=true en Apps Script y probar una etiqueta real.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('INSTALACION DETENIDA: ' + str(exc), file=sys.stderr)
        sys.exit(1)

