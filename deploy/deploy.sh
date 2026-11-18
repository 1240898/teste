#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT=/var/lib/laprizza
OPT_RELEASES=/opt/laprizza/releases
ACTIVE="$ROOT/active.json"
OPERATION_DIR="$ROOT/operations"
SCHEMA_OBSERVED=''
LOG_DIR=/var/log/laprizza/deployments
install -d -m 0750 "$LOG_DIR"
RUN_ID=${DEPLOY_RUN_ID:-manual-$(date -u +%Y%m%dT%H%M%SZ)}
[[ "$RUN_ID" =~ ^[A-Za-z0-9._-]{1,80}$ ]] || RUN_ID="manual-$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/${RUN_ID}-deploy.log"
: >> "$LOG_FILE"
chmod 0600 "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1
INCOMING=${INCOMING_DIR:?INCOMING_DIR is required}
[[ "$INCOMING" =~ ^/var/lib/laprizza/incoming/[A-Za-z0-9._-]+$ ]] || { echo 'Invalid INCOMING_DIR' >&2; exit 2; }
compat_name=''
rehearsal_network=''
rehearsal_db=''
rehearsal_api=''
OLD_API_IMAGE_ID=''
OLD_WEB_IMAGE_ID=''
OLD_API_IMAGE_REF=''
CANDIDATE_API_IMAGE_REF=''
CANDIDATE_RELEASE_DIR=''
CANDIDATE_OPT_DIR=''
write_operation_result() {
  local exit_code=$1 status=result-failed result_path="$OPERATION_DIR/$RUN_ID-deploy.json"
  [[ "$exit_code" -eq 0 ]] && status=result-succeeded
  install -d -m 0750 "$OPERATION_DIR" || return 1
  python3 - "$ACTIVE" "$ROOT/releases" "$result_path" "$RUN_ID" "$status" "$exit_code" "${SCHEMA_OBSERVED:-}" "${SHA:-}" <<'PY'
import json, os, sys
active_path, releases, output, run_id, status, code, observed, requested_sha = sys.argv[1:]
active={}
if os.path.isfile(active_path):
  with open(active_path) as stream: active=json.load(stream)
sha=active.get('release_sha'); revision=active.get('config_revision')
manifest={}
if sha and revision:
  path=os.path.join(releases, sha, revision, 'manifest.json')
  if os.path.isfile(path):
    with open(path) as stream: manifest=json.load(stream)
result={
  'operation':'deploy', 'run_id':run_id, 'status':status,
  'exit_code':int(code), 'requested_release_sha':requested_sha or None,
  'active_release_sha':sha,
  'api_image_id':manifest.get('api_image_id'),
  'web_image_id':manifest.get('web_image_id'),
  'config_revision':revision,
  'schema_version_observed':observed or active.get('schema_version'),
}
temporary=output+'.tmp'
fd=os.open(temporary, os.O_WRONLY|os.O_CREAT|os.O_TRUNC, 0o600)
with os.fdopen(fd,'w') as stream:
  json.dump(result, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
os.replace(temporary, output)
PY
}
cleanup_compat() {
  if [[ -n "$compat_name" ]]; then docker rm -f "$compat_name" >/dev/null 2>&1 || true; fi
}
image_ref_for_manifest() {
  local repository=$1 sha=$2 image_id=$3 preferred_ref=${4:-} unique_ref loaded legacy_ref
  if [[ -n "$preferred_ref" ]]; then
    local preferred_pattern="^${repository}:${sha}-[0-9a-f]{64}-[0-9]+$"
    [[ "$preferred_ref" =~ $preferred_pattern ]] || {
      echo "Manifest image tag has an invalid build-specific format: $repository" >&2
      return 1
    }
    loaded=$(docker image inspect --format '{{.Id}}' "$preferred_ref") || {
      echo "Build-specific image tag is missing from the archive: $preferred_ref" >&2
      return 1
    }
    [[ "$loaded" == "$image_id" ]] || {
      echo "Build-specific image tag ID mismatch for $preferred_ref (manifest=$image_id, loaded=$loaded)" >&2
      return 1
    }
    printf '%s\n' "$preferred_ref"
    return 0
  fi
  unique_ref="$repository:$sha-${image_id#sha256:}"
  if loaded=$(docker image inspect --format '{{.Id}}' "$unique_ref" 2>/dev/null); then
    if [[ "$loaded" == "$image_id" ]]; then
      printf '%s\n' "$unique_ref"
      return 0
    fi
    echo "Build-specific tag resolves to another image; checking the archive SHA tag: $unique_ref" >&2
  fi
  legacy_ref="$repository:$sha"
  loaded=$(docker image inspect --format '{{.Id}}' "$legacy_ref") || {
    echo "Image archive has neither its build-specific tag nor legacy SHA tag: $repository" >&2
    return 1
  }
  [[ "$loaded" == "$image_id" ]] || { echo "Legacy SHA tag does not match manifest image ID: $legacy_ref" >&2; return 1; }
  docker tag "$legacy_ref" "$unique_ref" || return 1
  printf '%s\n' "$unique_ref"
}
cleanup() {
  local rc=$?
  cleanup_compat
  if [[ -n "$rehearsal_api" ]]; then docker rm -f "$rehearsal_api" >/dev/null 2>&1 || true; fi
  if [[ -n "$rehearsal_db" ]]; then docker rm -f "$rehearsal_db" >/dev/null 2>&1 || true; fi
  if [[ -n "$rehearsal_network" ]]; then docker network rm "$rehearsal_network" >/dev/null 2>&1 || true; fi
  write_operation_result "$rc" || echo 'Could not persist the sanitized deployment result manifest.' >&2
  [[ -z "$CANDIDATE_RELEASE_DIR" || ! -d "$CANDIDATE_RELEASE_DIR" ]] || rm -rf -- "$CANDIDATE_RELEASE_DIR"
  [[ -z "$CANDIDATE_OPT_DIR" || ! -d "$CANDIDATE_OPT_DIR" ]] || rm -rf -- "$CANDIDATE_OPT_DIR"
  rm -rf -- "$INCOMING"
  return "$rc"
}
trap cleanup EXIT
COMPOSE_FILE="$INCOMING/docker-compose.yml"
MANIFEST="$INCOMING/manifest.json"
SHA=${RELEASE_SHA:?RELEASE_SHA is required}
CONFIG_REV=${DEI_CONFIG_REVISION:?DEI_CONFIG_REVISION is required}
PUBLIC_HOST=${DEI_PUBLIC_HOST:?DEI_PUBLIC_HOST is required}
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release SHA' >&2; exit 2; }
[[ "$CONFIG_REV" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || { echo 'Invalid config revision' >&2; exit 2; }
[[ "$PUBLIC_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || { echo 'Invalid public host' >&2; exit 2; }
[[ -d "$INCOMING" && -f "$COMPOSE_FILE" && -f "$MANIFEST" && -f "$INCOMING/images.tar" ]] || { echo 'Incomplete incoming release bundle' >&2; exit 2; }

exec 9>/var/lock/laprizza-deploy.lock
flock -x 9

validate_image_schema_state() {
  local compose_file=$1 state_json=$2 known_json applied_json
  known_json=$(docker compose -p laprizza -f "$compose_file" run --rm --no-deps -T api node --input-type=module -e 'import { readdir } from "node:fs/promises"; const names=(await readdir("/app/migrations")).filter(name=>name.endsWith(".sql")).sort(); console.log(JSON.stringify(names));') || {
    echo 'Deployment stopped: could not read the candidate image migration list.' >&2
    return 1
  }
  known_json=$(printf '%s\n' "$known_json" | tail -n 1)
  applied_json=$(docker compose -p laprizza -f "$compose_file" run --rm --no-deps -T api node --input-type=module -e 'import { createDatabase } from "./src/shared/persistence/postgres/index.js"; let database; try { database=createDatabase(); await database.verify(); const {rows: ledger}=await database.query("SELECT to_regclass($1) AS ledger", ["public.schema_migrations"]); let applied=[]; if (ledger[0]?.ledger) { const {rows}=await database.query("SELECT name FROM public.schema_migrations ORDER BY name"); applied=rows.map(row=>row.name); } console.log(JSON.stringify(applied)); } catch { console.error("Migration inventory query failed."); process.exitCode=1; } finally { try { await database?.close(); } catch { process.exitCode=1; } }') || {
    echo 'Deployment stopped: could not inspect applied database migrations.' >&2
    return 1
  }
  applied_json=$(printf '%s\n' "$applied_json" | tail -n 1)
  python3 - "$state_json" "$known_json" "$applied_json" <<'PY'
import json, re, sys
try:
  state, known, applied = (json.loads(value) for value in sys.argv[1:])
  valid_name = lambda name: isinstance(name, str) and re.fullmatch(r'\d{4}_[a-z0-9_]+\.sql', name)
  if not isinstance(known, list) or not known or not all(valid_name(name) for name in known):
    raise ValueError
  if known != sorted(set(known)):
    raise ValueError
  if not isinstance(applied, list) or not all(valid_name(name) for name in applied):
    raise ValueError
  if applied != sorted(set(applied)):
    raise ValueError
  if not isinstance(state, dict):
    raise ValueError
except Exception:
  raise SystemExit('Migration state or image migration list is invalid.')
if state.get('target_version') != known[-1]:
  raise SystemExit('Image migration target does not match its migration files.')
actual_current = applied[-1] if applied else 'none'
if state.get('current_version') != actual_current:
  raise SystemExit('Reported schema version does not match the applied migration ledger.')
unknown = [name for name in applied if name not in known]
if unknown or state.get('unknown_applied'):
  raise SystemExit('Database contains migrations unknown to this image.')
expected_pending = [name for name in known if name not in applied]
if state.get('pending') != expected_pending:
  raise SystemExit('Reported pending migrations do not match the image and database ledgers.')
PY
}

verify_running_images() {
  local compose_file=$1 expected_api=$2 expected_web=$3 api_container web_container api_actual web_actual
  api_container=$(docker compose -p laprizza -f "$compose_file" ps -q api) || return 1
  web_container=$(docker compose -p laprizza -f "$compose_file" ps -q web) || return 1
  [[ -n "$api_container" && -n "$web_container" ]] || return 1
  api_actual=$(docker inspect --format '{{.Image}}' "$api_container") || return 1
  web_actual=$(docker inspect --format '{{.Image}}' "$web_container") || return 1
  [[ "$api_actual" == "$expected_api" && "$web_actual" == "$expected_web" ]]
}

smoke() {
  local failed=0 api_result api_status api_body
  if ! curl --fail --silent --show-error --max-time 10 --resolve "$PUBLIC_HOST:80:127.0.0.1" "http://$PUBLIC_HOST/api/v1/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"'; then
    echo 'Smoke check failed: API health' >&2
    failed=1
  fi
  if ! curl --fail --silent --show-error --max-time 10 --resolve "$PUBLIC_HOST:80:127.0.0.1" "http://$PUBLIC_HOST/register" | grep -q 'id="root"'; then
    echo 'Smoke check failed: /register SPA entry' >&2
    failed=1
  fi
  if ! curl --fail --silent --show-error --max-time 10 --resolve "$PUBLIC_HOST:80:127.0.0.1" "http://$PUBLIC_HOST/register/x/y" | grep -q 'id="root"'; then
    echo 'Smoke check failed: nested SPA entry' >&2
    failed=1
  fi
  if api_result=$(curl --silent --show-error --max-time 10 --resolve "$PUBLIC_HOST:80:127.0.0.1" -w '\n%{http_code}' "http://$PUBLIC_HOST/api/v1/does-not-exist"); then
    api_status=${api_result##*$'\n'}
    api_body=${api_result%$'\n'*}
    if [[ "$api_status" != 404 || "$api_body" == *'id="root"'* ]]; then
      echo 'Smoke check failed: unknown API path did not return an API 404' >&2
      failed=1
    fi
  else
    echo 'Smoke check failed: unknown API path request' >&2
    failed=1
  fi
  return "$failed"
}

rehearse_schema_migration() {
  [[ -n "$OLD_SHA" && -n "$OLD_REV" ]] || return 0
  [[ "$CURRENT_SCHEMA" =~ ^[0-9]{4}_[a-z0-9_]+\.sql$ ]] || {
    echo 'Schema rehearsal stopped: the active database schema is not a known migration version.' >&2
    return 1
  }
  local old_manifest="$ROOT/releases/$OLD_SHA/$OLD_REV/manifest.json"
  local old_archive="$ROOT/releases/$OLD_SHA/$OLD_REV/images.tar"
  [[ -r "$old_manifest" && -r "$old_archive" ]] || {
    echo 'Schema rehearsal stopped: retained active images or manifest are missing.' >&2
    return 1
  }
  local retained_ids
  retained_ids=$(python3 - "$old_manifest" "$OLD_SHA" <<'PY'
import json, re, sys
d=json.load(open(sys.argv[1]))
assert d.get('release_sha') == sys.argv[2]
api=d.get('api_image_id',''); web=d.get('web_image_id','')
assert re.fullmatch(r'sha256:[0-9a-f]{64}', api)
assert re.fullmatch(r'sha256:[0-9a-f]{64}', web)
print(api, web)
PY
  ) || { echo 'Schema rehearsal stopped: retained image manifest is invalid.' >&2; return 1; }
  read -r OLD_API_IMAGE_ID OLD_WEB_IMAGE_ID <<<"$retained_ids"
  OLD_API_IMAGE_TAG=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("api_image_tag", ""))' "$old_manifest")
  OLD_WEB_IMAGE_TAG=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("web_image_tag", ""))' "$old_manifest")
  docker load -i "$old_archive" || { echo 'Schema rehearsal stopped: retained image archive could not be loaded.' >&2; return 1; }
  OLD_API_IMAGE_REF=$(image_ref_for_manifest laprizza-api "$OLD_SHA" "$OLD_API_IMAGE_ID" "$OLD_API_IMAGE_TAG") || return 1
  image_ref_for_manifest laprizza-web "$OLD_SHA" "$OLD_WEB_IMAGE_ID" "$OLD_WEB_IMAGE_TAG" >/dev/null || return 1

  rehearsal_network="laprizza-rehearsal-$$"
  rehearsal_db="laprizza-rehearsal-db-$$"
  rehearsal_api="laprizza-rehearsal-api-$$"
  rehearsal_password=$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))') || { echo 'Schema rehearsal stopped: could not create isolated credentials.' >&2; return 1; }
  docker network create --internal "$rehearsal_network" >/dev/null || { echo 'Schema rehearsal stopped: isolated network could not be created.' >&2; return 1; }
  docker run -d --rm --name "$rehearsal_db" --network "$rehearsal_network" \
    --network-alias rehearsal-db --log-driver none \
    -e POSTGRES_DB=laprizza_rehearsal -e POSTGRES_USER=rehearsal \
    -e "POSTGRES_PASSWORD=$rehearsal_password" postgres:18 >/dev/null || { echo 'Schema rehearsal stopped: isolated PostgreSQL could not start.' >&2; return 1; }
  db_ready=false
  for _ in $(seq 1 60); do
    if docker exec "$rehearsal_db" pg_isready -U rehearsal -d laprizza_rehearsal >/dev/null 2>&1; then
      db_ready=true
      break
    fi
    sleep 1
  done
  [[ "$db_ready" == true ]] || { echo 'Schema rehearsal stopped: isolated PostgreSQL did not become ready.' >&2; return 1; }

  docker run --rm --network "$rehearsal_network" --read-only --tmpfs /tmp \
    --cap-drop ALL --security-opt no-new-privileges:true \
    -e NODE_ENV=production -e PGHOST=rehearsal-db -e PGPORT=5432 \
    -e PGDATABASE=laprizza_rehearsal -e PGUSER=rehearsal \
    -e "PGPASSWORD=$rehearsal_password" -e PGSSLMODE=disable \
    "$CANDIDATE_API_IMAGE_REF" node scripts/database.js migrate --through "$CURRENT_SCHEMA" >/dev/null || {
      echo 'Schema rehearsal stopped: could not construct the exact current-schema baseline.' >&2
      return 1
    }

  local baseline_state baseline_summary baseline_schema baseline_unknown
  baseline_state=$(docker run --rm --network "$rehearsal_network" --read-only --tmpfs /tmp \
    --cap-drop ALL --security-opt no-new-privileges:true \
    -e NODE_ENV=production -e PGHOST=rehearsal-db -e PGPORT=5432 \
    -e PGDATABASE=laprizza_rehearsal -e PGUSER=rehearsal \
    -e "PGPASSWORD=$rehearsal_password" -e PGSSLMODE=disable \
    "$CANDIDATE_API_IMAGE_REF" node scripts/database.js state) || {
      echo 'Schema rehearsal stopped: could not inspect the constructed baseline.' >&2
      return 1
    }
  baseline_state=$(printf '%s\n' "$baseline_state" | tail -n 1)
  baseline_summary=$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(d["current_version"],str(bool(d.get("unknown_applied"))).lower())' <<<"$baseline_state") || {
    echo 'Schema rehearsal stopped: baseline state was invalid.' >&2
    return 1
  }
  read -r baseline_schema baseline_unknown <<<"$baseline_summary"
  [[ "$baseline_schema" == "$CURRENT_SCHEMA" && "$baseline_unknown" == false ]] || {
    echo 'Schema rehearsal stopped: scratch database did not reach the exact active schema.' >&2
    return 1
  }

  start_rehearsal_api || return 1
  local test_email="sys01-${RUN_ID}@example.invalid"
  rehearsal_probe before-migration "$test_email" || return 1
  stop_rehearsal_api || return 1

  docker run --rm --network "$rehearsal_network" --read-only --tmpfs /tmp \
    --cap-drop ALL --security-opt no-new-privileges:true \
    -e NODE_ENV=production -e PGHOST=rehearsal-db -e PGPORT=5432 \
    -e PGDATABASE=laprizza_rehearsal -e PGUSER=rehearsal \
    -e "PGPASSWORD=$rehearsal_password" -e PGSSLMODE=disable \
    "$CANDIDATE_API_IMAGE_REF" node scripts/database.js migrate >/dev/null || {
      echo 'Schema rehearsal stopped: candidate migrations failed on the isolated database.' >&2
      return 1
    }

  local candidate_state candidate_summary candidate_schema candidate_target candidate_pending candidate_unknown
  candidate_state=$(docker run --rm --network "$rehearsal_network" --read-only --tmpfs /tmp \
    --cap-drop ALL --security-opt no-new-privileges:true \
    -e NODE_ENV=production -e PGHOST=rehearsal-db -e PGPORT=5432 \
    -e PGDATABASE=laprizza_rehearsal -e PGUSER=rehearsal \
    -e "PGPASSWORD=$rehearsal_password" -e PGSSLMODE=disable \
    "$CANDIDATE_API_IMAGE_REF" node scripts/database.js state) || {
      echo 'Schema rehearsal stopped: could not inspect the candidate-migrated schema.' >&2
      return 1
    }
  candidate_state=$(printf '%s\n' "$candidate_state" | tail -n 1)
  candidate_summary=$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(d["current_version"],d["target_version"],str(bool(d["pending"])).lower(),str(bool(d.get("unknown_applied"))).lower())' <<<"$candidate_state") || {
    echo 'Schema rehearsal stopped: candidate migration state was invalid.' >&2
    return 1
  }
  read -r candidate_schema candidate_target candidate_pending candidate_unknown <<<"$candidate_summary"
  [[ "$candidate_schema" == "$TARGET_SCHEMA" && "$candidate_target" == "$TARGET_SCHEMA" && "$candidate_pending" == false && "$candidate_unknown" == false ]] || {
    echo 'Schema rehearsal stopped: isolated database does not match the candidate schema.' >&2
    return 1
  }

  start_rehearsal_api || return 1
  rehearsal_probe after-migration "$test_email" || return 1
  stop_rehearsal_api || return 1
  rehearsal_password=''
  echo "Previous API passed isolated schema migration, synthetic registration, duplicate detection, health, and catalogue checks through $TARGET_SCHEMA."
}

