#!/usr/bin/env python3
"""Actualiza solo el formato de fecha del puente; conserva configuracion y SQLite."""
import datetime
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Ejecuta con sudo python3 update_bridge.py')
    bundle = Path(__file__).resolve().parent
    target = Path('/opt/rotoformas-bridge/bridge.py')
    python = '/opt/rotoformas-bridge/venv/bin/python'
    # Todas las salidas de estas pruebas estan simuladas: no se contacta con equipos.
    test_code = (
        "import logging,sys,unittest; logging.disable(logging.CRITICAL); "
        "s=unittest.defaultTestLoader.discover(sys.argv[1],pattern='test_bridge.py'); "
        "r=unittest.TextTestRunner(verbosity=1).run(s); sys.exit(not r.wasSuccessful())"
    )
    subprocess.run([python, '-c', test_code, str(bundle)], check=True)
    subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge'], check=True)
    backup = target.with_name('bridge.py.antes-fecha-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    shutil.copy2(str(target), str(backup))
    staging = target.with_name('bridge.py.nuevo')
    shutil.copyfile(str(bundle / 'bridge.py'), str(staging))
    staging.chmod(0o644)
    os.replace(str(staging), str(target))
    try:
        subprocess.run(['systemctl', 'restart', 'rotoformas-bridge'], check=True)
        time.sleep(5)
        subprocess.run(['systemctl', 'is-active', '--quiet', 'rotoformas-bridge'], check=True)
    except Exception:
        shutil.copy2(str(backup), str(target))
        subprocess.run(['systemctl', 'restart', 'rotoformas-bridge'])
        raise RuntimeError('Fallo de arranque. Se ha restaurado el programa anterior; revisar estado.')
    subprocess.run(['systemctl', 'status', 'rotoformas-bridge', '--no-pager', '-l'], check=True)
    print('Correccion de fecha instalada. Configuracion y trabajos anteriores conservados.')
    print('Respaldo: ' + str(backup))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('ACTUALIZACION DETENIDA: ' + str(exc), file=sys.stderr)
        sys.exit(1)

