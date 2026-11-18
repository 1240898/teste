# BCK04 – Allergen Management: Run & Test Guide

This guide explains how to start the LaPrizza back-end locally and how to manually verify **US BCK04 (Allergen Management)** with Postman. Every request below was executed against a real PostgreSQL database and returned the documented result.

---

## 1. Implementation Review Summary

| Area | Design (`usBCK04.md`) | Implementation |
| :--- | :--- | :--- |
| AC 1 – Allergen catalogue | `allergens` table + CRUD | Migration `0004`, full CRUD on `/api/v1/allergens` |
| AC 2 – Unique id + descriptive name | `AllergenId` (1–14, EU 1169/2011), `AllergenName` | Id supplied by the Manager, `CHECK (id BETWEEN 1 AND 14)`; name 1–100 chars, trimmed |
| AC 3 / AC 4 – Products associable with allergens | `product_allergens` join table with `ON DELETE RESTRICT` | Allergen side ready; `product_allergens` belongs to BCK05 |
| AC 5 – Searchable | `GET /allergens?name=&id=` | `?name=` (case-insensitive "contains") and `?id=` (exact) |
| AC 6 – No removal if referenced | `isReferenced` + `ON DELETE RESTRICT` | App check over existing referencing tables + DB error `23001/23503` → `409` |
| BR 1 – Unique id and case-insensitive unique name | `findById`, `existsByName` + PK / UNIQUE index | Service checks + `allergens_pkey` + `UNIQUE INDEX ON lower(name)` |
| BR 2 – Writes for MANAGER only | Auth + Role middlewares | `GET` public; `POST/PUT/DELETE` require MANAGER |
| BR 5 – DB constraints → 409 | Repository maps violations | `23505` → 409 (name or id), `23001/23503` → 409 (FK) |
| Layers / patterns | api → application → domain ← infrastructure | Followed; Repository, DTO, VO, Aggregate Root, Row Mapper |
| Tests UT01–UT05, IT01–IT04, DB01–DB03 | Test plan 4.1 | All implemented and passing |

**Integration changes applied with this implementation**

1. `src/modules/index.js`, `src/app.js` and `index.js` now receive and register `allergenModule` (built by `createAllergenModule`).
2. `src/shared/openapi/spec.js` merges the allergen paths and schemas (Swagger section **Allergens**).
3. `npm run test:db` now also runs `tests/integration/allergen-management/postgres.test.js`.

---

## 2. How to Run the Application

### 2.1. Prerequisites

- Node.js and npm
- PostgreSQL, either via Docker Desktop or a native installation
- Postman

### 2.2. Configure the environment

From the repository root, copy `backend/.env.example` to `backend/.env` (if you have not done so yet) and set at least:

```dotenv
PGPASSWORD=choose-a-local-password
JWT_SECRET=<random value with at least 32 bytes>
BOOTSTRAP_MANAGER_NAME="Manager Principal"
BOOTSTRAP_MANAGER_EMAIL="manager@laprizza.com"
BOOTSTRAP_MANAGER_PASSWORD="AdminPassword123!"
```

### 2.3. Start PostgreSQL

**Option A – Docker (from the repository root):**

```bash
docker compose --env-file backend/.env -f infra/compose.yaml up -d --wait
```

**Option B – Native PostgreSQL:** create the role and database matching `.env`:

```sql
CREATE USER laprizza WITH PASSWORD 'choose-a-local-password';
CREATE DATABASE laprizza OWNER laprizza;
```

### 2.4. Install, migrate, create the Manager and start the API

```bash
cd backend
npm install
npm run db:check          # PostgreSQL connectivity: OK
npm run db:migrate        # Applied N migration(s)  (0001_users, 0004_allergens)
npm run users:bootstrap   # first time only – creates the initial MANAGER
npm run dev               # API listening on http://localhost:8080
```

- Health: http://localhost:8080/api/v1/health
- Swagger UI: http://localhost:8080/api-docs (section **Allergens**)

> If you already migrated the database for BCK03, `db:migrate` only applies `0004_allergens` (`Applied 1 migration(s)`).
> `users:bootstrap` fails on purpose if an active Manager already exists; that is expected on a second run.

---

## 3. Manual Test Scenarios (Postman)

### Part A – Obtain tokens

#### 1. Authenticate as Manager

* Method: `POST`
* URL: `http://localhost:8080/api/v1/auth/login`
* Headers: `Content-Type` = `application/json`
* Body (`raw` > `JSON`):

```json
{
  "email": "manager@laprizza.com",
  "password": "AdminPassword123!"
}
```

* What to check: `200 OK`. Copy the `accessToken` (Manager token).

#### 2. Register and authenticate a Customer (used for the role checks)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/users/register`
* Body (`raw` > `JSON`):

