# LaPrizza

LaPrizza is an information system for managing the business and operations of a pizzeria. The project is developed as a monorepo by the ISEP 2026/2027 team for LAPR5, with contributions across Software Engineering, Software Architecture, Artificial Intelligence, Systems Administration, and Graphic Systems and Interaction.

The planned platform covers user and customer management, products and menus, allergens, pizza configuration, stock, orders, kitchen operations, and preparation scheduling. The current increment includes working back-end modules for authentication and user management, customer management, product categories, allergens, pizza sizes and component types, products, and stock information/history. The React client is an initial web interface. The `ai/` module provides AI01 material requirements and AI06 authorised HTTP input loading, with versioned demonstrations. See the [Prolog run instructions](ai/README.md).

## Repository structure

```text
.
├── backend/       # Express REST API, PostgreSQL migrations, and tests
├── frontend/      # React + Vite web client
├── ai/            # AI01 calculations, AI06 HTTP inputs, demonstrations and tests
├── infra/         # Local PostgreSQL Docker Compose configuration
├── docs/          # Architecture, user stories, planning, and guidelines
└── README.md
```

The 3D visualization belongs to the frontend (`frontend/src/visualization/`), since it runs in the browser and uses the back-end API. See the [System Architecture Description](docs/architecture/SAD.md) and the [documentation index](docs/README.md).

## Prerequisites

- Node.js **20 or later** and npm **10 or later**
- Docker Desktop (or Docker Engine with the Compose plugin) for the local PostgreSQL setup
- Git

## Run locally

The commands below use the npm scripts defined in `backend/package.json` and `frontend/package.json`; there is no `Scripts/` build/run workflow in this project.

### 1. Configure the backend

From the repository root, copy the example environment file:

```powershell
Copy-Item backend/.env.example backend/.env
```

On macOS/Linux, use `cp backend/.env.example backend/.env` instead. Edit `backend/.env` and set a local `PGPASSWORD` and a random `JWT_SECRET` of at least 32 bytes. You can generate a secret with Node.js:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Do not commit `.env` files or real credentials. The example file contains no secrets.

### 2. Install dependencies and start PostgreSQL

Install the back-end dependencies:

```sh
cd backend
npm ci
cd ..
```

From the repository root, start the PostgreSQL service. Docker Compose reads the database settings from `backend/.env`:

```sh
docker compose --env-file backend/.env -f infra/compose.yaml up -d --wait
```

The Compose service stores its data in a named volume and exposes PostgreSQL on localhost using the configured `PGPORT` (5432 by default).

### 3. Check the database and apply migrations

Run these commands from `backend/`:

```sh
npm run db:check
npm run db:migrate
```

`db:check` verifies the PostgreSQL connection. `db:migrate` applies the versioned SQL files under `backend/migrations/`; it is safe to run again after new migrations are added.

### 4. Create the initial Administrator (first setup only)

If the database does not yet have an active Administrator, set `BOOTSTRAP_ADMINISTRATOR_NAME`, `BOOTSTRAP_ADMINISTRATOR_EMAIL`, and `BOOTSTRAP_ADMINISTRATOR_PASSWORD` in `backend/.env`, then run this once from `backend/`:

```sh
npm run users:bootstrap-admin
```

Remove those temporary credential values from `.env` after the Administrator has been created. The command intentionally fails if an active Administrator already exists. The API does not provide a public bootstrap endpoint or a default password. Create Manager accounts through the application and assign the `MANAGER` role while signed in as an Administrator; this uses the audited role-management flow.

### 5. Start the API

From `backend/`, run:

```sh
npm run dev
```

The development API listens at <http://localhost:8080>.

- Health check: <http://localhost:8080/api/v1/health>
- OpenAPI / Swagger UI: <http://localhost:8080/api-docs>

### 6. Run the web client

In a second terminal, install and run the frontend:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. The client uses the API at `http://localhost:8080/api/v1` by default. To customize these values, copy `frontend/.env.example` to `frontend/.env` and update the relevant `VITE_*` values; also set `CORS_ORIGIN` in `backend/.env` to the frontend origin.

## Tests and quality checks

Run back-end checks from `backend/`:

```sh
npm test
npm run lint
npm run format:check
```

The regular tests do not require PostgreSQL. The configured real-database suite can be run with `npm run test:db`, but it requires a **dedicated database whose name ends in `_test`**. Do not point it at your development database. See the [ARC04 PostgreSQL guide](docs/user_stories/arc/ARC04.md) for test database setup and details.

Run front-end checks from `frontend/`:

```sh
npm test
npm run lint
npm run build
```

## Further documentation

- [System architecture and decisions](docs/architecture/SAD.md)
- [Documentation index](docs/README.md)
- [Backend setup and structure](backend/README.md)
- [Frontend setup](frontend/README.md)
- [Local infrastructure](infra/README.md)
- [PostgreSQL setup, migrations, and database testing (ARC04)](docs/user_stories/arc/ARC04.md)
- [Branching and pull-request guidelines](docs/guidelines/branching_strategy.md)

## Team

Developed by 1240914, 1240898, 1240905, and 1241341 — ISEP 2026/2027.