start_rehearsal_api() {
  rehearsal_api="laprizza-rehearsal-api-$$"
  docker run -d --rm --name "$rehearsal_api" --network "$rehearsal_network" \
    --network-alias rehearsal-api --log-driver none --read-only --tmpfs /tmp \
    --cap-drop ALL --security-opt no-new-privileges:true \
    -e NODE_ENV=production -e PORT=3000 \
    -e PGHOST=rehearsal-db -e PGPORT=5432 -e PGDATABASE=laprizza_rehearsal \
    -e PGUSER=rehearsal -e "PGPASSWORD=$rehearsal_password" -e PGSSLMODE=disable \
    -e JWT_SECRET=laprizza-sys01-isolated-rehearsal-secret-32-bytes \
    -e SESSION_COOKIE_SECURE=true -e CORS_ORIGIN=https://sys01.invalid \
    -e AUTH_IDLE_TIMEOUT_SECONDS=3600 -e ACTIVITY_REPORT_INTERVAL_SECONDS=300 \
    -e ACCESS_TOKEN_TTL=15m "$OLD_API_IMAGE_REF" >/dev/null || {
      echo 'Schema rehearsal stopped: previous API container could not start.' >&2
      return 1
    }
  local healthy=false
  for _ in $(seq 1 30); do
    if docker run --rm --network "$rehearsal_network" --log-driver none \
      "$OLD_API_IMAGE_REF" node -e "fetch('http://rehearsal-api:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      healthy=true
      break
    fi
    sleep 2
  done
  [[ "$healthy" == true ]] || { echo 'Schema rehearsal stopped: previous API health check failed.' >&2; return 1; }
}

