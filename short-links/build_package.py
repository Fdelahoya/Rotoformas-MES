"""Build upload ZIP and keep the MES credential separately, outside the repository."""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import zipfile


def build(destination):
    source = Path(__file__).resolve().parent
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    private = destination / 'private'
    private.mkdir(exist_ok=True)
    credentials = private / 'mes-properties.json'
    if credentials.exists():
        token = json.loads(credentials.read_text(encoding='utf-8'))['SHORT_QR_API_TOKEN']
        if len(token) != 64 or any(c not in 'abcdef0123456789' for c in token):
            raise ValueError('Invalid saved API key; not rotating automatically')
    else:
        token = secrets.token_hex(32)
        credentials.write_text(json.dumps({'SHORT_QR_API_TOKEN': token}, indent=2), encoding='utf-8')
    config = (source / 'config.example.php').read_text(encoding='utf-8').replace(
        'REPLACE_WITH_SHA256_OF_API_TOKEN', hashlib.sha256(token.encode()).hexdigest())
    package = destination / 'rotoformas-enlaces-cortos.zip'
    with zipfile.ZipFile(package, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in ('index.php', 'service.php', '.htaccess'):
            archive.write(source / name, arcname=name)
        archive.writestr('config.php', config)
    with zipfile.ZipFile(package) as archive:
        if any(token.encode() in archive.read(name) for name in archive.namelist()):
            raise RuntimeError('API key must never be included in upload package')
    print('ZIP listo:', package)
    print('Credencial conservada por separado; no incluida en el ZIP.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('destination')
    build(parser.parse_args().destination)
