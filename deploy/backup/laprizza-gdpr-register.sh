#!/usr/bin/env bash
# SYS08 - records a completed GDPR erasure or restriction request, so that any
# later restore re-applies it (laprizza-restore gdpr-replay).
#   laprizza-gdpr-register <request-id> <erase|restrict> <customer|user> <subject-id> [--register FILE]
# The register holds identifiers and dates only, never names or contacts.
set -Eeuo pipefail
umask 077

REQUEST=${1:-}; ACTION=${2:-}; TYPE=${3:-}; SUBJECT=${4:-}
REGISTER=/var/lib/laprizza/gdpr/erasure-register.log
[[ "${5:-}" == --register ]] && REGISTER=${6:?--register needs a file}

[[ "$REQUEST" =~ ^[A-Za-z0-9._-]{1,40}$ ]] || { echo "Usage: $0 <request-id> <erase|restrict> <customer|user> <subject-id>" >&2; exit 64; }
[[ "$ACTION" == erase || "$ACTION" == restrict ]] || { echo "action must be erase or restrict" >&2; exit 64; }
[[ "$TYPE" == customer || "$TYPE" == user ]] || { echo "type must be customer or user" >&2; exit 64; }
[[ "$SUBJECT" =~ ^[A-Za-z0-9-]{1,64}$ ]] || { echo "invalid subject id" >&2; exit 64; }

install -d -m 0700 "$(dirname "$REGISTER")"
exec 9>>"$REGISTER"
flock 9
if [[ ! -s "$REGISTER" ]]; then
  echo '# completed_at_utc|request|action|type|subject_id' >&9
fi
line="$(date -u +%Y-%m-%dT%H:%M:%SZ)|$REQUEST|$ACTION|$TYPE|$SUBJECT"
echo "$line" >&9
chmod 0600 "$REGISTER"
echo "recorded: $line"
echo "The register is copied off-site by the next hourly backup."