```json
{
  "name": "Ana Silva",
  "email": "ana.silva@example.com",
  "password": "CustomerPass123!",
  "marketingConsent": true
}
```

* Then `POST http://localhost:8080/api/v1/auth/login` with:

```json
{
  "email": "ana.silva@example.com",
  "password": "CustomerPass123!"
}
```

* What to check: `201 Created` on register (or `409` if Ana already exists – just log in), then `200 OK` on login. Copy the `accessToken` (Customer token).

### Part B – Register (AC 1, AC 2, BR 1, BR 2)

#### 3. Register an allergen (Manager – IT01)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Headers: `Content-Type` = `application/json`
* Auth: Authorization tab > Type: Bearer Token > Manager token (step 1)
* Body (`raw` > `JSON`):

```json
{
  "id": 1,
  "name": "Gluten"
}
```

* What to check: `201 Created`. Response:

```json
{
  "id": 1,
  "name": "Gluten",
  "createdAt": "2026-10-22T09:11:47.147Z",
  "updatedAt": "2026-10-22T09:11:47.147Z"
}
```

  The `Location` response header is `/api/v1/allergens/1`. Note that `id` is a **number**.

#### 4. Register more allergens (used in later steps)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > Manager token
* Body 1:

```json
{
  "id": 7,
  "name": "Milk"
}
```

* Body 2 (note the extra spaces):

```json
{
  "id": 5,
  "name": "  Peanuts  "
}
```

* Body 3 (note the extra inner spaces):

```json
{
  "id": 8,
  "name": "Tree   Nuts"
}
```

* What to check: all `201 Created`. Body 2 is stored as `"Peanuts"` and body 3 as `"Tree Nuts"` (whitespace trimmed and collapsed).

#### 5. Duplicate name, different capitalisation (BR 1)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "id": 2,
  "name": "GLUTEN"
}
```

* What to check: `409 Conflict` with `{"error":{"message":"Allergen name already exists","status":409}}`.

#### 6. Duplicate identifier (BR 1)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "id": 1,
  "name": "Wheat"
}
```

* What to check: `409 Conflict` with `{"error":{"message":"Allergen id already exists","status":409}}`.

#### 7. Empty / blank name (UT02)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "id": 3,
  "name": "   "
}
```

* What to check: `400 Bad Request` with message `Allergen name cannot be empty`.

#### 8. Identifier outside the EU list (UT02)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > Manager token
* Body (try both):

```json
{
  "id": 15,
  "name": "Kiwi"
}
```

```json
{
  "id": 0,
  "name": "Kiwi"
}
```

* What to check: `400 Bad Request` with message `Allergen id must be an integer between 1 and 14`.

#### 9. Malformed body (missing, unknown or wrongly-typed fields)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > Manager token
* Body (try each one):

```json
{}
```

```json
{
  "id": "3",
  "name": "Eggs"
}
```

```json
{
  "id": 3,
  "name": "Eggs",
  "description": "not allowed"
}
```

* What to check: `400 Bad Request` with message `Invalid request body` (the id must be a JSON number, not a string). A name longer than 100 characters returns `400` with `Allergen name must not exceed 100 characters`.

#### 10. Register without a token (BR 2)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: **No Auth**
* Body:

```json
{
  "id": 3,
  "name": "Eggs"
}
```

* What to check: `401 Unauthorized` with message `No token provided`. With an invalid token (e.g. `Bearer abc`) the message is `Invalid or expired token`.

#### 11. Register with a Customer token (IT02)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > **Customer** token (step 2)
* Body:

```json
{
  "id": 3,
  "name": "Eggs"
}
```

* What to check: `403 Forbidden` with message `Forbidden: insufficient permissions`. Nothing is created.

### Part C – Consult & Search (AC 5, BR 4) – public, no token needed

#### 12. List all allergens

* Method: `GET`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: No Auth
* What to check: `200 OK` with an array containing `Gluten` (1), `Peanuts` (5), `Milk` (7) and `Tree Nuts` (8), **ordered by id**.

#### 13. Search by name (IT04)

* Method: `GET`
* URL: `http://localhost:8080/api/v1/allergens?name=nuts`
* What to check: `200 OK` with `Peanuts` and `Tree Nuts` (match is case-insensitive and partial). 
* Another: `?name=GLU` → only `Gluten`.

#### 14. Search by identifier

* Method: `GET`
* URL 1: `http://localhost:8080/api/v1/allergens?id=7`
* URL 2: `http://localhost:8080/api/v1/allergens?id=20`
* URL 3: `http://localhost:8080/api/v1/allergens?name=a&name=b`
* What to check: URL 1 → `200 OK` with only `Milk` (exact match). URL 2 → `400 Bad Request` (`Invalid id filter`). URL 3 → `400 Bad Request` (`Invalid name filter`, repeated parameter).