stop_rehearsal_api() {
  if [[ -n "$rehearsal_api" ]]; then
    docker rm -f "$rehearsal_api" >/dev/null 2>&1 || return 1
    rehearsal_api=''
  fi
}

rehearsal_probe() {
  local phase=$1 email=$2
  docker run --rm -i --network "$rehearsal_network" --log-driver none \
    -e "PROBE_PHASE=$phase" -e "PROBE_EMAIL=$email" \
    "$OLD_API_IMAGE_REF" node --input-type=module - <<'NODE'
const base = 'http://rehearsal-api:3000/api/v1';
const email = process.env.PROBE_EMAIL;
const phase = process.env.PROBE_PHASE;
const sendRegistration = () => fetch(`${base}/users/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name: 'SYS01 Migration Rehearsal',
    email,
    password: 'Rehearsal-Only-Password-123!',
    marketingConsent: false,
  }),
});
if (phase === 'before-migration') {
  const created = await sendRegistration();
  if (created.status !== 201) throw new Error(`synthetic write status=${created.status}`);
  const duplicate = await sendRegistration();
  if (duplicate.status !== 409) throw new Error(`synthetic read status=${duplicate.status}`);
} else {
  const health = await fetch(`${base}/health`);
  if (health.status !== 200) throw new Error(`health status=${health.status}`);
  const catalogue = await fetch(`${base}/catalogue`);
  if (catalogue.status !== 200) throw new Error(`catalogue status=${catalogue.status}`);
  await catalogue.json();
  const persisted = await sendRegistration();
  if (persisted.status !== 409) throw new Error(`persisted synthetic read status=${persisted.status}`);
  const written = await fetch(`${base}/users/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'SYS01 Migration Rehearsal After',
      email: `after-${email}`,
      password: 'Rehearsal-Only-Password-123!',
      marketingConsent: false,
    }),
  });
  if (written.status !== 201) throw new Error(`post-migration write status=${written.status}`);
}
NODE
}

