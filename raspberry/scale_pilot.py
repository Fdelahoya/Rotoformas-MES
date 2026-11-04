#!/usr/bin/env python3
"""Entrada exclusiva de bascula; no permite habilitar impresora ni laser."""
import os


def main():
    for name in ('ENABLE_PRINT', 'ENABLE_LASER'):
        if os.environ.get(name) not in (None, 'false'):
            raise RuntimeError('El piloto de bascula requiere ' + name + '=false')
        os.environ[name] = 'false'
    from bridge import main as run_bridge
    run_bridge()


if __name__ == '__main__':
    main()
