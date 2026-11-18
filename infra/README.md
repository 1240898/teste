# Infrastructure (ASIST)

Cross-cutting deployment and operational configuration for LaPrizza.
`compose.yaml` currently provides the local PostgreSQL service; application containers,
CI, reverse proxies and production deployment remain future work.

## Local PostgreSQL

From the repository root, configure `backend/.env`, including a locally chosen
PGPASSWORD, then run:

```sh
docker compose --env-file backend/.env -f infra/compose.yaml up -d --wait
```

The database uses a named volume and binds only to localhost. Node applications run
on the host during this increment. See the [ARC04 guide](../docs/user_stories/arc/ARC04.md)
for initialization, testing, architecture and limitations.