export RELEASE_SHA="$SHA" DEI_CONFIG_REVISION="$CONFIG_REV"
ENV_FILE="/etc/laprizza/config/${CONFIG_REV}.env"
[[ -r "$ENV_FILE" ]] || { echo "Runtime config unavailable: $ENV_FILE" >&2; exit 2; }
python3 - "$MANIFEST" "$SHA" "$CONFIG_REV" <<'PY'
import json, re, sys
m=json.load(open(sys.argv[1]))
assert m.get('release_sha') == sys.argv[2]
assert m.get('config_revision') == sys.argv[3]
assert re.fullmatch(r'sha256:[0-9a-f]{64}', m.get('api_image_id',''))
assert re.fullmatch(r'sha256:[0-9a-f]{64}', m.get('web_image_id',''))
PY

OLD_SHA=''
OLD_REV=''
if [[ -f "$ACTIVE" ]]; then
  OLD_SHA=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("release_sha", ""))' "$ACTIVE")
  OLD_REV=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("config_revision", ""))' "$ACTIVE")
fi

if [[ "$OLD_SHA" == "$SHA" && "$OLD_REV" == "$CONFIG_REV" ]]; then
  ACTIVE_MANIFEST="$ROOT/releases/$OLD_SHA/$OLD_REV/manifest.json"
  [[ -r "$ACTIVE_MANIFEST" ]] || { echo 'Active release manifest is missing' >&2; exit 2; }
  read -r active_api_id active_web_id <<<"$(python3 - "$ACTIVE_MANIFEST" <<'PY'
