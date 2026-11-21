#!/usr/bin/env bash
# SYS08 - LaPrizza backups.
#   hourly: logical dump of the PostgreSQL database, encrypted with age, kept
#           locally and copied off-site (Backblaze B2).
#   daily:  everything the hourly run does, plus a restore drill into a
#           disposable PostgreSQL container (writes verified.json for SYS01)
#           and an encrypted copy of the server configuration and DB roles.
# Installed as /usr/local/sbin/laprizza-backup and run by cron as root.
set -Eeuo pipefail
umask 077

MODE=${1:-}
[[ "$MODE" == hourly || "$MODE" == daily ]] || { echo "Usage: $0 hourly|daily" >&2; exit 64; }

CONF=${LAPRIZZA_BACKUP_CONF:-/etc/laprizza/backup/backup.conf}
[[ -r "$CONF" ]] || { echo "Missing configuration file $CONF" >&2; exit 2; }
# shellcheck source=/dev/null
source "$CONF"
: "${B2_BUCKET:?B2_BUCKET is required}" "${B2_ENDPOINT:?B2_ENDPOINT is required}"
RETENTION_DAYS=${RETENTION_DAYS:-14}
MIN_LOCAL_COPIES=${MIN_LOCAL_COPIES:-24}
MIN_CONFIG_COPIES=${MIN_CONFIG_COPIES:-7}
MIN_FREE_MB=${MIN_FREE_MB:-1024}
PG_IMAGE=${PG_IMAGE:-postgres:18}
AWS_IMAGE=${AWS_IMAGE:-amazon/aws-cli}
PG_ENV=${PG_ENV:-/root/.config/laprizza/pgbackup.env}
B2_ENV=${B2_ENV:-/root/.config/laprizza/b2.env}
RECIPIENTS=${RECIPIENTS:-/etc/laprizza/backup/age-recipients.txt}
BASE=${BACKUP_BASE:-/var/backups/laprizza}
STATE_DIR=${STATE_DIR:-/var/lib/laprizza/backups}
GDPR_DIR=${GDPR_DIR:-/var/lib/laprizza/gdpr}
LOG_DIR=${BACKUP_LOG_DIR:-/var/log/laprizza/backup}
CONFIG_PATHS=${CONFIG_PATHS:-"/etc/laprizza /root/.config/laprizza /etc/cron.d/laprizza-backup /etc/logrotate.d/laprizza /etc/gai.conf /var/lib/laprizza/shared-resources"}
DB_DIR="$BASE/db"; CFG_DIR="$BASE/config"; TMP_BASE="$BASE/tmp"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
ID="laprizza-db-$STAMP"
WORK=''
DRILL_NET=''; DRILL_DB=''; DRILL_API=''
OFFSITE=false
VERIFIED=false

log() { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$MODE" "$*"; }

write_status() {
  local success=$1 message=$2
  install -d -m 0755 "$STATE_DIR" 2>/dev/null || true
  python3 - "$STATE_DIR/last-backup.json" "$ID" "$MODE" "$success" "$OFFSITE" "$VERIFIED" "$message" <<'PY' || true
import datetime, json, os, sys
path, backup_id, mode, success, offsite, verified, message = sys.argv[1:]
data = {
  'backup_id': backup_id, 'mode': mode,
  'finished_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
  'success': success == 'true', 'offsite_copy': offsite == 'true',
  'restore_verified': verified == 'true', 'message': message,
}
tmp = path + '.tmp'
with open(tmp, 'w') as f:
  json.dump(data, f); f.write('\n')
os.chmod(tmp, 0o644)
os.replace(tmp, path)
PY
}

fail() {
  trap - ERR
  set +e
  log "ERROR: $*"
  write_status false "$*"
  exit 1
}
trap 'fail "unexpected error at line $LINENO"' ERR

cleanup() {
  [[ -n "$DRILL_API" ]] && docker rm -f "$DRILL_API" >/dev/null 2>&1
  [[ -n "$DRILL_DB" ]] && docker rm -f "$DRILL_DB" >/dev/null 2>&1
  [[ -n "$DRILL_NET" ]] && docker network rm "$DRILL_NET" >/dev/null 2>&1
  [[ -n "$WORK" && -d "$WORK" ]] && rm -rf -- "$WORK"
  return 0
}
trap cleanup EXIT

sha() { sha256sum "$1" | cut -d' ' -f1; }

# Runs the S3 client against Backblaze B2. /backups and /gdpr are the local folders.
b2() {
  docker run --rm --log-driver none --env-file "$B2_ENV" \
    -v "$BASE:/backups" -v "$GDPR_DIR:/gdpr:ro" \
    "$AWS_IMAGE" --endpoint-url "$B2_ENDPOINT" "$@"
}

b2_upload() { # local path inside /backups or /gdpr, remote key
  local attempt
  for attempt in 1 2 3; do
    if b2 s3 cp --only-show-errors "$1" "s3://$B2_BUCKET/$2"; then return 0; fi
    log "upload of $2 failed (attempt $attempt)"; sleep $((attempt * 10))
  done
  return 1
}

# Deletes files older than RETENTION_DAYS, always keeping the newest $3 copies.
prune() {
  local dir=$1 pattern=$2 keep=$3 cutoff count=0 mtime file
  cutoff=$(( $(date +%s) - RETENTION_DAYS * 86400 ))
  while read -r mtime file; do
    count=$((count + 1))
    (( count <= keep )) && continue
    (( ${mtime%.*} < cutoff )) || continue
    rm -f -- "$file"
    [[ "$file" == *.dump.age ]] && rm -f -- "${file%.dump.age}.manifest.json"
    log "retention: removed $(basename "$file")"
  done < <(find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\n' | sort -rn)
}

active_api_image() {
  local cid
  cid=$(docker ps -q --filter label=com.docker.compose.project=laprizza --filter label=com.docker.compose.service=api | head -n 1)
  [[ -n "$cid" ]] || return 1
  docker inspect --format '{{.Image}}' "$cid"
}

restore_drill() {
  local pw jwt img t0 t1 t2 restored_schema expected_tables restored_tables ready=false healthy=false
  DRILL_NET="laprizza-drill-$$"; DRILL_DB="laprizza-drill-db-$$"; DRILL_API="laprizza-drill-api-$$"
  pw=$(openssl rand -hex 24); jwt=$(openssl rand -hex 32)

  docker network create --internal "$DRILL_NET" >/dev/null
  docker run -d --rm --name "$DRILL_DB" --network "$DRILL_NET" --network-alias drill-db \
    --log-driver none -e POSTGRES_DB=laprizza_drill -e POSTGRES_USER=drill \
    -e "POSTGRES_PASSWORD=$pw" "$PG_IMAGE" >/dev/null
  for _ in $(seq 1 60); do
    if docker exec "$DRILL_DB" pg_isready -U drill -d laprizza_drill >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" == true ]] || fail "drill: disposable PostgreSQL did not start"

  t0=$(date +%s)
  docker run --rm --log-driver none --network "$DRILL_NET" -v "$WORK:/work:ro" \
    -e "PGPASSWORD=$pw" "$PG_IMAGE" pg_restore -h drill-db -U drill -d laprizza_drill \
    --no-owner --no-privileges --exit-on-error /work/db.dump || fail "drill: pg_restore failed"
  t1=$(date +%s)
  log "drill: restore completed in $((t1 - t0))s"

  restored_schema=$(docker exec "$DRILL_DB" psql -U drill -d laprizza_drill -At \
    -c "SELECT name FROM public.schema_migrations ORDER BY name DESC LIMIT 1")
  [[ "$restored_schema" == "$SCHEMA" ]] || fail "drill: schema $restored_schema differs from $SCHEMA"
  expected_tables=$(grep -cE '^[0-9]+; [0-9]+ [0-9]+ TABLE public ' "$WORK/db.toc" || true)
  restored_tables=$(docker exec "$DRILL_DB" psql -U drill -d laprizza_drill -At \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
  [[ "$restored_tables" == "$expected_tables" ]] || fail "drill: $restored_tables tables restored, $expected_tables expected"
  docker exec "$DRILL_DB" psql -U drill -d laprizza_drill -At -F ' ' -c "
    SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
    FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1" \
    > "$LOG_DIR/drill-$STAMP-row-counts.txt"
  log "drill: schema $restored_schema, $restored_tables tables (row counts in drill-$STAMP-row-counts.txt)"

  img=$(active_api_image) || fail "drill: no running LaPrizza API container to test with"
  docker run -d --rm --name "$DRILL_API" --network "$DRILL_NET" --network-alias drill-api \
    --log-driver none --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
    -e NODE_ENV=production -e PORT=3000 -e PGHOST=drill-db -e PGPORT=5432 \
    -e PGDATABASE=laprizza_drill -e PGUSER=drill -e "PGPASSWORD=$pw" -e PGSSLMODE=disable \
    -e "JWT_SECRET=$jwt" -e SESSION_COOKIE_SECURE=true -e CORS_ORIGIN=https://sys08.invalid \
    -e AUTH_IDLE_TIMEOUT_SECONDS=3600 -e ACTIVITY_REPORT_INTERVAL_SECONDS=300 \
    -e ACCESS_TOKEN_TTL=15m "$img" >/dev/null
  for _ in $(seq 1 30); do
    if docker run --rm --log-driver none --network "$DRILL_NET" "$img" node -e \
      "Promise.all(['health','catalogue'].map(p=>fetch('http://drill-api:3000/api/v1/'+p).then(r=>{if(!r.ok)throw p}))).then(()=>process.exit(0),()=>process.exit(1))" \
      >/dev/null 2>&1; then healthy=true; break; fi
    sleep 2
  done
  [[ "$healthy" == true ]] || fail "drill: API health/catalogue checks failed on the restored database"
  t2=$(date +%s)
  log "drill: API health and catalogue OK on the restored database ($((t2 - t0))s total)"

  python3 - "$STATE_DIR/verified.json" "$ID" "$SCHEMA" "$((t1 - t0))" "$((t2 - t0))" "$restored_tables" <<'PY'
import datetime, json, os, sys
path, backup_id, schema, restore_s, drill_s, tables = sys.argv[1:]
data = {
  'backup_id': backup_id, 'schema_version': schema,
  'verified_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
  'restorable': True, 'restore_seconds': int(restore_s), 'drill_seconds': int(drill_s),
  'tables': int(tables), 'checks': ['pg_restore', 'schema_version', 'table_count', 'api_health', 'api_catalogue'],
}
tmp = path + '.tmp'
with open(tmp, 'w') as f:
  json.dump(data, f); f.write('\n')
os.chmod(tmp, 0o644)
os.replace(tmp, path)
PY
  VERIFIED=true
  docker rm -f "$DRILL_API" "$DRILL_DB" >/dev/null 2>&1 || true
  docker network rm "$DRILL_NET" >/dev/null 2>&1 || true
  DRILL_NET=''; DRILL_DB=''; DRILL_API=''
}

config_backup() {
  local name="laprizza-config-$STAMP.tar.gz.age" gname="laprizza-globals-$STAMP.sql.age" p
  local -a paths=()
  for p in $CONFIG_PATHS; do [[ -e "$p" ]] && paths+=("${p#/}"); done
  tar -C / -czpf "$WORK/config.tar.gz" "${paths[@]}"
  age -R "$RECIPIENTS" -o "$CFG_DIR/$name" "$WORK/config.tar.gz"
  b2_upload "/backups/config/$name" "config/$name" || fail "off-site copy of $name failed"
  log "config: ${#paths[@]} paths archived and copied off-site ($name)"

  if docker run --rm --log-driver none --env-file "$PG_ENV" "$PG_IMAGE" \
       sh -c 'pg_dumpall --globals-only --no-role-passwords -l "$PGDATABASE"' > "$WORK/globals.sql"; then
    age -R "$RECIPIENTS" -o "$CFG_DIR/$gname" "$WORK/globals.sql"
    b2_upload "/backups/config/$gname" "config/$gname" || fail "off-site copy of $gname failed"
    log "config: database roles copied ($gname)"
  else
    log "WARNING: pg_dumpall --globals-only failed; roles were not copied"
  fi
  prune "$CFG_DIR" 'laprizza-config-*.tar.gz.age' "$MIN_CONFIG_COPIES"
  prune "$CFG_DIR" 'laprizza-globals-*.sql.age' "$MIN_CONFIG_COPIES"
}

# ---------------------------------------------------------------- main
exec 9>/var/lock/laprizza-backup.lock
flock -n 9 || { log "another backup run is still active; skipping"; exit 75; }

for f in "$PG_ENV" "$B2_ENV" "$RECIPIENTS"; do [[ -r "$f" ]] || fail "missing $f"; done
command -v age >/dev/null || fail "age is not installed"
install -d -m 0700 "$BASE" "$DB_DIR" "$CFG_DIR" "$TMP_BASE"
install -d -m 0750 "$LOG_DIR"
WORK=$(mktemp -d "$TMP_BASE/$ID.XXXXXX")
WORK_IN_CONTAINER="/backups/${WORK#"$BASE"/}"

free_mb=$(df -Pm "$BASE" | awk 'NR==2 {print $4}')
(( free_mb >= MIN_FREE_MB )) || fail "only ${free_mb} MB free in $BASE (minimum $MIN_FREE_MB MB)"

log "starting $ID"
t_start=$(date +%s)
docker run --rm --log-driver none --env-file "$PG_ENV" "$PG_IMAGE" pg_dump -Fc --no-password \
  > "$WORK/db.dump" || fail "pg_dump failed"
[[ -s "$WORK/db.dump" ]] || fail "pg_dump produced an empty file"
docker run --rm --log-driver none -v "$WORK:/work:ro" "$PG_IMAGE" pg_restore --list /work/db.dump \
  > "$WORK/db.toc" || fail "the dump could not be read by pg_restore"
SCHEMA=$(docker run --rm --log-driver none --env-file "$PG_ENV" "$PG_IMAGE" psql -At \
  -c "SELECT name FROM public.schema_migrations ORDER BY name DESC LIMIT 1") || fail "could not read schema version"
PG_DUMP_VERSION=$(docker run --rm --log-driver none "$PG_IMAGE" pg_dump --version)
TABLES_WITH_DATA=$(grep -c ' TABLE DATA public ' "$WORK/db.toc" || true)
log "dump: $(stat -c %s "$WORK/db.dump") bytes, schema $SCHEMA, $TABLES_WITH_DATA tables with data ($(( $(date +%s) - t_start ))s)"

age -R "$RECIPIENTS" -o "$DB_DIR/$ID.dump.age" "$WORK/db.dump"
python3 - "$DB_DIR/$ID.manifest.json" "$ID" "$MODE" "$SCHEMA" "$PG_DUMP_VERSION" "$TABLES_WITH_DATA" \
  "$(stat -c %s "$WORK/db.dump")" "$(sha "$WORK/db.dump")" "$(stat -c %s "$DB_DIR/$ID.dump.age")" "$(sha "$DB_DIR/$ID.dump.age")" "$STAMP" <<'PY'
import datetime, json, sys
(path, bid, mode, schema, pgv, tables, size, sha_plain, esize, sha_enc, stamp) = sys.argv[1:]
created = datetime.datetime.strptime(stamp, '%Y%m%dT%H%M%SZ').strftime('%Y-%m-%dT%H:%M:%SZ')
json.dump({
  'backup_id': bid, 'created_at': created, 'mode': mode, 'schema_version': schema,
  'pg_dump_version': pgv, 'tables_with_data': int(tables), 'format': 'pg_dump custom (-Fc), age-encrypted',
  'dump_size_bytes': int(size), 'dump_sha256': sha_plain,
  'encrypted_file': bid + '.dump.age', 'encrypted_size_bytes': int(esize), 'encrypted_sha256': sha_enc,
}, open(path, 'w'), indent=2)
PY
log "encrypted copy stored locally: $DB_DIR/$ID.dump.age"

b2_upload "/backups/db/$ID.dump.age" "db/$ID.dump.age" || fail "off-site copy failed (local copy kept)"
b2_upload "/backups/db/$ID.manifest.json" "db/$ID.manifest.json" || fail "off-site manifest copy failed"
b2 s3 cp --only-show-errors "s3://$B2_BUCKET/db/$ID.dump.age" "$WORK_IN_CONTAINER/remote-check.age" || fail "could not read back the off-site copy"
[[ "$(sha "$WORK/remote-check.age")" == "$(sha "$DB_DIR/$ID.dump.age")" ]] || fail "off-site copy checksum mismatch"
OFFSITE=true
log "off-site copy verified (s3://$B2_BUCKET/db/$ID.dump.age)"

if [[ -s "$GDPR_DIR/erasure-register.log" ]]; then
  b2_upload /gdpr/erasure-register.log gdpr/erasure-register.log || fail "off-site copy of the GDPR register failed"
fi

if [[ "$MODE" == daily ]]; then
  restore_drill
  config_backup
fi

prune "$DB_DIR" 'laprizza-db-*.dump.age' "$MIN_LOCAL_COPIES"
write_status true "backup completed in $(( $(date +%s) - t_start ))s"
log "finished $ID in $(( $(date +%s) - t_start ))s"