# BCK03 – Product Category Management: Run & Test Guide

This guide explains how to start the LaPrizza back-end locally and how to manually verify **US BCK03 (Product Category Management)** with Postman. Every request below was executed against a real PostgreSQL database and returned the documented result.

---

## 1. Implementation Review Summary

| Area | Design (`usBCK03.MD`) | Implementation |
| :--- | :--- | :--- | 
| AC 1 – Category catalogue | `product_categories` table + CRUD | Migration `0003`, full CRUD on `/api/v1/categories` |
| AC 2 – Unique id + descriptive name | `CategoryId` (`CAT-00123`), `CategoryName` | DB sequence → `CAT-NNNNN`; name 1–100 chars, trimmed |
| AC 3 – Products associable with category | FK from `products.category_id` | Category side ready; `products` table belongs to BCK05 |
| AC 4 – Searchable | `GET /categories?name=` | `?name=` and `?id=` (case-insensitive "contains") |
| AC 5 – No removal if referenced | `isReferencedByProducts` + `ON DELETE RESTRICT` | App check + DB error `23001/23503` → `409` |
| BR 1 – Case-insensitive unique name | `existsByName` + UNIQUE index | `UNIQUE INDEX ON lower(name)` + service check |
| BR 2 – Writes for MANAGER only | Auth + Role middlewares | `GET` public; `POST/PUT/DELETE` require MANAGER |
| BR 5 – DB constraints → 409 | Repository maps violations | `23505` → 409 (name), `23001/23503` → 409 (FK) |
| Layers / patterns | api → application → domain ← infrastructure | Followed; Repository, DTO, VO, Aggregate Root |
| Tests UT01–UT04, IT01–IT04 | Test plan 4.1 | All implemented and passing |

**Fixes applied during this implementation**

1. `tests/integration/user-authentication-management/postgres.test.js` expected exactly **1** migration; BCK03 added a second one, so the suite failed whenever `RUN_DATABASE_TESTS=1` (which is what the CI workflow sets). It now counts the `.sql` files in `migrations/`.
2. `npm run test:db` now also runs `tests/integration/product-category-management/postgres.test.js`.

---

## 2. How to Run the Application

### 2.1. Prerequisites

- Node.js and npm
- PostgreSQL, either via Docker Desktop or a native installation
- Postman

### 2.2. Configure the environment

From the repository root:

Edit `backend/.env` and set at least:

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
npm run db:migrate        # Applied N migration(s)  (0001_users, 0003_product_categories, ...)
npm run users:bootstrap   # first time only – creates the initial MANAGER
npm run dev               # API listening on http://localhost:8080
```

- Health: http://localhost:8080/api/v1/health
- Swagger UI: http://localhost:8080/api-docs (section **Product categories**)

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

* What to check: `201 Created` on register (or `409` if Ana already exists just log in), then `200 OK` on login. Copy the `accessToken` (Customer token).

### Part B – Create (AC 1, AC 2, BR 1, BR 2)

#### 3. Create a Product Category (Manager)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Headers: `Content-Type` = `application/json`
* Auth: Authorization tab > Type: Bearer Token > Manager token (step 1)
* Body (`raw` > `JSON`):

```json
{
  "name": "Beverages"
}
```

* What to check: `201 Created`. Response:

```json
{
  "id": "CAT-00001",
  "name": "Beverages",
  "createdAt": "2026-10-21T12:46:27.192Z",
  "updatedAt": "2026-10-21T12:46:27.192Z"
}
```

  The `Location` response header is `/api/v1/categories/CAT-00001`. Copy the `id` (`{{categoryId}}`).

#### 4. Create more categories (used in later steps)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: Bearer Token > Manager token
* Body 1:

```json
{
  "name": "Pizzas"
}
```

* Body 2 (note the extra spaces):

```json
{
  "name": "  Soft   Drinks  "
}
```

* What to check: both `201 Created`. The second one is stored as `"Soft Drinks"` (whitespace trimmed and collapsed).

#### 5. Duplicate name, different capitalisation (BR 1)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "name": "BEVERAGES"
}
```

* What to check: `409 Conflict` with `{"error":{"message":"Category name already exists","status":409}}`.

#### 6. Empty / blank name (UT02)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "name": "   "
}
```

* What to check: `400 Bad Request` with message `Category name cannot be empty`.

#### 7. Malformed body (missing or unknown fields)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: Bearer Token > Manager token
* Body (try each one):

```json
{}
```

```json
{
  "name": "Desserts",
  "description": "not allowed"
}
```

* What to check: `400 Bad Request` with message `Invalid request body`. A name longer than 100 characters returns `400` with `Category name must not exceed 100 characters`.

#### 8. Create without a token (BR 2)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: **No Auth**
* Body:

```json
{
  "name": "Desserts"
}
```

* What to check: `401 Unauthorized` with message `No token provided`. With an invalid token (e.g. `Bearer abc`) the message is `Invalid or expired token`.

#### 9. Create with a Customer token (IT02)

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: Bearer Token > **Customer** token (step 2)
* Body:

```json
{
  "name": "Desserts"
}
```

* What to check: `403 Forbidden` with message `Forbidden: insufficient permissions`. Nothing is created.

### Part C – Consult & Search (AC 4, BR 4) – public, no token needed

#### 10. List all categories

* Method: `GET`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: No Auth
* What to check: `200 OK` with an array containing `Beverages`, `Pizzas` and `Soft Drinks`, ordered by creation.

#### 11. Search by name (IT04)

* Method: `GET`
* URL: `http://localhost:8080/api/v1/categories?name=drink`
* What to check: `200 OK` with only `Soft Drinks` (match is case-insensitive and partial). Try also `?name=PIZZ`.