import json, re, sys
d=json.load(open(sys.argv[1])); api=d.get('api_image_id',''); web=d.get('web_image_id','')
assert re.fullmatch(r'sha256:[0-9a-f]{64}', api) and re.fullmatch(r'sha256:[0-9a-f]{64}', web)
print(api, web)
PY
)"
ACTIVE_API_REF=$(python3 -c \
'import json,sys; print(json.load(open(sys.argv[1])).get("api_image_tag", ""))' \
"$ACTIVE_MANIFEST")

ACTIVE_WEB_REF=$(python3 -c \
  'import json,sys; print(json.load(open(sys.argv[1])).get("web_image_tag", ""))' \
  "$ACTIVE_MANIFEST")

ACTIVE_API_REF=$(image_ref_for_manifest \
  laprizza-api "$OLD_SHA" "$active_api_id" "$ACTIVE_API_REF") || exit 2

ACTIVE_WEB_REF=$(image_ref_for_manifest \
  laprizza-web "$OLD_SHA" "$active_web_id" "$ACTIVE_WEB_REF") || exit 2

export API_IMAGE_TAG="${ACTIVE_API_REF#laprizza-api:}"
export WEB_IMAGE_TAG="${ACTIVE_WEB_REF#laprizza-web:}"
  [[ -r "$ACTIVE_COMPOSE" ]] || { echo 'Active release files are missing' >&2; exit 2; }
  verify_running_images "$ACTIVE_COMPOSE" "$active_api_id" "$active_web_id" || {
    echo 'Active containers do not match the image IDs recorded for the active release.' >&2
    exit 3
  }
  ACTIVE_STATE=$(docker compose -p laprizza -f "$ACTIVE_COMPOSE" run --rm --no-deps -T api node scripts/database.js state)
  ACTIVE_STATE=$(printf '%s\n' "$ACTIVE_STATE" | tail -n 1)
  if ! validate_image_schema_state "$ACTIVE_COMPOSE" "$ACTIVE_STATE"; then
    exit 3
  fi
  read -r CURRENT_SCHEMA TARGET_SCHEMA HAS_PENDING EMPTY_DATABASE HAS_UNKNOWN_APPLIED <<<"$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());c=d["current_version"];t=d["target_version"];u=bool(d.get("unknown_applied",[])) or (c!="none" and t!="none" and c>t);print(c,t,str(bool(d["pending"])).lower(),str(bool(d["empty_database"])).lower(),str(u).lower())' <<<"$ACTIVE_STATE")"
  SCHEMA_OBSERVED="$CURRENT_SCHEMA"
  [[ "$HAS_UNKNOWN_APPLIED" == false ]] || { echo 'Deployment stopped: active database has migrations unknown to the active image.' >&2; exit 3; }
  if [[ "$HAS_PENDING" == false ]]; then
    smoke
    echo 'Release is already active; database state and smoke checks passed without changing release files.'
    exit 0
  fi
fi

