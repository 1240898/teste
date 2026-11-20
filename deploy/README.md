# SYS01: DEI deployment

This directory contains the VM deployment and recovery entry points. The separate
`.github/workflows/deploy.yml` runs backend and frontend validation, packages
immutable images, then connects to the DEI VM over pinned SSH. It does not call or
reuse `.github/workflows/main.yml`. PostgreSQL integration tests use only the
ephemeral PostgreSQL service attached to the GitHub runner.

The deployable application currently consists of the Node.js API and the React
single-page application served by Nginx. The `ai/` directory is not a deployed
service. Nginx serves HTTP and forwards `/api/v1/` to the API on the private
Docker bridge network. TLS is not configured for this deployment yet. The
existing DEI PostgreSQL service stays outside this Compose stack.

## Workflow and release behavior

The workflow runs daily at 09:00 UTC and can be started manually for a deploy or
for a rollback to a retained full commit SHA. Maintainers configure the recurring
time by changing the `cron` expression under `schedule` in
`.github/workflows/deploy.yml`; `workflow_dispatch` provides an on-demand run.
A deploy revision must be a commit
on the repository's default branch. Backend lint, migrations and the complete
coverage suite run with `RUN_DATABASE_TESTS=1` against the runner's isolated
PostgreSQL 18 service; frontend lint, tests, integration check, production build
and bundle scan run before any SSH operation. Backend and frontend Jest JSON
results and coverage reports are archived for 90 days; a missing Jest result
fails its artifact upload when that test step ran.

The workflow initially tags images with the full 40-character commit SHA, then
archives them under build-specific tags containing the SHA, image ID, and
workflow run ID. The manifest records both image IDs and exact tags. Deploy and
rollback load those exact references, so a rebuilt image for the same SHA cannot
replace another release's image tag. The retained Compose file stays a template
that refers to the protected runtime `env_file`; it is not
saved as resolved output, so database credentials are not copied into release
files. This prevents loading another build of the same SHA from changing which
image a release activates. Candidate files are staged separately; a matching
SHA/configuration release is replaced only after candidate smoke checks pass.
The image bundle is retained for 7 days, and a separate `dei-manifest-<sha>`
artifact retains its manifest for 90 days. GitHub environment
`dei` protects deployment without required reviewers so scheduled runs remain
unattended; `dei-rollback` must require reviewers. Workflow concurrency uses a shared FIFO queue;
the VM also takes `/var/lock/laprizza-deploy.lock`, so scheduled deployment,
manual rollback and automatic recovery cannot change the same Compose project
at once. Do not enable cancellation for an active run: automatic recovery must
finish while it holds the deployment lock.

A deploy validates the Compose configuration and database state first. If
migrations are pending, it skips the verified-backup gate only when the database
has no migration ledger and the public schema has no tables; this is logged
explicitly. Otherwise it fails closed unless there is a recent, verified backup
record at `/var/lib/laprizza/backups/verified.json`. The repository currently has
no SYS08 backup implementation or evidence producer; this file format is a
proposed SYS01 gate, not an existing SYS08 capability. The team must agree on and
operate a real backup and restore-verification procedure before anyone creates
this record. It must identify the database's current schema, have
`restorable: true`, include a backup ID, and be no more than 24 hours old. After
Before the shared migration, the deploy runs a rehearsal on a disposable,
internal Docker network with PostgreSQL 18: it builds the exact current schema,
creates synthetic registration data through the previous API, applies the
candidate migrations, then checks the previous API's health, catalogue read,
duplicate detection and a new write. The rehearsal uses random synthetic
database credentials and no DEI database settings. It is cleaned up on exit.
The shared migration is gated on both the verified backup and successful
rehearsal; the rehearsal does not restore or copy DEI database contents. After
the shared migration, the previous API also must pass health and catalogue
checks before the new release can activate.

