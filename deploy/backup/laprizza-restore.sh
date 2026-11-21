#!/usr/bin/env bash
# SYS08 - LaPrizza restore (always started manually by an administrator).
#
#   laprizza-restore list [--offsite]
#   laprizza-restore fetch <backup-id | config-file>   download a copy from Backblaze B2
#   laprizza-restore total <backup-id> --identity FILE [--target-env FILE] [--register FILE] [--yes]
#   laprizza-restore selective <backup-id> --identity FILE [--target-env FILE] [--register FILE]
#   laprizza-restore drop-temp <database> [--target-env FILE]
#   laprizza-restore gdpr-replay <backup-id> [--target-env FILE] [--register FILE]
#   laprizza-restore config <file.tar.gz.age> --identity FILE --to DIR
#
# Without --target-env the target is the production database used by the active
# release (/etc/laprizza/config/<revision>.env). Tests must use --target-env with
# a copy of that file pointing to a separate database (for example laprizza_sim).
set -Eeuo pipefail
umask 077

CONF=${LAPRIZZA_BACKUP_CONF:-/etc/laprizza/backup/backup.conf}
[[ -r "$CONF" ]] || { echo "Missing configuration file $CONF" >&2; exit 2; }
# shellcheck source=/dev/null
source "$CONF"
PG_IMAGE=${PG_IMAGE:-postgres:18}
AWS_IMAGE=${AWS_IMAGE:-amazon/aws-cli}
B2_ENV=${B2_ENV:-/root/.config/laprizza/b2.env}
BASE=${BACKUP_BASE:-/var/backups/laprizza}
STATE_DIR=${STATE_DIR:-/var/lib/laprizza/backups}
GDPR_DIR=${GDPR_DIR:-/var/lib/laprizza/gdpr}
GDPR_PROCEDURES=${GDPR_PROCEDURES:-/etc/laprizza/backup/gdpr}
RECIPIENTS=${RECIPIENTS:-/etc/laprizza/backup/age-recipients.txt}
DB_DIR="$BASE/db"; TMP_BASE="$BASE/tmp"

COMMAND=${1:-}; shift || true
ARG=${1:-}; [[ $# -gt 0 ]] && shift
IDENTITY=''; TARGET_ENV=''; REGISTER="$GDPR_DIR/erasure-register.log"; ASSUME_YES=false; OFFSITE=false; TO_DIR=''
while [[ $# -gt 0 ]]; do
  case $1 in
    --identity) IDENTITY=$2; shift 2 ;;
    --target-env) TARGET_ENV=$2; shift 2 ;;
    --register) REGISTER=$2; shift 2 ;;
    --to) TO_DIR=$2; shift 2 ;;
    --yes) ASSUME_YES=true; shift ;;
    --offsite) OFFSITE=true; shift ;;
    *) echo "Unknown option $1" >&2; exit 64 ;;
  esac
done
[[ "$ARG" == --offsite ]] && { OFFSITE=true; ARG=''; }

