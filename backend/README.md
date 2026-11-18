# Backend (skeleton)

Starting skeleton for the LaPrizza HTTP API. It is domain-agnostic on purpose: the RFP does not mandate any technology or architecture for this part of the system, so **both choices must be justified by the team**.

This project provides tooling, environment-based configuration, cross-cutting plumbing, a health-check endpoint, and **empty domain modules**. Put business code inside the relevant module under `src/modules/`; do not add domain logic to `index.js`.

## Runtime

- Node.js **20 LTS or 22+ LTS** (the `engines` field in `package.json` requires `>=20`)
- npm **10 or later** (bundled with Node.js 20+)
- ECMAScript Modules (`"type": "module"` in `package.json`)

## Install

```bash
cd backend
npm install
```

## Configure

```bash
cp .env.example .env
```

Adjust values in `.env` as needed, including the PostgreSQL settings and your own password. There are no secrets in the example file. See the ARC04 guide linked below.

| Variable      | Default                 | Purpose                                                     |
| ------------- | ----------------------- | ----------------------------------------------------------- |
| `PORT`        | `8080`                  | HTTP port                                                   |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origin (must match the frontend dev server) |
| `NODE_ENV`    | `development`           | Node environment                                            |

If the frontend shows **Backend: unreachable**, the usual cause is a CORS mismatch: `CORS_ORIGIN` must equal the frontend origin (for the React + Vite skeleton that is `http://localhost:5173`; `http://localhost:3000` is also a typical local origin if the team changes the frontend port).

## Run

Start PostgreSQL and run `npm run db:migrate` first (see the ARC04 guide below).

```bash
npm start
```

During development, reload on file changes:

```bash
npm run dev
```

- API: http://localhost:8080
- Health: http://localhost:8080/api/v1/health
- OpenAPI UI: http://localhost:8080/api-docs

The versioned API prefix is `/api/v1`. OpenAPI documents only the health endpoint in this skeleton.

## Tests

### Reset before a manual Postman run

With PostgreSQL running, stop the backend and any active collection runs. Set
`BOOTSTRAP_ADMINISTRATOR_NAME`, `BOOTSTRAP_ADMINISTRATOR_EMAIL`, and
`BOOTSTRAP_ADMINISTRATOR_PASSWORD` in your local `backend/.env` using a password
that meets the application's password policy. These credentials create the
initial Administrator after each reset; keep them locally only while using
this workflow.

From `backend/`, run:

```bash
npm run db:reset
npm run dev
```

The reset asks you to type the configured `PGDATABASE` name. It deletes the
entire `public` schema, reapplies migrations (including initial reference data),
and recreates the Administrator in one transaction. A failure rolls back the reset.
Other schemas are not reset. The command refuses production mode, remote hosts,
and non-interactive execution. It uses the database settings in `backend/.env`;
it does not start PostgreSQL or change Docker volumes. Use a dedicated local
database for collection testing. Log in again in Postman and clear any saved
resource IDs before running the collection. When a test needs a Manager, create
the account and assign `MANAGER` through the Administrator user-management API
so the change is authorized and audited.

### Reset the shared DEI database

The DEI PostgreSQL service uses `vs398.dei.isep.ipp.pt:5432`, database
`laprizza`. Configure the connection and `BOOTSTRAP_ADMINISTRATOR_*` values in the
untracked `backend/.env`. Access requires a network route to the internal service.

Coordinate with the team, stop the backend and collection runs, and back up any
data that must be retained. From `backend/`, run `npm run db:reset:dei` and type
`vs398.dei.isep.ipp.pt:5432/laprizza` when prompted. This deletes the shared
`public` schema, reapplies migrations and recreates the Administrator in one
transaction. It does not reset other databases or schemas. Production mode,
other remote destinations, and non-interactive execution remain blocked.
Log in again as the Administrator, assign any Manager role through the audited
user-management flow, and clear previously saved resource IDs afterwards.

The DEI template, local Docker and CI use PostgreSQL 18.
Successful migration on the DEI service does not replace full
integration testing on that version. Keep application credentials out of Git
and use a dedicated application role rather than the `postgres` administrator
for normal deployment.

### Automated tests

```bash
npm test
```

The default suite verifies HTTP health, database configuration and transaction cleanup.
Real PostgreSQL tests are opt-in with `npm run test:db`.

## Lint and format

```bash
npm run lint
npm run format
```

Formatter settings are mirrored in `.editorconfig`.

## Domain-first module structure

`index.js` is the process entry point. `src/app.js` composes the Express application, mounts `/api/v1`, and registers domain modules. Cross-cutting plumbing lives in `src/shared/`. Each business domain lives in its own folder under `src/modules/` and owns its internal layers.

```text
backend/
├── index.js
├── src/
│   ├── app.js
│   ├── modules/
│   │   ├── user-authentication-management/
│   │   │   ├── api/
│   │   │   ├── application/
│   │   │   ├── domain/
│   │   │   ├── infrastructure/
│   │   │   └── index.js
│   │   ├── customer-management/
│   │   ├── product-category-management/
│   │   ├── allergen-management/
│   │   ├── product-management/
│   │   ├── pizza-size-management/
│   │   ├── pizza-component-type-management/
│   │   ├── pizza-component-configuration/
│   │   ├── stock-information-management/
│   │   ├── predefined-pizza-management/
│   │   └── product-catalogue-and-information/
│   └── shared/
│       ├── config/
│       ├── errors/
│       ├── health/
│       ├── logging/
│       └── openapi/
└── tests/
    ├── unit/
    └── integration/
```

### Where the team should implement features

| Layer inside a module | Responsibility                                                              |
| --------------------- | --------------------------------------------------------------------------- |
| `domain/`             | Entities, value objects, aggregates, domain services, repository interfaces |
| `application/`        | Use cases, application services, DTOs                                       |
| `infrastructure/`     | Persistence adapters, external services, repository implementations         |
| `api/`                | HTTP routes, controllers, request/response mapping for that module          |

Module folders are placeholders until a User Story needs them. Do **not** put all controllers in a global `src/controllers` (or a global `src/domain`) — that mixes unrelated bounded contexts.

Follow [docs/guidelines/us_template.md](../docs/guidelines/us_template.md) when documenting a back-end User Story.

## Technology and architecture choices

Express, Jest, ESLint, Prettier, and this modular layout are a **starting skeleton**. The team must still defend (in the SAD / evaluations) the language, framework, persistence, and architecture they keep or replace. Nothing in this skeleton is a locked architectural decision except the requirement to organise work by business domain.

## PostgreSQL infrastructure (ARC04)

Application startup now requires PostgreSQL. Before running `npm start`, configure
the PG settings in `.env`, start PostgreSQL and run `npm run db:migrate`.
`npm run db:check` verifies connectivity; `npm run test:db` requires a dedicated
PGDATABASE ending in `_test`. Regular tests do not require a database.
See [ARC04 decisions and setup guide](../docs/user_stories/arc/ARC04.md) for complete commands,
transaction usage, migration rules, security and the official acceptance matrix.