The new Compose stack is activated with `docker compose up -d --wait`; this is a
single-host deployment and can briefly interrupt requests while containers are
replaced. The VM then checks API health over HTTP and that `/register` serves
the SPA. A validation failure attempts to reactivate the previous application
release automatically. Application rollback never reverses a database
migration. A first deployment has no prior release for automatic recovery.
Manual rollback uses only retained images/configuration and is refused unless
the selected release manifest records validation against the exact schema
currently in use. It checks this before loading images or installing release
files. Automatic recovery reloads both retained images by their manifest IDs
and exact recorded tags before Compose starts them.
Treat each runtime configuration revision as immutable: install changed values
under a new revision and update `DEI_CONFIG_REVISION`. If the SHA and revision
are already active and no migrations are pending, the workflow performs smoke
checks and skips container reactivation.

Deployment definitions and scripts are retained under
`/opt/laprizza/releases/<commit-sha>/<config-revision>/`. Image archives and
release manifests are retained under
`/var/lib/laprizza/releases/<commit-sha>/<config-revision>/`. Each remote deploy
or rollback writes a separate, mode-0600 run log to
`/var/log/laprizza/deployments/<run-id>-deploy.log` or
`<run-id>-rollback.log`; the workflow also archives the sanitized output in
GitHub for 90 days. Install `deploy/logrotate.conf` as
`/etc/logrotate.d/laprizza` to rotate VM logs weekly and retain them for up to
90 days. VM release pruning must retain every release intended for rollback and
should be performed only after confirming that the desired known-good revision
remains available. Each operation writes a mode-0600 result manifest under
`/var/lib/laprizza/operations/` with the active SHA, image IDs, config revision,
observed schema, run ID and result status. GitHub archives that result and the
sanitized runner/SSH diagnostic log for 90 days, including when SSH preparation
fails. The release manifest records the exact schema version against which the
API was validated. Logs must not include environment contents; scripts
never enable shell tracing and GitHub masks configured secrets.

## GitHub configuration

Create GitHub Actions environments named `dei` and `dei-rollback`. Keep required
reviewers disabled on `dei` so scheduled deployments are unattended, and require
reviewers on `dei-rollback`. Configure the two SSH secrets in both environments.
Configure the five non-secret variables as repository or organization Actions
variables so the validation and package jobs can read the revision/host before
the protected deployment job:

| Kind | Name | Purpose |
| --- | --- | --- |
| Environment secret | `DEI_SSH_PRIVATE_KEY` | Private key for the key-only VM deployment account |
| Environment secret | `DEI_SSH_KNOWN_HOSTS` | Pre-pinned host key line, including non-default port if used |
| Repository/org variable | `DEI_SSH_HOST` | `vsgate-ssh.dei.isep.ipp.pt` |
| Repository/org variable | `DEI_SSH_PORT` | `10271` |
| Repository/org variable | `DEI_SSH_USER` | Dedicated deployment account |
| Repository/org variable | `DEI_CONFIG_REVISION` | Existing non-secret runtime config revision name |
| Repository/org variable | `DEI_PUBLIC_HOST` | VM hostname used by the HTTP smoke checks |

The known-host key must be verified out of band before adding it. Do not use
`ssh-keyscan` during workflow execution. SSH access uses the dedicated deploy
user and pinned key authentication, disables forwarding, and does not permit
root password login. SSH client config requires batch mode, keepalive checks,
and strict host-key checking.
In both `dei` and `dei-rollback`, configure the environment deployment-branch
policy to allow only the repository's default branch. The workflow also checks
the triggering ref before any job that can access those environments.

## VM setup prerequisites

The VM work is an administrator-operated setup; the workflow does not provision
the VM, firewall, PostgreSQL, or runtime secrets. Before the first deploy:

1. The selected target in the machine setup report is the Debian 13 (trixie)
   LXD template 89 with nesting enabled. Docker Engine 26.1.5 and Docker Compose
   2.26.1 are already documented as installed there; verify them rather than
   reinstalling. Confirm OpenSSH server, `bash`, `flock` (`util-linux`),
   `python3`, `curl`, `grep`, and `logrotate` are present.