WORK=''
cleanup() { [[ -n "$WORK" && -d "$WORK" ]] && rm -rf -- "$WORK"; return 0; }
trap cleanup EXIT
die() { echo "ERROR: $*" >&2; exit 1; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(now) $*"; }
sha() { sha256sum "$1" | cut -d' ' -f1; }
json_get() { python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$1" "$2"; }

b2() {
  docker run --rm --log-driver none --env-file "$B2_ENV" -v "$BASE:/backups" -v "$GDPR_DIR:/gdpr" \
    "$AWS_IMAGE" --endpoint-url "${B2_ENDPOINT:?}" "$@"
}

production_env() {
  local rev
  rev=$(json_get "$STATE_DIR/../active.json" config_revision 2>/dev/null) || die "cannot read the active configuration revision"
  echo "/etc/laprizza/config/$rev.env"
}

resolve_target() {
  if [[ -z "$TARGET_ENV" ]]; then TARGET_ENV=$(production_env); PRODUCTION=true; else PRODUCTION=false; fi
  [[ -r "$TARGET_ENV" ]] || die "cannot read $TARGET_ENV"
  TARGET_DB=$(grep -E '^PGDATABASE=' "$TARGET_ENV" | tail -n 1 | cut -d= -f2-)
  [[ "$TARGET_DB" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "invalid PGDATABASE in $TARGET_ENV"
}

psql_target() { # extra docker args before the image are not needed; reads SQL from stdin
  docker run --rm -i --log-driver none --env-file "$TARGET_ENV" "$@" "$PG_IMAGE" psql -v ON_ERROR_STOP=1 -X -q
}

api_container() {
  docker ps -aq --filter label=com.docker.compose.project=laprizza --filter label=com.docker.compose.service=api | head -n 1
}

need_backup() {
  [[ "$ARG" =~ ^laprizza-db-[0-9]{8}T[0-9]{6}Z$ ]] || die "invalid backup id '$ARG' (see: laprizza-restore list)"
  BACKUP_FILE="$DB_DIR/$ARG.dump.age"; MANIFEST="$DB_DIR/$ARG.manifest.json"
  [[ -r "$BACKUP_FILE" && -r "$MANIFEST" ]] || die "$ARG is not available locally; run: laprizza-restore fetch $ARG"
  [[ "$(sha "$BACKUP_FILE")" == "$(json_get "$MANIFEST" encrypted_sha256)" ]] || die "checksum of $BACKUP_FILE does not match its manifest"
  BACKUP_CREATED=$(json_get "$MANIFEST" created_at)
  BACKUP_SCHEMA=$(json_get "$MANIFEST" schema_version)
}

decrypt_backup() {
  [[ -r "$IDENTITY" ]] || die "--identity must point to the age private key"
  install -d -m 0700 "$TMP_BASE"
  WORK=$(mktemp -d "$TMP_BASE/restore.XXXXXX")
  age -d -i "$IDENTITY" -o "$WORK/restore.dump" "$BACKUP_FILE" || die "decryption failed (wrong private key?)"
  [[ "$(sha "$WORK/restore.dump")" == "$(json_get "$MANIFEST" dump_sha256)" ]] || die "decrypted dump does not match its manifest"
  docker run --rm --log-driver none -v "$WORK:/work:ro" "$PG_IMAGE" pg_restore --list /work/restore.dump > "$WORK/restore.toc"
}

recreate_database() { # $1 database name
  psql_target -e PGDATABASE=postgres -e "TARGET=$1" <<'SQL'
\getenv target TARGET
DROP DATABASE IF EXISTS :"target" WITH (FORCE);
CREATE DATABASE :"target";
SQL
}

restore_into() { # $1 database name
  docker run --rm --log-driver none --env-file "$TARGET_ENV" -e "PGDATABASE=$1" -v "$WORK:/work:ro" "$PG_IMAGE" \
    pg_restore -d "$1" --no-owner --no-privileges --single-transaction --exit-on-error /work/restore.dump
}

verify_database() { # $1 database name
  local schema expected tables
  schema=$(docker run --rm --log-driver none --env-file "$TARGET_ENV" -e "PGDATABASE=$1" "$PG_IMAGE" psql -At -X \
    -c "SELECT name FROM public.schema_migrations ORDER BY name DESC LIMIT 1")
  [[ "$schema" == "$BACKUP_SCHEMA" ]] || die "restored schema $schema differs from $BACKUP_SCHEMA"
  expected=$(grep -cE '^[0-9]+; [0-9]+ [0-9]+ TABLE public ' "$WORK/restore.toc" || true)
  tables=$(docker run --rm --log-driver none --env-file "$TARGET_ENV" -e "PGDATABASE=$1" "$PG_IMAGE" psql -At -X \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
  [[ "$tables" == "$expected" ]] || die "$tables tables restored, $expected expected"
  log "verified: schema $schema, $tables tables"
  docker run --rm --log-driver none --env-file "$TARGET_ENV" -e "PGDATABASE=$1" "$PG_IMAGE" psql -At -X -F ' ' -c "
    SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
    FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1"
}

gdpr_replay() { # $1 database name; applies requests completed after the backup
  local ts request action type id proc applied=0
  [[ -f "$REGISTER" ]] || { log "GDPR register $REGISTER not found: nothing to replay"; return 0; }
  while IFS='|' read -r ts request action type id; do
    [[ -z "$ts" || "$ts" == \#* ]] && continue
    [[ "$ts" > "$BACKUP_CREATED" ]] || continue
    proc="$GDPR_PROCEDURES/$action-$type.sql"
    [[ -r "$proc" ]] || die "no procedure $proc for request $request; the service must stay closed until it is applied"
    docker run --rm -i --log-driver none --env-file "$TARGET_ENV" -e "PGDATABASE=$1" "$PG_IMAGE" \
      psql -v ON_ERROR_STOP=1 -X -q -v "id=$id" < "$proc" || die "GDPR request $request could not be applied"
    log "GDPR: re-applied $request ($action $type $id)"
    applied=$((applied + 1))
  done < "$REGISTER"
  log "GDPR: $applied request(s) completed after $BACKUP_CREATED were re-applied"
}

report() { # mode t0 t_decrypted t_restored t_verified t_reopened
  install -d -m 0755 "$STATE_DIR/restores"
  local out="$STATE_DIR/restores/$(date -u +%Y%m%dT%H%M%SZ)-$1.json"
  python3 - "$out" "$1" "$ARG" "$BACKUP_CREATED" "$TARGET_DB" "$PRODUCTION" "$2" "$3" "$4" "$5" "$6" <<'PY'
import datetime, json, sys
out, mode, bid, created, db, prod, t0, t1, t2, t3, t4 = sys.argv[1:]
t0, t1, t2, t3, t4 = map(int, (t0, t1, t2, t3, t4))
iso = lambda t: datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
data = {'mode': mode, 'backup_id': bid, 'backup_created_at': created, 'target_database': db,
        'production': prod == 'true', 'started_at': iso(t0), 'decrypted_at': iso(t1), 'restored_at': iso(t2),
        'verified_at': iso(t3), 'reopened_at': iso(t4),
        'technical_restore_seconds': t2 - t0, 'verification_seconds': t4 - t2, 'total_seconds': t4 - t0}
json.dump(data, open(out, 'w'), indent=2)
print(json.dumps(data, indent=2))
PY
  log "report written to $out"
}

case $COMMAND in
  list)
    if [[ "$OFFSITE" == true ]]; then
      b2 s3 ls "s3://${B2_BUCKET:?}/db/"
      b2 s3 ls "s3://$B2_BUCKET/config/" || true
    else
      for m in $(ls -1 "$DB_DIR"/*.manifest.json 2>/dev/null | sort); do
        python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d["backup_id"], d["created_at"], d["schema_version"], d["encrypted_size_bytes"], "bytes")' "$m"
      done
    fi ;;

  fetch)
    if [[ "$ARG" =~ ^laprizza-(config|globals)-[0-9]{8}T[0-9]{6}Z\.(tar\.gz|sql)\.age$ ]]; then
      install -d -m 0700 "$BASE/config"
      b2 s3 cp --only-show-errors "s3://${B2_BUCKET:?}/config/$ARG" "/backups/config/$ARG"
      log "$ARG downloaded to $BASE/config"; exit 0
    fi
    [[ "$ARG" =~ ^laprizza-db-[0-9]{8}T[0-9]{6}Z$ ]] || die "invalid backup id"
    install -d -m 0700 "$DB_DIR"
    b2 s3 cp --only-show-errors "s3://${B2_BUCKET:?}/db/$ARG.dump.age" "/backups/db/$ARG.dump.age"
    b2 s3 cp --only-show-errors "s3://$B2_BUCKET/db/$ARG.manifest.json" "/backups/db/$ARG.manifest.json"
    [[ "$(sha "$DB_DIR/$ARG.dump.age")" == "$(json_get "$DB_DIR/$ARG.manifest.json" encrypted_sha256)" ]] || die "downloaded file does not match its manifest"
    if [[ ! -f "$GDPR_DIR/erasure-register.log" ]]; then
      install -d -m 0700 "$GDPR_DIR"
      b2 s3 cp --only-show-errors "s3://$B2_BUCKET/gdpr/erasure-register.log" /gdpr/erasure-register.log \
        && log "GDPR register downloaded from the off-site copy" || log "no off-site GDPR register found"
    fi
    log "$ARG downloaded and verified" ;;

  total)
    need_backup; resolve_target
    t0=$(date +%s)
    log "TOTAL restore of $ARG (created $BACKUP_CREATED) into database $TARGET_DB (production=$PRODUCTION)"
    if [[ "$ASSUME_YES" != true ]]; then
      read -r -p "All current data in '$TARGET_DB' will be replaced. Type the database name to continue: " answer
      [[ "$answer" == "$TARGET_DB" ]] || die "cancelled"
    fi
    decrypt_backup; t1=$(date +%s)
    if [[ "$PRODUCTION" == true ]]; then
      API=$(api_container); [[ -n "$API" ]] && docker stop "$API" >/dev/null && log "API stopped"
      install -d -m 0700 "$BASE/pre-restore"
      if docker run --rm --log-driver none --env-file "$TARGET_ENV" "$PG_IMAGE" pg_dump -Fc > "$WORK/pre.dump" 2>/dev/null && [[ -s "$WORK/pre.dump" ]]; then
        age -R "$RECIPIENTS" -o "$BASE/pre-restore/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).dump.age" "$WORK/pre.dump"
        log "safety copy of the current database stored in $BASE/pre-restore"
      else
        log "current database could not be dumped (lost or unreachable); continuing"
      fi
    fi
    recreate_database "$TARGET_DB"
    restore_into "$TARGET_DB"; t2=$(date +%s); log "restore completed in $((t2 - t0))s"
    verify_database "$TARGET_DB"
    gdpr_replay "$TARGET_DB"; t3=$(date +%s)
    if [[ "$PRODUCTION" == true && -n "${API:-}" ]]; then
      docker start "$API" >/dev/null
      for _ in $(seq 1 30); do
        code=$(curl -sk -o /dev/null -w '%{http_code}' https://127.0.0.1:2229/api/v1/health || true)
        [[ "$code" == 200 ]] && break; sleep 2
      done
      [[ "$code" == 200 ]] || die "API did not become healthy after the restore"
      log "API started and healthy"
    fi
    t4=$(date +%s)
    report total "$t0" "$t1" "$t2" "$t3" "$t4" ;;

  selective)
    need_backup; resolve_target
    t0=$(date +%s)
    TEMP_DB="${TARGET_DB}_restore_$(date -u +%Y%m%d%H%M%S)"
    decrypt_backup; t1=$(date +%s)
    recreate_database "$TEMP_DB"
    restore_into "$TEMP_DB"; t2=$(date +%s)
    verify_database "$TEMP_DB"
    gdpr_replay "$TEMP_DB"; t3=$(date +%s)
    cat <<MSG

Backup $ARG restored into the temporary database $TEMP_DB (same server as $TARGET_DB).
Copy only the lost rows into $TARGET_DB, for example:

  docker run --rm --env-file $TARGET_ENV -e PGDATABASE=$TEMP_DB $PG_IMAGE \\
    psql -X -c "\\copy (SELECT * FROM <table> WHERE <condition>) TO STDOUT" \\
  | docker run --rm -i --env-file $TARGET_ENV $PG_IMAGE psql -X -c "\\copy <table> FROM STDIN"

Then remove the temporary database:  laprizza-restore drop-temp $TEMP_DB${TARGET_ENV:+ --target-env $TARGET_ENV}
MSG
    report selective "$t0" "$t1" "$t2" "$t3" "$t3" ;;

  drop-temp)
    resolve_target
    [[ "$ARG" =~ _restore_[0-9]{14}$ ]] || die "only temporary restore databases can be dropped"
    psql_target -e PGDATABASE=postgres -e "TARGET=$ARG" <<'SQL'
\getenv target TARGET
DROP DATABASE IF EXISTS :"target" WITH (FORCE);
SQL
    log "temporary database $ARG removed" ;;

  gdpr-replay)
    need_backup; resolve_target
    gdpr_replay "$TARGET_DB" ;;

  config)
    [[ -r "$ARG" && -r "$IDENTITY" && -n "$TO_DIR" ]] || die "usage: laprizza-restore config <file.tar.gz.age> --identity FILE --to DIR"
    install -d -m 0700 "$TO_DIR"
    age -d -i "$IDENTITY" "$ARG" | tar -C "$TO_DIR" -xzpf -
    log "configuration extracted into $TO_DIR (copy the needed files back to / manually)" ;;

  *)
    sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 64 ;;
esac