install -d -m 0750 "$ROOT/releases" "$ROOT/backups"
docker load -i "$INCOMING/images.tar"
read -r expected_api expected_web expected_api_ref expected_web_ref <<<"$(python3 - "$MANIFEST" <<'PY'
import json, re, sys
d=json.load(open(sys.argv[1]))
api=d['api_image_id']; web=d['web_image_id']
api_ref=d.get('api_image_tag',''); web_ref=d.get('web_image_tag','')
assert re.fullmatch(r'laprizza-api:[0-9a-f]{40}-[0-9a-f]{64}-[0-9]+', api_ref)
assert re.fullmatch(r'laprizza-web:[0-9a-f]{40}-[0-9a-f]{64}-[0-9]+', web_ref)
print(api, web, api_ref, web_ref)
PY
)" || { echo 'Release manifest has invalid build-specific image tags.' >&2; exit 2; }
API_TAG=${expected_api_ref#laprizza-api:}
WEB_TAG=${expected_web_ref#laprizza-web:}
CANDIDATE_API_IMAGE_REF=$(image_ref_for_manifest laprizza-api "$SHA" "$expected_api" "$expected_api_ref") || exit 2
image_ref_for_manifest laprizza-web "$SHA" "$expected_web" "$expected_web_ref" >/dev/null || exit 2
export API_IMAGE_TAG="$API_TAG" WEB_IMAGE_TAG="$WEB_TAG"
docker compose -p laprizza -f "$COMPOSE_FILE" config -q

DB_STATE=$(docker compose -p laprizza -f "$COMPOSE_FILE" run --rm --no-deps -T api node scripts/database.js state)
DB_STATE=$(printf '%s\n' "$DB_STATE" | tail -n 1)
if ! validate_image_schema_state "$COMPOSE_FILE" "$DB_STATE"; then
  exit 3
fi
read -r CURRENT_SCHEMA TARGET_SCHEMA HAS_PENDING EMPTY_DATABASE HAS_UNKNOWN_APPLIED <<<"$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());c=d["current_version"];t=d["target_version"];u=bool(d.get("unknown_applied",[])) or (c!="none" and t!="none" and c>t);print(c,t,str(bool(d["pending"])).lower(),str(bool(d["empty_database"])).lower(),str(u).lower())' <<<"$DB_STATE")"
SCHEMA_OBSERVED="$CURRENT_SCHEMA"
PRE_MIGRATION_SCHEMA="$CURRENT_SCHEMA"
[[ "$HAS_UNKNOWN_APPLIED" == false ]] || { echo 'Deployment stopped: active database has migrations unknown to the candidate image.' >&2; exit 3; }

# TODO (SYS08): Reativar a validação de backups antes das migrações.
# Temporariamente desativada enquanto a SYS08 não estiver implementada.
# if [[ "$HAS_PENDING" == true && "$EMPTY_DATABASE" == true ]]; then
#   echo 'Verified-backup gate skipped because the database is empty.'
# elif [[ "$HAS_PENDING" == true ]]; then
#   [[ -f "$ROOT/backups/verified.json" ]] || { echo 'Migration stopped: no verified backup evidence is available; the repository has no SYS08 backup producer yet.' >&2; exit 3; }
#   python3 - "$ROOT/backups/verified.json" "$CURRENT_SCHEMA" <<'PY'
# import datetime, json, sys
# d=json.load(open(sys.argv[1]))
# assert d.get('restorable') is True
# assert d.get('schema_version') == sys.argv[2]
# t=datetime.datetime.fromisoformat(d['verified_at'].replace('Z','+00:00'))
# assert t.tzinfo is not None and (datetime.datetime.now(datetime.timezone.utc)-t).total_seconds() <= 86400
# assert d.get('backup_id')
# PY
# fi

if [[ "$HAS_PENDING" == true && -n "$OLD_SHA" ]]; then
  if rehearse_schema_migration; then
    :
  else
    echo 'Schema rehearsal failed; refusing to migrate the shared database.' >&2
    exit 1
  fi
fi

RELEASE_DIR="$ROOT/releases/$SHA/$CONFIG_REV"
OPT_RELEASE_DIR="$OPT_RELEASES/$SHA/$CONFIG_REV"
write_active() {
  python3 - "$1" "$2" "$3" "$4" "$ROOT/releases/$1/$2/manifest.json" "$RUN_ID" "$ACTIVE.tmp" <<'PY'
import json, os, sys
manifest=json.load(open(sys.argv[5]))
d={'release_sha':sys.argv[1], 'config_revision':sys.argv[2], 'schema_version':sys.argv[4], 'previous_schema_version':sys.argv[3], 'api_image_id':manifest['api_image_id'], 'web_image_id':manifest['web_image_id'], 'run_id':sys.argv[6]}
with open(sys.argv[7],'w') as f: json.dump(d,f); f.write('\n'); f.flush(); os.fsync(f.fileno())
os.replace(sys.argv[7], '/var/lib/laprizza/active.json')
PY
}
recover() {
  if [[ -n "$OLD_SHA" && -n "$OLD_REV" && -f "$OPT_RELEASES/$OLD_SHA/$OLD_REV/docker-compose.yml" ]]; then
    previous_dir="$ROOT/releases/$OLD_SHA/$OLD_REV"
    previous_manifest="$previous_dir/manifest.json"
    [[ -r "$previous_manifest" && -r "$previous_dir/images.tar" ]] || {
      echo 'Automatic recovery stopped: retained image archive or manifest is missing.' >&2
      return 1
    }
    read -r recovery_api_id recovery_web_id <<<"$(python3 - "$previous_manifest" "$OLD_SHA" <<'PY'
import json, re, sys
d=json.load(open(sys.argv[1]))
assert d.get('release_sha') == sys.argv[2]
api=d.get('api_image_id',''); web=d.get('web_image_id','')
assert re.fullmatch(r'sha256:[0-9a-f]{64}', api)
assert re.fullmatch(r'sha256:[0-9a-f]{64}', web)
print(api, web)
PY
)" || return 1
    docker load -i "$previous_dir/images.tar" || return 1
    local recovery_api_image_tag recovery_web_image_tag
    recovery_api_image_tag=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("api_image_tag", ""))' "$previous_manifest")
    recovery_web_image_tag=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("web_image_tag", ""))' "$previous_manifest")
    local recovery_api_ref recovery_web_ref
    recovery_api_ref=$(image_ref_for_manifest laprizza-api "$OLD_SHA" "$recovery_api_id" "$recovery_api_image_tag") || return 1
    recovery_web_ref=$(image_ref_for_manifest laprizza-web "$OLD_SHA" "$recovery_web_id" "$recovery_web_image_tag") || return 1
    recovery_api_tag=${recovery_api_ref#laprizza-api:}
    recovery_web_tag=${recovery_web_ref#laprizza-web:}
    export RELEASE_SHA="$OLD_SHA" DEI_CONFIG_REVISION="$OLD_REV" API_IMAGE_TAG="$recovery_api_tag" WEB_IMAGE_TAG="$recovery_web_tag"
    local recovery_compose="$OPT_RELEASES/$OLD_SHA/$OLD_REV/docker-compose.yml"
    docker compose -p laprizza -f "$recovery_compose" up -d --wait || return 1
    verify_running_images "$recovery_compose" "$recovery_api_id" "$recovery_web_id" || {
      echo 'Automatic recovery started images that do not match the retained manifest.' >&2
      return 1
    }
    recovery_state=$(docker compose -p laprizza -f "$recovery_compose" run --rm --no-deps -T api node scripts/database.js state) || return 1
    recovery_state=$(printf '%s\n' "$recovery_state" | tail -n 1)
    recovery_schema=$(python3 -c 'import json,sys;print(json.loads(sys.stdin.read())["current_version"])' <<<"$recovery_state") || return 1
    SCHEMA_OBSERVED="$recovery_schema"
    smoke || return 1
    write_active "$OLD_SHA" "$OLD_REV" "$PRE_MIGRATION_SCHEMA" "$recovery_schema"
  else
    echo 'No prior release is available for automatic recovery' >&2
    return 1
  fi
}

install -d -m 0750 "$ROOT/releases" "$OPT_RELEASES"
candidate_release_dir="$ROOT/releases/.candidate-$RUN_ID"
candidate_opt_dir="$OPT_RELEASES/.candidate-$RUN_ID"
[[ ! -e "$candidate_release_dir" && ! -e "$candidate_opt_dir" ]] || {
  echo 'A candidate directory with this run ID already exists.' >&2
  exit 1
}
CANDIDATE_RELEASE_DIR="$candidate_release_dir"
CANDIDATE_OPT_DIR="$candidate_opt_dir"
mkdir -m 0750 "$CANDIDATE_RELEASE_DIR" "$CANDIDATE_OPT_DIR"
install -m 0600 "$INCOMING/images.tar" "$CANDIDATE_RELEASE_DIR/images.tar"
install -m 0600 "$MANIFEST" "$CANDIDATE_RELEASE_DIR/manifest.json"
install -m 0640 "$COMPOSE_FILE" "$CANDIDATE_OPT_DIR/docker-compose.yml"
install -m 0750 "$INCOMING/deploy.sh" "$CANDIDATE_OPT_DIR/deploy.sh"
install -m 0750 "$INCOMING/rollback.sh" "$CANDIDATE_OPT_DIR/rollback.sh"

set +e
if [[ "$HAS_PENDING" == true ]]; then
  docker compose -p laprizza -f "$COMPOSE_FILE" run --rm --no-deps -T api node scripts/database.js migrate
  migration_rc=$?
  if [[ $migration_rc -eq 0 ]]; then
    if MIGRATED_STATE=$(docker compose -p laprizza -f "$COMPOSE_FILE" run --rm --no-deps -T api node scripts/database.js state); then
      MIGRATED_STATE=$(printf '%s\n' "$MIGRATED_STATE" | tail -n 1)
      if validate_image_schema_state "$COMPOSE_FILE" "$MIGRATED_STATE" && MIGRATED_SUMMARY=$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());c=d["current_version"];t=d["target_version"];u=bool(d.get("unknown_applied",[])) or (c!="none" and t!="none" and c>t);print(c,t,str(bool(d["pending"])).lower(),str(u).lower())' <<<"$MIGRATED_STATE"); then
        read -r MIGRATED_SCHEMA MIGRATED_TARGET MIGRATED_PENDING MIGRATED_UNKNOWN <<<"$MIGRATED_SUMMARY"
        if [[ "$MIGRATED_SCHEMA" == "$TARGET_SCHEMA" && "$MIGRATED_TARGET" == "$TARGET_SCHEMA" && "$MIGRATED_PENDING" == false && "$MIGRATED_UNKNOWN" == false ]]; then
          CURRENT_SCHEMA="$MIGRATED_SCHEMA"
          SCHEMA_OBSERVED="$MIGRATED_SCHEMA"
        else
          echo 'Shared database schema after migration does not match the candidate image migrations.' >&2
          migration_rc=1
        fi
      else
        echo 'Could not validate the shared database schema after migration.' >&2
        migration_rc=1
      fi
    else
      echo 'Could not read the shared database schema after migration.' >&2
      migration_rc=1
    fi
  fi
  if [[ $migration_rc -eq 0 && -n "$OLD_SHA" ]]; then
    previous_dir="$ROOT/releases/$OLD_SHA/$OLD_REV"
    if [[ ! -r "$previous_dir/manifest.json" || ! -r "$OPT_RELEASES/$OLD_SHA/$OLD_REV/docker-compose.yml" ]]; then
      echo 'Previous release image/manifest is missing; refusing activation after schema migration.' >&2
      migration_rc=1
    else
      docker load -i "$previous_dir/images.tar"
      old_image_id=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["api_image_id"])' "$previous_dir/manifest.json")
      old_image_tag=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("api_image_tag", ""))' "$previous_dir/manifest.json")
      if [[ $migration_rc -eq 0 ]]; then
        old_image_ref=$(image_ref_for_manifest laprizza-api "$OLD_SHA" "$old_image_id" "$old_image_tag") || migration_rc=1
      fi
      if [[ $migration_rc -ne 0 ]]; then
        echo 'Previous API image could not be verified; refusing candidate activation.' >&2
      else
        if [[ -n "$old_image_ref" ]]; then
          compat_name="laprizza-compat-$$"
          if ! docker run -d --rm --name "$compat_name" --network laprizza-backend \
            --env-file "/etc/laprizza/config/$OLD_REV.env" -e NODE_ENV=production -e PORT=3000 \
            -p 127.0.0.1:13000:3000 "$old_image_ref" >/dev/null; then
            echo 'Could not start the previous API compatibility container.' >&2
            migration_rc=1
          fi
          compat_ok=false
          if [[ $migration_rc -eq 0 ]]; then
            for _ in $(seq 1 30); do
              if curl --fail --silent --max-time 3 http://127.0.0.1:13000/api/v1/health >/dev/null; then compat_ok=true; break; fi
              sleep 2
            done
          fi
          if [[ $migration_rc -eq 0 && "$compat_ok" == true ]] && curl --fail --silent --show-error --max-time 10 http://127.0.0.1:13000/api/v1/catalogue >/dev/null; then
            echo "Previous API $OLD_SHA passed health and database-backed catalogue checks against schema $TARGET_SCHEMA."
            python3 - "$ROOT/releases/$OLD_SHA/$OLD_REV/manifest.json" "$TARGET_SCHEMA" <<'PY'
