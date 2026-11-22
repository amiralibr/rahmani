#!/usr/bin/env bash
# Exercise real encryption / comparison; simulate SFTP storage and Docker only.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd); tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
export PATH="$tmp:$PATH" BACKUP_CERT="$tmp/pub" BACKUP_DIR="$tmp/local store" BACKUP_SSH_CONFIG="$tmp/config" BACKUP_KNOWN_HOSTS="$tmp/hosts" REMOTE="$tmp/remote"
mkdir "$REMOTE"; touch "$BACKUP_SSH_CONFIG"; echo stub > "$BACKUP_KNOWN_HOSTS"
openssl req -x509 -newkey rsa:2048 -noenc -days 1 -subj '/CN=test' -keyout "$tmp/key" -out "$BACKUP_CERT" 2>/dev/null
printf '#!/bin/sh\necho TEST\n' > "$tmp/docker"
cat > "$tmp/sftp" <<'STUB'
#!/usr/bin/env bash
set -eu
[[ "$*" == *StrictHostKeyChecking=yes* ]]
while read -r cmd a b; do case "$cmd" in
put) cp "$a" "$REMOTE/$b";;
get) cp "$REMOTE/$a" "$b"; if [[ ${CORRUPT:-} ]]; then echo bad >> "$b"; fi;;
rename) mv "$REMOTE/$a" "$REMOTE/$b";; *) exit 1;; esac; done
STUB
chmod +x "$tmp/docker" "$tmp/sftp"; "$root/ops/backup-offsite"; cmp "$BACKUP_DIR"/*.cms "$REMOTE"/*.cms
if CORRUPT=1 "$root/ops/backup-offsite"; then exit 1; fi
[[ $(find "$REMOTE" -name '*.cms'|wc -l) = 1 && $(find "$BACKUP_DIR" -name '*.cms'|wc -l) = 2 ]]; echo 'Offsite pipeline checks passed (simulated SFTP).'
