#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT=/var/lib/laprizza
OPT_RELEASES=/opt/laprizza/releases
ACTIVE="$ROOT/active.json"
OPERATION_DIR="$ROOT/operations"
SCHEMA_OBSERVED=''
RESTORE_API_TAG=''
RESTORE_WEB_TAG=''
RESTORE_API_ID=''
RESTORE_WEB_ID=''
LOG_DIR=/var/log/laprizza/deployments
install -d -m 0750 "$LOG_DIR"
RUN_ID=${DEPLOY_RUN_ID:-manual-$(date -u +%Y%m%dT%H%M%SZ)}
[[ "$RUN_ID" =~ ^[A-Za-z0-9._-]{1,80}$ ]] || RUN_ID="manual-$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/${RUN_ID}-rollback.log"
: >> "$LOG_FILE"
chmod 0600 "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1
SHA=${RELEASE_SHA:?RELEASE_SHA is required}
PUBLIC_HOST=${DEI_PUBLIC_HOST:?DEI_PUBLIC_HOST is required}
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'Invalid release SHA' >&2; exit 2; }
SHA=${SHA,,}
[[ "$PUBLIC_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || { echo 'Invalid public host' >&2; exit 2; }
write_operation_result() {
  local exit_code=$1 status=result-failed result_path="$OPERATION_DIR/$RUN_ID-rollback.json"
  [[ "$exit_code" -eq 0 ]] && status=result-succeeded
  install -d -m 0750 "$OPERATION_DIR" || return 1
  python3 - "$ACTIVE" "$ROOT/releases" "$result_path" "$RUN_ID" "$status" "$exit_code" "${SCHEMA_OBSERVED:-}" "$SHA" <<'PY'
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
  'operation':'rollback', 'run_id':run_id, 'status':status,
  'exit_code':int(code), 'requested_release_sha':requested_sha,
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
finish() {
  local rc=$?
  write_operation_result "$rc" || echo 'Could not persist the sanitized rollback result manifest.' >&2
  return "$rc"
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
trap finish EXIT
exec 9>/var/lock/laprizza-deploy.lock
flock -x 9

ACTIVE="$ROOT/active.json"
[[ -r "$ACTIVE" ]] || { echo 'No active release manifest is recorded' >&2; exit 2; }
OLD_SHA=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["release_sha"])' "$ACTIVE")
OLD_REV=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["config_revision"])' "$ACTIVE")
OLD_COMPOSE="$OPT_RELEASES/$OLD_SHA/$OLD_REV/docker-compose.yml"
TARGET_DIR="$ROOT/releases/$SHA"
[[ "$OLD_SHA" =~ ^[0-9a-f]{40}$ && "$OLD_REV" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || { echo 'Active manifest is invalid' >&2; exit 2; }
[[ -r "$OLD_COMPOSE" ]] || { echo 'Active release files are missing' >&2; exit 2; }
[[ -d "$TARGET_DIR" ]] || { echo "Release $SHA is not retained on this VM" >&2; exit 2; }

CURRENT_STATE=$(RELEASE_SHA="$OLD_SHA" DEI_CONFIG_REVISION="$OLD_REV" docker compose -p laprizza -f "$OLD_COMPOSE" run --rm --no-deps -T api node scripts/database.js state)
CURRENT_STATE=$(printf '%s\n' "$CURRENT_STATE" | tail -n 1)
CURRENT_SCHEMA=$(python3 -c 'import json,sys;print(json.loads(sys.stdin.read())["current_version"])' <<<"$CURRENT_STATE")
SCHEMA_OBSERVED="$CURRENT_SCHEMA"

TARGET_REV=''
TARGET_COMPOSE=''
for candidate in "$TARGET_DIR"/*; do
  [[ -d "$candidate" ]] || continue
  rev=${candidate##*/}
  [[ "$rev" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || continue
  manifest="$candidate/manifest.json"
  [[ -r "$manifest" && -r "$OPT_RELEASES/$SHA/$rev/docker-compose.yml" && -r "$candidate/images.tar" ]] || continue
  if python3 - "$manifest" "$SHA" "$CURRENT_SCHEMA" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
raise SystemExit(0 if d.get('release_sha') == sys.argv[2] and d.get('validated_schema_version') == sys.argv[3] else 1)
PY
  then TARGET_REV="$rev"; TARGET_COMPOSE="$OPT_RELEASES/$SHA/$rev/docker-compose.yml"; break; fi
done
[[ -n "$TARGET_REV" ]] || { echo "No retained config revision for $SHA was validated against database schema $CURRENT_SCHEMA" >&2; exit 3; }
TARGET_ENV="/etc/laprizza/config/$TARGET_REV.env"
[[ -r "$TARGET_ENV" ]] || { echo 'Target runtime configuration is unavailable' >&2; exit 2; }

# SYS02: the network restriction gate depends on the target release.
ACCESS_LIST="/etc/laprizza/access/allowed-networks.conf"
SYS02_DEFAULT_GATEWAY="172.24.0.1"
sys02_gateway() {
  if docker network inspect laprizza-backend >/dev/null 2>&1; then
    docker network inspect laprizza-backend \
      --format '{{range .IPAM.Config}}{{if .Gateway}}{{.Gateway}} {{end}}{{end}}' | awk '{print $1}'
  else
    printf '%s\n' "$SYS02_DEFAULT_GATEWAY"
  fi
}
sys02_allows() {
  # Same precedence as the Nginx geo module: the most specific matching network
  # wins (0 = deny, 1 = allow). Exit codes: 0 allowed, 1 denied, 2 invalid list.
  python3 - "$ACCESS_LIST" "$1" <<'PY'
import ipaddress, re, sys
path, raw_address = sys.argv[1], sys.argv[2]
address = ipaddress.ip_address(raw_address)
best = None
with open(path) as entries:
    for number, line in enumerate(entries, 1):
        entry = line.split('#', 1)[0].strip()
        if not entry:
            continue
        # Only "<address>[/<numeric prefix>] 0;" or "... 1;" is supported.
        match = re.fullmatch(r'([0-9A-Fa-f:.]+)(?:/([0-9]{1,3}))?\s+([01]);', entry)
        network = None
        if match:
            try:
                text = match.group(1) if match.group(2) is None else f'{match.group(1)}/{match.group(2)}'
                network = ipaddress.ip_network(text, strict=False)
            except ValueError:
                network = None
        if network is None:
            print(f'SYS02: unsupported entry on line {number} of {path}; '
                  'expected "<address>[/<prefix length>] 0;" or "<address>[/<prefix length>] 1;"', file=sys.stderr)
            sys.exit(2)
        if network.version == address.version and address in network:
            if best is None or network.prefixlen >= best[0]:
                best = (network.prefixlen, match.group(3))
sys.exit(0 if best is not None and best[1] == '1' else 1)
PY
}
if grep -q '/etc/laprizza/access:/etc/nginx/access' "$TARGET_COMPOSE"; then
  # The target release enforces SYS02: validate its network prerequisites.
  [[ -r "$ACCESS_LIST" ]] || { echo 'SYS02 allowed-networks file unavailable' >&2; exit 2; }
  [[ -d /var/log/laprizza/access ]] || { echo 'SYS02 denied-access log directory missing' >&2; exit 2; }
  # SYS02: trusted proxies whose X-Forwarded-For identifies the real client.
  TRUSTED_PROXIES="/etc/laprizza/access/trusted-proxies.conf"
  [[ -r "$TRUSTED_PROXIES" ]] || { echo "SYS02 trusted-proxies file unavailable: $TRUSTED_PROXIES" >&2; exit 2; }
  if grep -Ev '^[[:space:]]*(#.*)?$|^[[:space:]]*set_real_ip_from[[:space:]]+[0-9A-Fa-f:.]+(/[0-9]{1,3})?;[[:space:]]*(#.*)?$' "$TRUSTED_PROXIES" >/dev/null; then
    echo "SYS02: $TRUSTED_PROXIES may only contain 'set_real_ip_from <address>[/<prefix length>];' lines and comments; no release was changed." >&2
    exit 2
  fi
  SMOKE_GATEWAY=$(sys02_gateway)
  [[ "$SMOKE_GATEWAY" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || {
    echo 'SYS02: could not determine the laprizza-backend network gateway' >&2
    exit 2
  }
  if sys02_allows "$SMOKE_GATEWAY"; then sys02_rc=0; else sys02_rc=$?; fi
  case "$sys02_rc" in
    0) ;;
    1) echo "SYS02: rollback smoke checks would reach Nginx from $SMOKE_GATEWAY, which is denied by $ACCESS_LIST. Allow it (for example '$SMOKE_GATEWAY 1;') and remove any more specific '0;' entry that covers it, then run the rollback again; no release was changed." >&2
       exit 2 ;;
    *) echo "SYS02: $ACCESS_LIST is not in the supported format; fix it and run the rollback again; no release was changed." >&2
       exit 2 ;;
  esac
else
  # The target release predates SYS02 and would serve every client.
  echo "SYS02: rollback to $SHA refused. This release predates the DEI network/VPN access restriction, and no VM-level enforcement is configured to keep the restriction in place. Roll back to a release that includes SYS02 instead." >&2
  exit 3
fi


# HTTPS: releases that mount the certificate need it on the VM.
TLS_CERT="/etc/laprizza/tls/laprizza.crt"
TLS_KEY="/etc/laprizza/tls/laprizza.key"
# Keep identical in deploy.sh and rollback.sh.
# Releases whose Compose file mounts the certificate serve HTTPS on 2229.
uses_https() {
  grep -q '/etc/laprizza/tls:/etc/nginx/tls' "$1"
}
if uses_https "$TARGET_COMPOSE"; then
  [[ -r "$TLS_CERT" && -e "$TLS_KEY" ]] || {
    echo "Rollback to $SHA refused: this release serves HTTPS but $TLS_CERT or $TLS_KEY is missing; no release was changed." >&2
    exit 2
  }
  openssl x509 -in "$TLS_CERT" -noout -checkend 0 >/dev/null 2>&1 || {
    echo "Rollback to $SHA refused: $TLS_CERT is invalid or expired; no release was changed." >&2
    exit 2
  }
fi

install -m 0750 "$0" "$OPT_RELEASES/$SHA/$TARGET_REV/rollback.sh"

export RELEASE_SHA="$SHA" DEI_CONFIG_REVISION="$TARGET_REV"
docker load -i "$TARGET_DIR/$TARGET_REV/images.tar"
python3 - "$TARGET_DIR/$TARGET_REV/manifest.json" "$SHA" <<'PY'
import json, re, sys
d=json.load(open(sys.argv[1]))
assert d.get('release_sha') == sys.argv[2]
assert re.fullmatch(r'sha256:[0-9a-f]{64}', d.get('api_image_id',''))
assert re.fullmatch(r'sha256:[0-9a-f]{64}', d.get('web_image_id',''))
PY
manifest="$TARGET_DIR/$TARGET_REV/manifest.json"
api_id=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["api_image_id"])' "$manifest")
web_id=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["web_image_id"])' "$manifest")
api_image_tag=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("api_image_tag", ""))' "$manifest")
web_image_tag=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("web_image_tag", ""))' "$manifest")
api_ref=$(image_ref_for_manifest laprizza-api "$SHA" "$api_id" "$api_image_tag") || exit 2
web_ref=$(image_ref_for_manifest laprizza-web "$SHA" "$web_id" "$web_image_tag") || exit 2
api_tag=${api_ref#laprizza-api:}
web_tag=${web_ref#laprizza-web:}
export API_IMAGE_TAG="$api_tag" WEB_IMAGE_TAG="$web_tag"
docker compose -p laprizza -f "$TARGET_COMPOSE" config -q

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
  # Keep identical in deploy.sh and rollback.sh.
  # $1: Compose file of the release being checked. Releases that mount the HTTPS
  # certificate serve the application on 2229 (HTTPS) and only redirect on 2228;
  # older releases serve it over HTTP on 2228.
  local compose=$1 failed=0 api_result api_status api_body redirect
  local base_url="http://127.0.0.1:2228"
  local -a tls=()

  if uses_https "$compose"; then
    base_url="https://127.0.0.1:2229"
    tls=(--cacert "$TLS_CERT")
    if ! redirect=$(curl --silent --show-error --max-time 10 --output /dev/null \
      --write-out '%{http_code} %{redirect_url}' "http://127.0.0.1:2228/register") ||
      [[ "$redirect" != '301 https://127.0.0.1:2229/register' ]]; then
      echo 'Smoke check failed: HTTP port 2228 does not redirect approved clients to HTTPS' >&2
      failed=1
    fi
  fi

  if ! curl "${tls[@]}" --fail --silent --show-error --max-time 10 \
    "$base_url/api/v1/health" |
    python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"'; then
    echo 'Smoke check failed: API health' >&2
    failed=1
  fi

  if ! curl "${tls[@]}" --fail --silent --show-error --max-time 10 \
    "$base_url/register" | grep -q 'id="root"'; then
    echo 'Smoke check failed: /register SPA entry' >&2
    failed=1
  fi

  if ! curl "${tls[@]}" --fail --silent --show-error --max-time 10 \
    "$base_url/register/x/y" | grep -q 'id="root"'; then
    echo 'Smoke check failed: nested SPA entry' >&2
    failed=1
  fi

  if api_result=$(curl "${tls[@]}" --silent --show-error --max-time 10 \
    -w '\n%{http_code}' \
    "$base_url/api/v1/does-not-exist"); then

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

restore_active_release_images() {
  local active_manifest="$ROOT/releases/$OLD_SHA/$OLD_REV/manifest.json"
  local active_archive="$ROOT/releases/$OLD_SHA/$OLD_REV/images.tar"
  local active_ids
  [[ -r "$ACTIVE" && -r "$active_manifest" && -r "$active_archive" ]] || {
    echo 'Could not restore the prior release: active image manifest or archive is missing.' >&2
    return 1
  }
  active_ids=$(python3 - "$ACTIVE" "$active_manifest" "$OLD_SHA" "$OLD_REV" <<'PY'
import json, re, sys
active=json.load(open(sys.argv[1])); manifest=json.load(open(sys.argv[2]))
sha, revision=sys.argv[3:]
assert active.get('release_sha') == sha and active.get('config_revision') == revision
assert manifest.get('release_sha') == sha and manifest.get('config_revision') == revision
api=manifest.get('api_image_id',''); web=manifest.get('web_image_id','')
assert active.get('api_image_id') == api and active.get('web_image_id') == web
assert re.fullmatch(r'sha256:[0-9a-f]{64}', api)
assert re.fullmatch(r'sha256:[0-9a-f]{64}', web)
print(api, web)
PY
) || { echo 'Could not restore the prior release: active image IDs do not match its manifest.' >&2; return 1; }
  read -r RESTORE_API_ID RESTORE_WEB_ID <<<"$active_ids"
  local restore_manifest="$ROOT/releases/$OLD_SHA/$OLD_REV/manifest.json"
  local restore_api_image_tag restore_web_image_tag
  restore_api_image_tag=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("api_image_tag", ""))' "$restore_manifest")
  restore_web_image_tag=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("web_image_tag", ""))' "$restore_manifest")
  docker load -i "$active_archive" || { echo 'Could not load the prior release image archive.' >&2; return 1; }
  restore_api_ref=$(image_ref_for_manifest laprizza-api "$OLD_SHA" "$RESTORE_API_ID" "$restore_api_image_tag") || return 1
  restore_web_ref=$(image_ref_for_manifest laprizza-web "$OLD_SHA" "$RESTORE_WEB_ID" "$restore_web_image_tag") || return 1
  RESTORE_API_TAG=${restore_api_ref#laprizza-api:}
  RESTORE_WEB_TAG=${restore_web_ref#laprizza-web:}
}
set +e
docker compose -p laprizza -f "$TARGET_COMPOSE" up -d --wait
rc=$?
if [[ $rc -eq 0 ]] && ! verify_running_images "$TARGET_COMPOSE" "$api_id" "$web_id"; then
  echo 'Rollback containers do not use the image IDs in the retained manifest.' >&2
  rc=1
fi
if [[ $rc -eq 0 ]]; then smoke "$TARGET_COMPOSE"; rc=$?; fi
if [[ $rc -ne 0 ]]; then
  echo 'Requested rollback release failed validation; restoring the release active before this operation.' >&2
  export RELEASE_SHA="$OLD_SHA" DEI_CONFIG_REVISION="$OLD_REV"
  restore_active_release_images
  restore_rc=$?
  if [[ $restore_rc -eq 0 ]]; then
    export API_IMAGE_TAG="$RESTORE_API_TAG" WEB_IMAGE_TAG="$RESTORE_WEB_TAG"
    docker compose -p laprizza -f "$OLD_COMPOSE" up -d --wait
    restore_rc=$?
  fi
  if [[ $restore_rc -eq 0 ]] && ! verify_running_images "$OLD_COMPOSE" "$RESTORE_API_ID" "$RESTORE_WEB_ID"; then
    echo 'Restored containers do not use the IDs recorded for the previously active release.' >&2
    restore_rc=1
  fi
  if [[ $restore_rc -eq 0 ]]; then smoke "$OLD_COMPOSE"; restore_rc=$?; fi
  set -e
  [[ $restore_rc -eq 0 ]] || echo 'Restoration of the prior active release also failed; inspect VM logs.' >&2
  exit 1
fi
set -e
if ! python3 - "$ACTIVE.tmp" "$SHA" "$TARGET_REV" "$CURRENT_SCHEMA" "$TARGET_DIR/$TARGET_REV/manifest.json" "$RUN_ID" <<'PY'
import json, os, sys
manifest=json.load(open(sys.argv[5]))
active={'release_sha':sys.argv[2], 'config_revision':sys.argv[3], 'schema_version':sys.argv[4], 'api_image_id':manifest['api_image_id'], 'web_image_id':manifest['web_image_id'], 'run_id':sys.argv[6]}
with open(sys.argv[1],'w') as f: json.dump(active,f); f.write('\n'); f.flush(); os.fsync(f.fileno())
os.replace(sys.argv[1], '/var/lib/laprizza/active.json')
PY
then
  echo 'Could not record the validated rollback release; restoring the previously active release.' >&2
  set +e
  export RELEASE_SHA="$OLD_SHA" DEI_CONFIG_REVISION="$OLD_REV"
  restore_active_release_images
  restore_rc=$?
  if [[ $restore_rc -eq 0 ]]; then
    export API_IMAGE_TAG="$RESTORE_API_TAG" WEB_IMAGE_TAG="$RESTORE_WEB_TAG"
    docker compose -p laprizza -f "$OLD_COMPOSE" up -d --wait
    restore_rc=$?
  fi
  if [[ $restore_rc -eq 0 ]] && ! verify_running_images "$OLD_COMPOSE" "$RESTORE_API_ID" "$RESTORE_WEB_ID"; then
    restore_rc=1
  fi
  if [[ $restore_rc -eq 0 ]]; then smoke "$OLD_COMPOSE"; restore_rc=$?; fi
  set -e
  [[ $restore_rc -eq 0 ]] || echo 'The previously active release could not be revalidated after the rollback manifest write failed.' >&2
  exit 1
fi
echo "Recovered release $SHA (configuration revision $TARGET_REV) against schema $CURRENT_SCHEMA."