#### 15. Search with no matches

* Method: `GET`
* URL: `http://localhost:8080/api/v1/allergens?name=zzz`
* What to check: `200 OK` with an empty array `[]`.

#### 16. Get one allergen by id

* Method: `GET`
* URL: `http://localhost:8080/api/v1/allergens/1`
* What to check: `200 OK` with `Gluten`.

#### 17. Get an id that does not exist / is invalid

* Method: `GET`
* URL 1: `http://localhost:8080/api/v1/allergens/4`
* URL 2: `http://localhost:8080/api/v1/allergens/15`
* URL 3: `http://localhost:8080/api/v1/allergens/abc`
* What to check: URL 1 → `404 Not Found` (`Allergen not found`). URL 2 and URL 3 → `400 Bad Request` (`Allergen id must be an integer between 1 and 14`).

### Part D – Update (rename)

#### 18. Rename an allergen (Manager)

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/allergens/7`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "name": "Lactose"
}
```

* What to check: `200 OK`. `name` is `Lactose`, `id` and `createdAt` unchanged, `updatedAt` is newer.

#### 19. Change only the capitalisation of its own name

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/allergens/7`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "name": "LACTOSE"
}
```

* What to check: `200 OK` (an allergen does not conflict with itself).

#### 20. Rename to another allergen's name / try to change the id

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/allergens/7`
* Auth: Bearer Token > Manager token
* Body 1:

```json
{
  "name": "gluten"
}
```

* Body 2:

```json
{
  "id": 9,
  "name": "Celery"
}
```

* What to check: Body 1 → `409 Conflict` (`Allergen name already exists`). Body 2 → `400 Bad Request` (`Invalid request body`): the identifier is immutable.

#### 21. Rename a non-existent allergen / as Customer

* Method: `PUT`
* URL 1: `http://localhost:8080/api/v1/allergens/4` with Manager token
* URL 2: `http://localhost:8080/api/v1/allergens/7` with **Customer** token
* Body:

```json
{
  "name": "Fish"
}
```

* What to check: URL 1 → `404 Not Found`. URL 2 → `403 Forbidden`.

### Part E – Delete (AC 6, BR 3)

#### 22. Delete as Customer

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/allergens/8`
* Auth: Bearer Token > **Customer** token
* What to check: `403 Forbidden`. The allergen still exists.

#### 23. Delete an unreferenced allergen (Manager)

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/allergens/8`
* Auth: Bearer Token > Manager token
* What to check: `204 No Content` with an empty body. A subsequent `GET /api/v1/allergens/8` returns `404`.

#### 24. Delete the same allergen again

* Method: `DELETE`
* URL: same as step 23
* Auth: Bearer Token > Manager token
* What to check: `404 Not Found` (`Allergen not found`).

#### 25. Delete an allergen referenced by products (IT03 – AC 6)

The `product_allergens` table is delivered by BCK05.

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/allergens/1`
* Auth: Bearer Token > Manager token
* What to check: `409 Conflict` with `{"error":{"message":"Allergen referenced by existing business information cannot be removed","status":409}}`. `GET /api/v1/allergens/1` still returns the allergen.

### Part F – Extra robustness checks

#### 26. Invalid JSON

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Auth: Bearer Token > Manager token
* Body (`raw` > `JSON`): `{"id":`
* What to check: `400 Bad Request` with message `Invalid JSON body`.

---

## 4. Quick Reference – Expected Status Codes

| Endpoint | Success | Possible errors |
| :--- | :--- | :--- |
| `GET /api/v1/allergens[?name=&id=]` | 200 | 400 (repeated/too long name filter, id filter outside 1..14) |
| `GET /api/v1/allergens/:id` | 200 | 400, 404 |
| `POST /api/v1/allergens` | 201 + `Location` | 400, 401, 403, 409 |
| `PUT /api/v1/allergens/:id` | 200 | 400, 401, 403, 404, 409 |
| `DELETE /api/v1/allergens/:id` | 204 | 400, 401, 403, 404, 409 |

All errors follow the shape `{ "error": { "message": "...", "status": <code> } }`.

---

## 5. Automated Tests

From `backend/`:

```bash
# Unit + HTTP integration (no database needed)
npm test

# Only BCK04
npm test -- tests/unit/allergen-management tests/integration/allergen-management/api.test.js

# Real PostgreSQL suites (needs a database whose name ends in _test)
createdb -U laprizza laprizza_test         # or via docker compose exec postgres createdb ...
PGDATABASE=laprizza_test npm run test:db   # PowerShell: $env:PGDATABASE="laprizza_test"; npm run test:db

npm run lint
```

---