import json, os, sys
p=sys.argv[1]; d=json.load(open(p)); d['validated_schema_version']=sys.argv[2]
t=p+'.tmp'; open(t,'w').write(json.dumps(d)+'\n'); os.chmod(t,0o600); os.replace(t,p)
PY
          else
            echo 'Previous API failed against the migrated schema; refusing candidate activation.' >&2
            migration_rc=1
          fi
          cleanup_compat
          compat_name=''
        fi
      fi
    fi
  elif [[ $migration_rc -eq 0 ]]; then
    echo 'First deployment: no previous API exists for schema compatibility or automatic recovery.'
  fi
else migration_rc=0; fi
if [[ $migration_rc -eq 0 ]]; then
  docker compose -p laprizza -f "$COMPOSE_FILE" up -d --wait
  activation_rc=$?
else activation_rc=$migration_rc; fi
if [[ $activation_rc -eq 0 ]] && ! verify_running_images "$COMPOSE_FILE" "$expected_api" "$expected_web"; then
  echo 'Candidate containers do not use the image IDs in the release manifest.' >&2
  activation_rc=1
fi
if [[ $activation_rc -eq 0 ]]; then smoke; smoke_rc=$?; else smoke_rc=$activation_rc; fi
set -e
if [[ $smoke_rc -ne 0 ]]; then
  echo 'Candidate validation failed; restoring the previously active application release.' >&2
  if [[ -n "$OLD_SHA" && -n "$OLD_REV" ]]; then
    recover || echo 'Automatic recovery also failed; inspect VM service logs.' >&2
  else
    docker compose -p laprizza -f "$COMPOSE_FILE" down || echo 'Could not stop the unrecorded first deployment.' >&2
  fi
  exit 1
