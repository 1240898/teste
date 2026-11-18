# Tests

- `unit/` — domain and application tests (no HTTP, no real database)
- `integration/` — health and BCK01 HTTP tests, plus opt-in PostgreSQL persistence tests

Keep tests next to this layout. Do not mix production code into this folder.

PostgreSQL unit tests exercise configuration and transaction cleanup without a server.
The opt-in `npm run test:db` suite requires an isolated database ending in `_test` and
creates/removes only its own isolated schema and migration ledger. See [ARC04](../../docs/user_stories/arc/ARC04.md).

BCK01 unit tests cover the aggregate/value objects, application services, real bcrypt/JWT
adapters, bootstrap and OpenAPI. Its HTTP suite uses real security with an in-memory
repository; its opt-in PostgreSQL suite verifies constraints, concurrent uniqueness,
bootstrap serialization, private credential handling and safe DTO mapping and full HTTP persistence.
`npm run test:db` runs both infrastructure and BCK01 PostgreSQL suites.
