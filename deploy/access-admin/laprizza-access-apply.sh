#!/usr/bin/env bash
# laprizza-access-apply - validate and publish the allowed-networks list (SYS03)
set -euo pipefail
umask 077

CAND=/var/lib/laprizza-access/edit/allowed-networks.conf
LIVE=/etc/laprizza/access/allowed-networks.conf
TRUSTED=/etc/laprizza/access/trusted-proxies.conf
HIST=/var/lib/laprizza-access/history
WORK_ROOT=/var/lib/laprizza-access/work
LOG=/var/log/laprizza-access/changes.log
LOCK=/var/lock/laprizza-deploy.lock
CHECK=/usr/local/lib/laprizza/access_check.py
CERT=/etc/laprizza/tls/laprizza.crt
WEB=laprizza-web-1
NET=laprizza-backend
WHO=${SUDO_USER:-$(id -un)}

log()  { printf '%s user=%s result=%s %s\n' "$(date -Is)" "$WHO" "$1" "$2" >> "$LOG"; }
fail() { log REJECTED "reason=\"$1\" (live list unchanged)"; echo "REJECTED: $1" >&2; exit 1; }
flat() { tr '\n' ' ' <<<"$1"; }

# --- lock shared with deploy.sh / rollback.sh (never create it as root-only) ---
[[ -f "$LOCK" && ! -L "$LOCK" ]] || fail "Missing or invalid lock file: $LOCK"
exec 9<"$LOCK" || fail "Could not open $LOCK"
flock -w 120 9 || fail "could not obtain $LOCK within 120 s (deploy or rollback running?)"

WORK=$(mktemp -d "$WORK_ROOT/apply.XXXXXX")
NEW=""
trap 'rm -rf "$WORK"; if [[ -n $NEW ]]; then rm -f "$NEW"; fi' EXIT

# --- one protected copy of the candidate; everything below uses only this copy ---
if [[ -L $CAND || ! -f $CAND ]]; then fail "candidate is missing, not a regular file, or a symlink"; fi
if (( $(stat -c %s "$CAND") > 65536 )); then fail "candidate is larger than 64 KiB"; fi
SNAP=$WORK/allowed-networks.conf
cp --no-dereference -- "$CAND" "$SNAP"
if [[ -L $SNAP || ! -f $SNAP ]]; then fail "candidate changed type while being copied"; fi
if (( $(stat -c %s "$SNAP") > 65536 )); then fail "candidate is larger than 64 KiB"; fi
chmod 644 "$SNAP"

# --- format + SYS02 policy (baseline, no broad/public allow, no duplicates, gateway allowed) ---
GW=$(docker network inspect "$NET" --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}') \
  || fail "cannot read the gateway of $NET"
if ! out=$("$CHECK" "$SNAP" "$GW" 2>&1); then fail "$(flat "$out")"; fi

if cmp -s "$SNAP" "$LIVE"; then echo "No changes."; exit 0; fi

# --- nginx -t on exactly this copy, same image ID and config as the running container ---
T=$WORK/nginxtest
install -d -m 755 "$T" "$T/access" "$T/conf"
install -d -m 700 "$T/logs"
NGX_UID=$(docker exec "$WEB" id -u) || fail "cannot query the web container"
chown "$NGX_UID" "$T/logs"
install -m 644 "$TRUSTED" "$T/access/trusted-proxies.conf"
install -m 644 "$SNAP" "$T/access/allowed-networks.conf"
docker exec "$WEB" cat /etc/nginx/conf.d/default.conf > "$T/conf/default.conf" \
  || fail "cannot read the running nginx config"
chmod 644 "$T/conf/default.conf"
IMG=$(docker inspect "$WEB" --format '{{.Image}}') || fail "cannot read the web image ID"
if ! out=$(docker run --rm --network "$NET" --entrypoint nginx \
      -v "$T/conf/default.conf:/etc/nginx/conf.d/default.conf:ro" \
      -v "$T/access:/etc/nginx/access:ro" \
      -v /etc/laprizza/tls:/etc/nginx/tls:ro \
      -v "$T/logs:/var/log/nginx/sys02" "$IMG" -t 2>&1); then
  fail "nginx -t failed: $(flat "$out")"
fi

# --- helpers for publishing and verifying ---
publish() {   # atomic replace of $LIVE (temp file in the same directory, then rename)
  local tmp
  tmp=$(mktemp "$(dirname "$LIVE")/.allowed-networks.XXXXXX") || return 1
  NEW=$tmp
  install -m 644 -o root -g root "$1" "$tmp" || return 1
  mv -f -- "$tmp" "$LIVE" || return 1
  NEW=""
}

workers() { docker top "$WEB" -eo pid,args | awk '/nginx: worker process/ {print $1}' | sort; }

reload_and_verify() {
  local before fresh i http https
  before=$(workers) || return 1
  [[ -n $before ]] || { echo "no running nginx workers found"; return 1; }
  docker kill --signal=HUP "$WEB" >/dev/null || { echo "HUP could not be sent"; return 1; }
  fresh=""
  for i in $(seq 1 15); do
    sleep 1
    fresh=$(comm -13 <(printf '%s\n' "$before") <(workers)) || true
    if [[ -n $fresh ]]; then break; fi
  done
  [[ -n $fresh ]] || { echo "nginx started no new workers (reload failed, old config still in memory)"; return 1; }
  http=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:2228/api/v1/health) || true
  https=$(curl -s --cacert "$CERT" -o /dev/null -w '%{http_code}' https://127.0.0.1:2229/api/v1/health) || true
  [[ $http == 301 && $https == 200 ]] || { echo "health check failed: 2228=$http 2229=$https"; return 1; }
}

# --- apply ---
TS=$(date +%Y%m%dT%H%M%S)
BACKUP=$HIST/allowed-networks.$TS.conf
cp -p -- "$LIVE" "$BACKUP" || fail "could not create backup $BACKUP"
DIFF=$(diff <(grep -v '^[[:space:]]*#' "$LIVE" || true) <(grep -v '^[[:space:]]*#' "$SNAP" || true) \
       | grep '^[<>]' | tr '\n' '|' || true)
SHA=$(sha256sum "$SNAP" | cut -d' ' -f1)

publish "$SNAP" || fail "could not install the new list"

if ! out=$(reload_and_verify 2>&1); then
  if publish "$BACKUP" && out2=$(reload_and_verify 2>&1); then
    log ROLLED_BACK "reason=\"$(flat "$out")\" restored=$BACKUP rejected_sha256=$SHA"
    echo "Reload check failed ($(flat "$out")). Previous list restored and verified." >&2
    exit 1
  fi
  log ROLLBACK_FAILED "reason=\"$(flat "$out")\" backup=$BACKUP rejected_sha256=$SHA"
  echo "CRITICAL: new list failed and the restore could not be verified. Backup: $BACKUP" >&2
  exit 2
fi

log APPLIED "sha256=$SHA changes=\"$DIFF\" backup=$BACKUP"
echo "APPLIED. Backup: $BACKUP"