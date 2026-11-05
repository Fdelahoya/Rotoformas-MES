#!/usr/bin/env python3
"""Habilita solo la actualizacion de V1 por el puente ya instalado."""
import datetime
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Ejecuta con sudo python3 enable_laser_v1.py')
    env = Path('/etc/rotoformas-bridge.env')
    original = env.read_text()
    values = {}
    for line in original.splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('\"\'')
    if values.get('ENABLE_PRINT') != 'true':
        raise RuntimeError('Se requiere el puente de impresion ya habilitado.')
    code = Path('/opt/rotoformas-bridge/bridge.py').read_text()
    if 'def send_laser_v1(url):' not in code or 'def output_enabled(name):' not in code:
        raise RuntimeError('El puente instalado no es la version esperada.')
    subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge'], check=True)
    # Solo comprueba conectividad; no envia V1 ni comandos de marcado.
    with socket.create_connection(('192.168.0.30', 8050), timeout=3):
        pass
    print('Conexion TCP con laser correcta; no se ha enviado ningun comando.')
    backup = env.with_name(env.name + '.antes-laser-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    shutil.copy2(str(env), str(backup))
    backup.chmod(0o600)
    replace = {'ENABLE_LASER', 'LASER_HOST', 'LASER_PORT'}
    lines = [line for line in original.splitlines() if line.split('=', 1)[0].strip() not in replace]
    lines += ['ENABLE_LASER=true', 'LASER_HOST=192.168.0.30', 'LASER_PORT=8050']
    staging = env.with_name(env.name + '.nuevo-laser')
    fd = os.open(str(staging), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as out:
        out.write('\n'.join(lines) + '\n')
    os.replace(str(staging), str(env))
    try:
        subprocess.run(['systemctl', 'restart', 'rotoformas-bridge'], check=True)
        time.sleep(5)
        subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge'], check=True)
    except Exception:
        shutil.copy2(str(backup), str(env))
        subprocess.run(['systemctl', 'restart', 'rotoformas-bridge'])
        raise RuntimeError('Fallo de arranque; se ha restaurado el entorno anterior. Revisar estado.')
    subprocess.run(['systemctl', 'status', 'rotoformas-bridge', '--no-pager', '-l'], check=True)
    print('Actualizacion V1 habilitada para 192.168.0.30:8050. Marcado manual.')
    print('Respaldo privado: ' + str(backup))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('ACTIVACION DETENIDA: ' + str(exc), file=sys.stderr)
        sys.exit(1)