#### 12. Search by identifier

* Method: `GET`
* URL: `http://localhost:8080/api/v1/categories?id=00002`
* What to check: `200 OK` with only the category whose id contains `00002` (`Pizzas` on a fresh database).

#### 13. Search with no matches

* Method: `GET`
* URL: `http://localhost:8080/api/v1/categories?name=zzz`
* What to check: `200 OK` with an empty array `[]`.

#### 14. Get one category by id

* Method: `GET`
* URL: `http://localhost:8080/api/v1/categories/{{categoryId}}` (e.g. `CAT-00001`)
* What to check: `200 OK` with that category. The lowercase form `cat-00001` also works.

#### 15. Get an id that does not exist / is malformed

* Method: `GET`
* URL 1: `http://localhost:8080/api/v1/categories/CAT-99999`
* URL 2: `http://localhost:8080/api/v1/categories/abc`
* What to check: URL 1 → `404 Not Found` (`Category not found`). URL 2 → `400 Bad Request` (`Invalid category id`).

### Part D – Update (rename)

#### 16. Rename a category (Manager)

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/categories/{{categoryId}}`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "name": "Drinks"
}
```

* What to check: `200 OK`. `name` is `Drinks`, `id` and `createdAt` unchanged, `updatedAt` is newer.

#### 17. Change only the capitalisation of its own name

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/categories/{{categoryId}}`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "name": "DRINKS"
}
```

* What to check: `200 OK` (a category does not conflict with itself).

#### 18. Rename to another category's name

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/categories/{{categoryId}}`
* Auth: Bearer Token > Manager token
* Body:

```json
{
  "name": "pizzas"
}
```

* What to check: `409 Conflict` (`Category name already exists`).

#### 19. Rename a non-existent category / as Customer

* Method: `PUT`
* URL 1: `http://localhost:8080/api/v1/categories/CAT-99999` with Manager token
* URL 2: `http://localhost:8080/api/v1/categories/{{categoryId}}` with **Customer** token
* Body:

```json
{
  "name": "Anything"
}
```

* What to check: URL 1 → `404 Not Found`. URL 2 → `403 Forbidden`.

### Part E – Delete (AC 5, BR 3)

#### 20. Delete as Customer

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/categories/<id of Soft Drinks>`
* Auth: Bearer Token > **Customer** token
* What to check: `403 Forbidden`. The category still exists.

#### 21. Delete an unreferenced category (Manager)

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/categories/<id of Soft Drinks>`
* Auth: Bearer Token > Manager token
* What to check: `204 No Content` with an empty body. A subsequent `GET` of the same id returns `404`.

#### 22. Delete the same category again

* Method: `DELETE`
* URL: same as step 21
* Auth: Bearer Token > Manager token
* What to check: `404 Not Found` (`Category not found`).

#### 23. Delete a category referenced by products (IT03 – AC 5)

The `products` table is delivered by BCK05. To demonstrate AC 5 now, simulate it temporarily in PostgreSQL (`psql -h 127.0.0.1 -U laprizza -d laprizza`, or `docker compose --env-file backend/.env -f infra/compose.yaml exec postgres psql -U laprizza -d laprizza`):

```sql
CREATE TABLE products (
  id VARCHAR(32) PRIMARY KEY,
  category_id VARCHAR(32) NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT
);
INSERT INTO products VALUES ('PROD-00001', 'CAT-00002');  -- id of "Pizzas"
```

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/categories/CAT-00002`
* Auth: Bearer Token > Manager token
* What to check: `409 Conflict` with `{"error":{"message":"Product category referenced by existing products cannot be removed","status":409}}`. `GET /categories/CAT-00002` still returns the category.

Clean up afterwards (important — BCK05 will create the real table through a migration):

```sql
DROP TABLE products;
```

### Part F – Extra robustness checks

#### 24. Invalid JSON

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Auth: Bearer Token > Manager token
* Body (`raw` > `JSON`): `{"name":`
* What to check: `400 Bad Request` with message `Invalid JSON body`.

---

## 4. Quick Reference – Expected Status Codes

| Endpoint | Success | Possible errors |
| :--- | :--- | :--- |
| `GET /api/v1/categories[?name=&id=]` | 200 | 400 (repeated/too long filter) |
| `GET /api/v1/categories/:id` | 200 | 400, 404 |
| `POST /api/v1/categories` | 201 + `Location` | 400, 401, 403, 409 |
| `PUT /api/v1/categories/:id` | 200 | 400, 401, 403, 404, 409 |
| `DELETE /api/v1/categories/:id` | 204 | 400, 401, 403, 404, 409 |

All errors follow the shape `{ "error": { "message": "...", "status": <code> } }`.

---

## 6. Automated Tests

From `backend/`:

```bash
# Unit + HTTP integration (no database needed)
npm test

# Only BCK03
npm test -- tests/unit/product-category-management tests/integration/product-category-management/api.test.js

# Real PostgreSQL suites (needs a database whose name ends in _test)
createdb -U laprizza laprizza_test         # or via docker compose exec postgres createdb ...
PGDATABASE=laprizza_test npm run test:db   # PowerShell: $env:PGDATABASE="laprizza_test"; npm run test:db

npm run lint
```

---