fi
previous_release_dir="$ROOT/releases/.previous-$RUN_ID"
previous_opt_dir="$OPT_RELEASES/.previous-$RUN_ID"
moved_previous_release=false
moved_previous_opt=false
published_release=false
published_opt=false
restore_promotion() {
  if [[ "$published_opt" == true ]]; then
    mv "$OPT_RELEASE_DIR" "$CANDIDATE_OPT_DIR" || return 1
    published_opt=false
  fi
  if [[ "$published_release" == true ]]; then
    mv "$RELEASE_DIR" "$CANDIDATE_RELEASE_DIR" || return 1
    published_release=false
  fi
  if [[ "$moved_previous_release" == true ]]; then
    mv "$previous_release_dir" "$RELEASE_DIR" || return 1
    moved_previous_release=false
  fi
  if [[ "$moved_previous_opt" == true ]]; then
    mv "$previous_opt_dir" "$OPT_RELEASE_DIR" || return 1
    moved_previous_opt=false
  fi
}
promotion_failed() {
  local reason=$1 recovery_rc
  echo "Release publication failed: $reason" >&2
  if ! restore_promotion; then
    echo 'Could not restore the prior release files after publication failed.' >&2
  elif [[ -n "$OLD_SHA" && -n "$OLD_REV" ]]; then
    recover
    recovery_rc=$?
    [[ $recovery_rc -eq 0 ]] || echo 'The prior release files were restored, but its containers could not be revalidated.' >&2
  else
    docker compose -p laprizza -f "$COMPOSE_FILE" down || echo 'Could not stop the unrecorded first deployment.' >&2
  fi
  exit 1
}
[[ ! -e "$previous_release_dir" && ! -e "$previous_opt_dir" ]] || promotion_failed 'a previous promotion with this run ID is still present.'
if ! python3 - "$MANIFEST" "$SCHEMA_OBSERVED" <<'PY'
import json, os, sys
p=sys.argv[1]; d=json.load(open(p)); d['validated_schema_version']=sys.argv[2]
t=p+'.tmp'; open(t,'w').write(json.dumps(d)+'\n'); os.chmod(t,0o600); os.replace(t,p)
PY
then
  promotion_failed 'could not finalize the candidate manifest.'
fi
if ! install -m 0600 "$MANIFEST" "$CANDIDATE_RELEASE_DIR/manifest.json"; then
  promotion_failed 'could not install the final candidate manifest.'
fi
if ! install -d -m 0750 "$ROOT/releases/$SHA" "$OPT_RELEASES/$SHA"; then
  promotion_failed 'could not create the candidate release destination directories.'
fi
if [[ -e "$RELEASE_DIR" ]]; then
  mv "$RELEASE_DIR" "$previous_release_dir" || promotion_failed 'could not preserve the current release directory.'
  moved_previous_release=true
fi
if [[ -e "$OPT_RELEASE_DIR" ]]; then
  if mv "$OPT_RELEASE_DIR" "$previous_opt_dir"; then
    moved_previous_opt=true
  else
    promotion_failed 'could not preserve the current Compose directory.'
  fi
fi
if ! mv "$CANDIDATE_RELEASE_DIR" "$RELEASE_DIR"; then
  promotion_failed 'could not publish the candidate release directory.'
fi
published_release=true
if ! mv "$CANDIDATE_OPT_DIR" "$OPT_RELEASE_DIR"; then
  promotion_failed 'could not publish the candidate Compose directory.'
fi
published_opt=true
if ! write_active "$SHA" "$CONFIG_REV" "$PRE_MIGRATION_SCHEMA" "$SCHEMA_OBSERVED"; then
  promotion_failed 'could not atomically update active.json.'
fi
published_release=false
published_opt=false
CANDIDATE_RELEASE_DIR=''
CANDIDATE_OPT_DIR=''
[[ "$moved_previous_release" == false ]] || rm -rf -- "$previous_release_dir" || echo 'Could not remove the superseded release directory.' >&2
[[ "$moved_previous_opt" == false ]] || rm -rf -- "$previous_opt_dir" || echo 'Could not remove the superseded Compose directory.' >&2
docker image prune -f >/dev/null || echo 'Could not prune dangling images.' >&2
echo "Activated release $SHA with configuration revision $CONFIG_REV."
