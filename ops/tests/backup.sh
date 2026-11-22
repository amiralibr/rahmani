#!/usr/bin/env bash
# Real CMS crypto and file handling; stub only the unavailable container engine.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd); tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
export BACKUP_DIR="$tmp/archives" BACKUP_KEY="$tmp/key.pem" BACKUP_CERT="$tmp/cert.pem" DUMMY="$tmp/dump" PATH="$tmp:$PATH"
openssl req -x509 -newkey rsa:3072 -noenc -days 1 -subj '/CN=Drill test' -keyout "$BACKUP_KEY" -out "$BACKUP_CERT" 2>/dev/null
printf 'PGDMP\0fake archive\xff' > "$DUMMY"
cat > "$tmp/docker" <<'STUB'
#!/usr/bin/env bash
case "$1 $*" in
 compose*) cat "$DUMMY"; exit "${DUMP_STATUS:-0}";;
 run*) echo dummy;;
 *pg_isready*) exit 0;;
 *pg_restore*) cmp "$DUMMY" -;;
 *psql*) exit 0;;
 rm*) touch "$DUMMY.cleaned";;
 *) exit 2;;
esac
STUB
chmod +x "$tmp/docker"; archive=$("$root/ops/backup"); [[ $(stat -c %a "$archive") = 600 ]]
"$root/ops/restore-drill" "$archive"; [[ -f $DUMMY.cleaned ]]
if DUMP_STATUS=1 "$root/ops/backup"; then exit 1; fi
[[ $(find "$BACKUP_DIR" -type f | wc -l) = 1 ]]
head -c 150 "$archive" > "$tmp/broken"; rm "$DUMMY.cleaned"
if "$root/ops/restore-drill" "$tmp/broken" 2>/dev/null; then exit 1; fi
[[ -f $DUMMY.cleaned ]]; echo 'Backup pipeline checks passed (Docker stub).'
