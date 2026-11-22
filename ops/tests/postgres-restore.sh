#!/usr/bin/env bash
# A real application-level drill. Creates both clusters from scratch; never connects to Compose.
set -euo pipefail
umask 077
root=$(cd "$(dirname "$0")/../.." && pwd); cd "$root/apps/api"
d=$(mktemp -d /tmp/rahmani-drill.XXXXXXXX); export DRILL_DIR="$d" PGDATABASE=postgres PGUSER=drill PGPASSWORD=ephemeral-drill PGPORT=5432 STAFF_MFA_KEY=$(openssl rand -hex 32)
unset PGOPTIONS PGSERVICE PGSERVICEFILE PUBLIC_ORIGIN ZARINPAL_MERCHANT_ID
cleanup(){ for name in source target; do if [[ -s $d/$name/postmaster.pid ]]; then pg_ctl -D "$d/$name" -m immediate -w stop >/dev/null || return 1; fi; done; rm -rf -- "$d"; }; trap cleanup EXIT
start(){ export PGHOST="$d/$1-socket"; mkdir "$PGHOST"; initdb -A trust --no-locale -E UTF8 -U drill -D "$d/$1" >/dev/null; pg_ctl -w -D "$d/$1" -l "$d/$1.log" -o "-c listen_addresses='' -k $PGHOST -p 5432" start >/dev/null; }
start source
node tests/restore-app.mjs seed
openssl req -x509 -newkey rsa:3072 -noenc -days 1 -subj '/CN=Ephemeral drill' -keyout "$d/key" -out "$d/cert" 2>/dev/null
pg_dump -Fc --no-owner --no-privileges | openssl cms -encrypt -binary -stream -outform DER -aes-256-gcm -out "$d/archive" "$d/cert"
pg_ctl -w -D "$d/source" -m fast stop >/dev/null
start target
begin=$SECONDS
openssl cms -decrypt -binary -inform DER -in "$d/archive" -recip "$d/cert" -inkey "$d/key" | pg_restore -d postgres --single-transaction --exit-on-error --no-owner --no-privileges
node tests/restore-app.mjs verify
printf 'Real restore + application verification: %ss (%s)\n' "$((SECONDS-begin))" "$(pg_restore --version)"
