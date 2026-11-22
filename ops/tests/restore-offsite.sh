#!/usr/bin/env bash
# Real OpenSSH SFTP subsystem (local pipe, not SSH authentication), CMS and digest checks.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd); t=$(mktemp -d); trap 'rm -rf -- "$t"' EXIT
export TEST_STORE="$t/store" TEST_RUN="$t/docker-run" BACKUP_CERT="$t/pub" BACKUP_KEY="$t/key" BACKUP_KNOWN_HOSTS="$t/hosts" BACKUP_SSH_CONFIG="$t/config" BACKUP_DIR="$t/local" PATH="$t:$PATH"
mkdir "$TEST_STORE"; touch "$BACKUP_SSH_CONFIG"; echo fixture > "$BACKUP_KNOWN_HOSTS"
openssl req -x509 -newkey rsa:2048 -noenc -days 1 -subj '/CN=Disposable test' -keyout "$BACKUP_KEY" -out "$BACKUP_CERT" 2>/dev/null
cat > "$t/sftp" <<'STUB'
#!/bin/sh
exec /usr/bin/sftp -q -b - -D "/usr/lib/openssh/sftp-server -d $TEST_STORE" local
STUB
cat > "$t/docker" <<'STUB'
#!/usr/bin/env bash
set -eu
case "$*" in compose*) printf 'fixture archive';; run*) touch "$TEST_RUN"; echo dummy;; *pg_restore*) [[ $(cat) = 'fixture archive' ]];; *pg_isready*|*psql*|rm*) :;; *) exit 1;; esac
STUB
chmod +x "$t"/{docker,sftp}; "$root/ops/backup-offsite" > "$t/log"
read -r hash name < <(tail -1 "$t/log"); rm "$BACKUP_DIR/$name"
"$root/ops/restore-offsite" "$name" "$hash"; [[ -f $TEST_RUN ]]; rm "$TEST_RUN"
printf changed >> "$TEST_STORE/$name"
if "$root/ops/restore-offsite" "$name" "$hash"; then exit 1; fi
if "$root/ops/restore-offsite" "../$name" "$hash"; then exit 1; fi
[[ ! -e $TEST_RUN ]]; echo 'Offsite recovery source and digest checks passed.'
