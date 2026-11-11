"""Generate a patch for Semyon's repo from the ORIGINAL nginx config (never write it)."""
import difflib
import pathlib
import sys

if len(sys.argv) != 2:
    sys.exit('Usage: python3 infra/scripts/nginx-append-patch.py nginx-tls.conf.before-parsec > parsec.patch')
sys.stdout.reconfigure(encoding='utf-8', newline='\n')
original = pathlib.Path(sys.argv[1]).read_bytes().decode('utf-8')
if 'server_name parsec.toolzar.ru;' in original or 'server_name api.parsec.toolzar.ru;' in original:
    sys.exit('Original config already contains Parsec; refusing duplicate append')
nginx = pathlib.Path(__file__).resolve().parent.parent / 'nginx'
fragment = ''.join((nginx / name).read_text(encoding='utf-8') for name in (
    'klaster-key-parsec-http.conf', 'klaster-key-parsec-https.conf',
))
if fragment != (nginx / 'klaster-key-parsec.conf').read_text(encoding='utf-8'):
    sys.exit('Combined nginx reference differs from HTTP + HTTPS fragments')
updated = original + '\n\n' + fragment
for line in difflib.unified_diff(
    original.splitlines(keepends=True), updated.splitlines(keepends=True),
    fromfile='a/deploy/nginx-tls.conf', tofile='b/deploy/nginx-tls.conf',
):
    sys.stdout.write(line)
    if not line.endswith('\n'):
        sys.stdout.write('\n\\ No newline at end of file\n')