2. Create the dedicated deployment account and its SSH authorized key. Give it
   Docker access (membership in the `docker` group is effectively root access),
   ownership of `/var/lib/laprizza` and `/opt/laprizza/releases`, write access
   to `/var/log/laprizza/deployments`, and permission to create incoming release
   directories. Configure SSH for key-only deploy-user access, disable
   forwarding, and disable root password login.
3. Create `/etc/laprizza/config/` and install the selected revision as
   `/etc/laprizza/config/<revision>.env`. Keep it outside Git and image archives;
   use root ownership and permissions `root:deploy`, mode `0640`, so
   the Compose CLI can read it. Include at least:

   ```dotenv
   PGHOST=<DEI PostgreSQL DNS name>
   PGPORT=5432
   PGDATABASE=<database name>
   PGUSER=<application database role>
   PGPASSWORD=<database password>
   PGSSLMODE=disable
   JWT_SECRET=<random secret of at least 32 bytes>
   SESSION_COOKIE_SECURE=false
   CORS_ORIGIN=http://<DEI_PUBLIC_HOST>
   PASSWORD_RECOVERY_WEB_URL=http://<DEI_PUBLIC_HOST>/
   ```

   `PGSSLMODE=disable` is required for the currently assigned DEI PostgreSQL
   endpoint because it rejects SSL connections. This unencrypted database
   connection is approved only over the isolated internal DEI network; database
   credentials and traffic are not encrypted in transit. Do not expose this
   connection over a public or untrusted network.
   If the database endpoint or network policy changes, revisit this setting.
   Add SMTP settings when password recovery email is enabled. Google sign-in
   settings must be all present or all absent. For this HTTP-only deployment,
   leave Google sign-in settings absent; Google requires HTTPS redirect URIs
   outside localhost. Never put credentials in GitHub
   variables, manifests, Docker build arguments, or deployment logs. Production
   configuration must explicitly set `PGSSLMODE` to either `disable` for this
   approved isolated DEI network or `verify-full` for a TLS-enabled database.
4. Open inbound TCP 80 only from the intended DEI network/VPN. HTTP and session
   cookies are unencrypted in this deployment; do not expose it to public or
   untrusted networks. `SESSION_COOKIE_SECURE=false` is required for browser
   login over HTTP. Keep SSH on the configured port with the key-only controls
   described above. Ensure the API's PostgreSQL connection is allowed
   outbound to the separate DEI database. No host port is published for the API.
   Install `deploy/logrotate.conf` as `/etc/logrotate.d/laprizza` with root
   ownership so per-run VM logs are rotated and retained for up to 90 days.
5. Define and operate the SYS08 backup and restore-verification procedure before
   allowing deployments with schema migrations on a non-empty database. The
   backup gate is skipped only when the migration ledger is absent and `public`
   contains no base tables. The current repository does not provide that
   implementation. If the team approves the SYS01 evidence format,
   the procedure can atomically write `/var/lib/laprizza/backups/verified.json`,
   for example:

   ```json
   {"backup_id":"<unique-id>","schema_version":"0028_repair_legacy_invitation_methods.sql","verified_at":"2026-11-16T08:00:00Z","restorable":true}
   ```

   The marker is evidence that the backup was verified and restorable; it is not
   itself a backup. Retain the corresponding backup and recovery instructions.
   Until an actual procedure produces verified evidence, deployments with
   pending migrations stop before migration.
6. Configure both GitHub environments as described above, install their SSH
   secrets, set the five repository or organization variables above, verify the
   SSH host key, and confirm HTTP access from the runner after the firewall is
   ready.
7. Review the first schema migration and backup procedure with the SYS08 owner.
   Perform the first deployment in a planned window: it has no previous release
   to recover automatically. Confirm the public UI and API, then record the
   release SHA as the known-good revision. Test a manual rollback only after a
   later release has proved the older API compatible with the current schema.

The deploy script removes its incoming upload directory on every exit, including
validation failures. Clean stale incoming directories left by an interrupted
transfer before deployment. The VM must have `/opt/laprizza/releases`,
`/var/log/laprizza/deployments`, `/var/lib/laprizza`,
`/var/lib/laprizza/releases`, `/var/lib/laprizza/backups`,
`/var/lib/laprizza/incoming` and `/var/lock` available to the deployment
process. The incoming payload can contain application images, so restrict its
permissions and remove abandoned upload directories.
Docker's `json-file` logs are bounded to five 10 MB files per container; inspect
them with `docker compose logs` during incidents and do not print environment
values or secrets into them.

## SYS02 network access restriction

Nginx only serves clients whose address is allowed by
`/etc/laprizza/access/allowed-networks.conf`. The supported format is one 
`<address>[/<prefix>] 1;` (allow) or `<address>[/<prefix>] 0;` (deny) entry per
line, with optional `#` comments. As in the Nginx `geo` module, the most specific
matching network decides, and addresses that match no entry are denied. Any
other directive (for example `default`) or value is not supported:
`deploy.sh` and `rollback.sh` reject the list before changing the active release. Other clients receive HTTP 403 and are recorded in
`/var/log/laprizza/access/denied.log`. Before installing a release that includes
SYS02, the VM must have:

- `/etc/laprizza/access/allowed-networks.conf`, owned by `root:root`, mode `0644`,
  containing an entry for `172.24.0.1`;
- `/var/log/laprizza/access`, owned by `101:root` (the unprivileged Nginx user
  in the web image), mode `0750`.

The post-deployment smoke checks run on the VM and reach Nginx from the gateway
of the `laprizza-backend` network, so that gateway must belong to an allowed
network. The Compose file fixes the subnet (`172.24.0.0/16`, gateway
`172.24.0.1`) only when the network is created; Compose reuses an existing
network without applying new IPAM settings. Before activating a release,
`deploy.sh` therefore reads the real gateway of the existing network (or uses
`172.24.0.1` when the network does not exist yet) and checks it against the
list. If it is not allowed, the deployment stops before changing anything and
reports the exact line to add.

### Existing network with a different gateway

No teardown is needed and the active release keeps running:

1. Read the gateway reported in the deployment log, or check it with
   `docker network inspect laprizza-backend --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'`.
2. Add it to `/etc/laprizza/access/allowed-networks.conf`, for example
   `172.18.0.1    1;   # This server (smoke checks)`.
3. Run the *DEI deployment* workflow again.

### Rollback and releases before SYS02

`rollback.sh` applies the SYS02 gate according to the target release. A
release whose Compose file mounts `/etc/laprizza/access` is checked for the
list, the log directory and an allowed gateway. A release that predates SYS02
does not enforce the restriction and no VM-level firewall is configured, so
rolling back to it is refused explicitly (exit code 3); select a release that
includes SYS02 instead.

During the first deployment that introduces SYS02, the automatic recovery in
`deploy.sh` can still restore the previously active release if the candidate
fails validation. That release predates SYS02, so the restriction is only
absent while it remains active, which is the same state as before the
deployment. Fix the reported problem and deploy again.


## Local Compose validation

The deployment Compose file requires a real SHA and config revision and will
fail if either is absent. After creating a sample runtime configuration and
loading the tagged images, the VM-side checks are:

```sh
export RELEASE_SHA=<40-character-commit-sha>
export DEI_CONFIG_REVISION=<installed-config-revision>
docker compose -p laprizza -f deploy/docker-compose.yml config -q
docker compose -p laprizza -f deploy/docker-compose.yml up -d --wait
```

Do not run those activation commands against the production VM as a substitute
for the workflow; `deploy.sh` supplies the backup, compatibility, serialization,
manifest, and recovery gates.
