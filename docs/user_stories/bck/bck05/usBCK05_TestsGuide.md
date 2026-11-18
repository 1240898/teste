# BCK05 – Product Management: Run & Test Guide

This guide explains how to start the LaPrizza back-end locally and how to manually verify **US BCK05 (Product Management)** with Postman. Every request below was executed against a real PostgreSQL database and returned the documented result.

---

## 1. Implementation Review Summary

| Area | Design (`usBCK05.md`) | Implementation |
| :--- | :--- | :--- |
| AC 1 – Create and update products | `POST` / `PUT /products` | Migration `0008`, `POST`, `PUT` (full replacement), `GET`, soft `DELETE`, `PATCH …/activate` on `/api/v1/products` |
| AC 2 / BR 1 / BR 2 – Unique id, name, description | `ProductId` (`PROD-00123`), `ProductName`, `ProductDescription` | DB sequence `product_id_seq` → `PROD-NNNNN`; name 1–100 chars, description 1–500 chars, both trimmed; **duplicate names allowed** |
| AC 3 / BR 3 – Product Category | FK `products.category_id` | Exactly one existing category (`404` if unknown), `ON DELETE RESTRICT` |
| AC 4 / BR 4 – Types | `isSellable \|\| isPizzaComponent`; stock control independent | Domain check + `CHECK products_type_check` |
| AC 5 / BR 5 – Pizza Component Type | Component ⇔ exactly one `pizzaComponentTypeId` | Domain check + `CHECK products_component_type_check`, FK to `pizza_component_types` |
| AC 6 / BR 6 – Commercial information | `pricingMode` (`FIXED` / `COMPONENT_BASED`) + `basePrice` (`Money`, EUR) | FIXED requires a price ≥ 0 (zero allowed, max 2 decimals); COMPONENT_BASED has no price and cannot be a pizza component; non-sellable has neither |
| AC 7 / BR 7 – Allergens | `product_allergens` join table | 0..n existing allergens, no duplicates, `ON DELETE RESTRICT` on the allergen side |
| AC 8 / BR 8 – Search & filter | `GET /products?…` | `name` (partial, case-insensitive), `categoryId`, `isSellable`, `isPizzaComponent`, `isStockControlled`, `isActive`, `pizzaComponentTypeId`, `excludeAllergenIds` (Q9) |
| AC 9 / BR 9 – Deactivation | `isActive = false`, never physically deleted | `DELETE` → `204` (soft, idempotent), `PATCH …/activate` → `200`; inactive products stay readable and editable |
| AC 10 / BR 10.1 – Consistent relationships | `IProductImpactChecker` | Removing the component role / changing the component type of a product used by BCK08/BCK10 → `409` |
| BR 11 / D2 / D3 – Stock control (BCK09) | `IStockProvisioning` in the same transaction | Wired through `PendingStockProvisioningAdapter` until BCK09 is merged (see note in Part E) |
| Roles | Manager writes, Manager/Employee read | `POST/PUT/DELETE/PATCH` require MANAGER; `GET` requires MANAGER or EMPLOYEE (Customers get `403`) |
| Layers / patterns | api → application → domain ← infrastructure | Followed; Repository, DTO, VO, Aggregate Root, Row Mapper, Unit of Work, Ports & Adapters |
| Tests UT, IT, DB | Test plan 4.1 | `tests/unit/product-management`, `tests/integration/product-management/{api,postgres}.test.js` |

**Integration changes applied with this implementation**

1. `index.js`, `src/app.js` and `src/modules/index.js` build and register `productModule` (via `createProductManagementModule`).
2. `src/shared/openapi/spec.js` merges the product paths and schemas (Swagger section **Products**).
3. `npm run test:db` now also runs `tests/integration/product-management/postgres.test.js`.
4. The `product_allergens` and `products` tables now exist, so the "referenced" checks of BCK03 (AC 5) and BCK04 (AC 6) can be demonstrated without the temporary SQL tables used in their guides (see Part G).

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
npm run db:migrate        # Applied N migration(s)  (0001, 0003, 0004, 0007, 0008)
npm run users:bootstrap   # first time only – creates the initial MANAGER
npm run dev               # API listening on http://localhost:8080
```

- Health: http://localhost:8080/api/v1/health
- Swagger UI: http://localhost:8080/api-docs (section **Products**)

> If you already migrated the database for BCK03/BCK04, `db:migrate` only applies the missing ones (`0007_pizza_component_types` and/or `0008_products`).
> `users:bootstrap` fails on purpose if an active Manager already exists; that is expected on a second run.

> **About the ids in this guide:** the values below (`CAT-00001`, `PROD-00001`, …) are the ones obtained on a **fresh database**. If you already created categories or products before, use the ids returned by your own responses (or the `Location` header).

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

#### 3. Create and authenticate an Employee (products can be read by staff)

* Register: `POST http://localhost:8080/api/v1/users/register`

```json
{
  "name": "Rui Costa",
  "email": "rui.costa@example.com",
  "password": "EmployeePass123!",
  "marketingConsent": false
}
```

* Copy the `id` from the response (a UUID). Then promote him, with the **Manager** token:
  * Method: `PATCH`
  * URL: `http://localhost:8080/api/v1/users/<id>/roles`
  * Body:

```json
{
  "roles": ["EMPLOYEE"]
}
```

* Finally `POST http://localhost:8080/api/v1/auth/login` with:

```json
{
  "email": "rui.costa@example.com",
  "password": "EmployeePass123!"
}
```

* What to check: `201 Created`, then `200 OK` with `"roles":["EMPLOYEE"]`, then `200 OK` on login. Copy the `accessToken` (Employee token).

> Log in **after** changing the roles: the role is read from the token, so an old token still says `CUSTOMER`.

### Part B – Reference data (BCK03, BCK04, BCK07)

A product needs an existing category, and optionally allergens and a pizza component type. All requests use the **Manager** token.

#### 4. Create the categories

* Method: `POST`
* URL: `http://localhost:8080/api/v1/categories`
* Bodies (one request each): `{"name": "Pizzas"}`, `{"name": "Drinks"}`, `{"name": "Ingredients"}`
* What to check: `201 Created` → `CAT-00001` (Pizzas), `CAT-00002` (Drinks), `CAT-00003` (Ingredients).

> If they already exist from the BCK03 tests you get `409`; run `GET /api/v1/categories` and use the ids returned.

#### 5. Register the allergens

* Method: `POST`
* URL: `http://localhost:8080/api/v1/allergens`
* Bodies (one request each): `{"id": 1, "name": "Gluten"}`, `{"id": 7, "name": "Milk"}`, `{"id": 5, "name": "Peanuts"}`
* What to check: `201 Created` (or `409` if they already exist from the BCK04 tests – that is fine).

#### 6. Check the pizza component types

* Method: `GET`
* URL: `http://localhost:8080/api/v1/pizza-component-types`
* What to check: `200 OK` with the four types seeded by migration `0007`: `type-01` Base Dough, `type-02` Base Sauce, `type-03` Cheese, `type-04` Topping.

### Part C – Create (AC 1–7, BR 1–7)

All requests in this part: Method `POST`, URL `http://localhost:8080/api/v1/products`, Header `Content-Type` = `application/json`, Auth: Bearer Token > **Manager** token, unless stated otherwise.

> Every body must contain **all ten fields** (`name`, `description`, `categoryId`, `isSellable`, `isPizzaComponent`, `isStockControlled`, `pizzaComponentTypeId`, `allergenIds`, `pricingMode`, `basePrice`). Use `null` / `[]` for the ones that do not apply.

#### 7. Create a pizza component with stock control (IT01)

* Body:

```json
{
  "name": "Mozzarella Cheese",
  "description": "Shredded fresh mozzarella cheese for pizza topping",
  "categoryId": "CAT-00003",
  "isSellable": false,
  "isPizzaComponent": true,
  "isStockControlled": true,
  "pizzaComponentTypeId": "type-03",
  "allergenIds": [7],
  "pricingMode": null,
  "basePrice": null
}
```

* What to check: `201 Created`. Response:

```json
{
  "id": "PROD-00001",
  "name": "Mozzarella Cheese",
  "description": "Shredded fresh mozzarella cheese for pizza topping",
  "categoryId": "CAT-00003",
  "isSellable": false,
  "isPizzaComponent": true,
  "isStockControlled": true,
  "isActive": true,
  "pizzaComponentTypeId": "type-03",
  "allergenIds": [7],
  "pricingMode": null,
  "basePrice": null,
  "createdAt": "2026-10-24T10:02:37.210Z",
  "updatedAt": "2026-10-24T10:02:37.210Z"
}
```

  The `Location` response header is `/api/v1/products/PROD-00001`. `isActive` is always `true` on creation and no stock quantity is returned (stock belongs to BCK09).

#### 8. Create a sellable product with a fixed price

* Body:

```json
{
  "name": "Coca-Cola 33cl",
  "description": "Canned soft drink",
  "categoryId": "CAT-00002",
  "isSellable": true,
  "isPizzaComponent": false,
  "isStockControlled": true,
  "pizzaComponentTypeId": null,
  "allergenIds": [],
  "pricingMode": "FIXED",
  "basePrice": 1.5
}
```

* What to check: `201 Created`, `id` = `PROD-00002`, `basePrice` = `1.5` (a JSON number).

#### 9. Create a product that is both sellable and a pizza component (Q6)

* Body (note the extra spaces in the name):

```json
{
  "name": "  Black Olives  ",
  "description": "Pitted black olives",
  "categoryId": "CAT-00003",
  "isSellable": true,
  "isPizzaComponent": true,
  "isStockControlled": false,
  "pizzaComponentTypeId": "type-04",
  "allergenIds": [],
  "pricingMode": "FIXED",
  "basePrice": 2
}
```

* What to check: `201 Created`, `id` = `PROD-00003`, name stored as `"Black Olives"` (trimmed).

#### 10. Create a predefined-pizza product with component-based pricing (BR 6)

* Body:

```json
{
  "name": "Margherita",
  "description": "Tomato sauce, mozzarella and basil",
  "categoryId": "CAT-00001",
  "isSellable": true,
  "isPizzaComponent": false,
  "isStockControlled": false,
  "pizzaComponentTypeId": null,
  "allergenIds": [1, 7],
  "pricingMode": "COMPONENT_BASED",
  "basePrice": null
}
```

* What to check: `201 Created`, `id` = `PROD-00004`, `pricingMode` = `COMPONENT_BASED`, `basePrice` = `null`, `allergenIds` = `[1, 7]`.

#### 11. Create a product with price zero (client clarification)

* Body:

```json
{
  "name": "Tap Water",
  "description": "Free glass of tap water",
  "categoryId": "CAT-00002",
  "isSellable": true,
  "isPizzaComponent": false,
  "isStockControlled": false,
  "pizzaComponentTypeId": null,
  "allergenIds": [],
  "pricingMode": "FIXED",
  "basePrice": 0
}
```

* What to check: `201 Created`, `id` = `PROD-00005`, `basePrice` = `0`.

#### 12. Duplicate name is allowed (UT14)

* Body:

```json
{
  "name": "Mozzarella Cheese",
  "description": "Buffalo mozzarella, premium topping",
  "categoryId": "CAT-00003",
  "isSellable": false,
  "isPizzaComponent": true,
  "isStockControlled": false,
  "pizzaComponentTypeId": "type-03",
  "allergenIds": [7],
  "pricingMode": null,
  "basePrice": null
}
```

* What to check: `201 Created` with a **different** id (`PROD-00006`). Product names are not unique; the `ProductId` is.

#### 13. One more product (used in the search and deactivation steps)

* Body (allergens out of order on purpose):

```json
{
  "name": "Peanut Dessert Pizza",
  "description": "Sweet pizza with peanut butter",
  "categoryId": "CAT-00001",
  "isSellable": true,
  "isPizzaComponent": false,
  "isStockControlled": false,
  "pizzaComponentTypeId": null,
  "allergenIds": [5, 1],
  "pricingMode": "FIXED",
  "basePrice": 7.9
}
```

* What to check: `201 Created`, `id` = `PROD-00007`, `allergenIds` returned sorted: `[1, 5]`.

#### 14. Invalid type combinations (BR 4, BR 5 – UT02, UT03, UT04, IT02)

Using the body of step 7 and changing only the fields shown:

| Change | Expected `400` message |
| :--- | :--- |
| `"isSellable": false, "isPizzaComponent": false, "isStockControlled": false, "pizzaComponentTypeId": null` | `A product must be sellable, a pizza component, or both` |
| `"isSellable": false, "isPizzaComponent": false, "isStockControlled": true, "pizzaComponentTypeId": null` (only stock-controlled) | `A product must be sellable, a pizza component, or both` |
| `"isPizzaComponent": true, "pizzaComponentTypeId": null` | `A pizza component requires a pizza component type` |

And with the body of step 8 (sellable, not a component):

| Change | Expected `400` message |
| :--- | :--- |
| `"pizzaComponentTypeId": "type-04"` | `Only pizza components can have a pizza component type` |

* What to check: `400 Bad Request` with `{"error":{"message":"…","status":400}}`. Nothing is created.

#### 15. Invalid commercial information (BR 6 – UT05, UT06, UT08)

Using the body of step 8 (sellable, `FIXED`, `1.5`) and changing only the fields shown:

| Change | Expected `400` message |
| :--- | :--- |
| `"pricingMode": null, "basePrice": null` | `Sellable products require a pricing mode` |
| `"basePrice": null` (still `FIXED`) | `Fixed-price sellable products require a base price` |
| `"pricingMode": "COMPONENT_BASED", "basePrice": 9.5` | `Component-based products must not have a base price` |
| `"basePrice": -1` | `Price cannot be negative` |
| `"basePrice": 1.999` | `Price must have at most 2 decimal places` |
| `"pricingMode": "DYNAMIC"` | `Pricing mode must be FIXED or COMPONENT_BASED` |

With the body of step 9 (sellable **and** component):

| Change | Expected `400` message |
| :--- | :--- |
| `"pricingMode": "COMPONENT_BASED", "basePrice": null` | `A pizza component cannot have a component-based price` |

With the body of step 7 (component, not sellable):

| Change | Expected `400` message |
| :--- | :--- |
| `"pricingMode": "FIXED", "basePrice": 1` | `Non-sellable products must not have a pricing mode or a selling price` |

#### 16. Invalid name, description, category id or allergens (BR 2, BR 7)

Using the body of step 8 and changing only the field shown:

| Change | Expected `400` message |
| :--- | :--- |
| `"name": "   "` | `Product name cannot be empty` |
| `"description": ""` | `Product description cannot be empty` |
| `"name"` with 101 characters | `Product name must not exceed 100 characters` |
| `"categoryId": "Drinks"` | `Invalid category id` |
| `"allergenIds": [7, 7]` | `Allergens must not be repeated` |
| `"allergenIds": [15]` | `Allergen id must be an integer between 1 and 14` |

#### 17. Malformed body (missing, unknown or wrongly-typed fields)

* Bodies (try each one):

```json
{}
```

```json
{
  "name": "Sprite",
  "description": "Lemon soda",
  "categoryId": "CAT-00002",
  "isSellable": true,
  "pricingMode": "FIXED",
  "basePrice": 1.5
}
```

* And the body of step 8 with **one** of these changes:
  * `"isSellable": "true"` (string instead of boolean)
  * `"basePrice": "1.50"` (string instead of number)
  * an extra `"isActive": false` (not accepted – use `DELETE` / `PATCH …/activate`)
  * an extra `"id": "PROD-00050"` (the id is generated by the database)

* What to check: always `400 Bad Request` with message `Invalid request body`.

#### 18. References that do not exist (UT15)

Using the body of step 8 / step 7 and changing only the field shown:

| Change | Expected |
| :--- | :--- |
| `"categoryId": "CAT-99999"` | `404 Not Found` – `Product category not found` |
| (step 7 body) `"pizzaComponentTypeId": "type-99"` | `404 Not Found` – `Pizza component type not found` |
| `"allergenIds": [2, 3, 7]` (2 and 3 were never registered) | `404 Not Found` – `Allergen not found: 2, 3` |

#### 19. Create without a token / with an invalid token

* Auth: **No Auth**, then Bearer Token `abc`
* Body:

```json
{
  "name": "Sprite",
  "description": "Lemon soda",
  "categoryId": "CAT-00002",
  "isSellable": true,
  "isPizzaComponent": false,
  "isStockControlled": false,
  "pizzaComponentTypeId": null,
  "allergenIds": [],
  "pricingMode": "FIXED",
  "basePrice": 1.5
}
```

* What to check: `401 Unauthorized` with message `No token provided`, and `Invalid or expired token` for `abc` (IT03).

#### 20. Create with a Customer token and with an Employee token

* Auth: Bearer Token > **Customer** token (step 2), then **Employee** token (step 3)
* Body: same as step 19
* What to check: both `403 Forbidden` with message `Forbidden: insufficient permissions` (IT03). Only the Manager can create products.

### Part D – Consult & Search (AC 8, BR 8) – Manager or Employee

All requests: Method `GET`, Auth: Bearer Token > **Employee** token (the Manager token works the same way).

#### 21. List all products

* URL: `http://localhost:8080/api/v1/products`
* What to check: `200 OK` with the 7 products, **ordered by name** (then id): `Black Olives`, `Coca-Cola 33cl`, `Margherita`, `Mozzarella Cheese` (PROD-00001), `Mozzarella Cheese` (PROD-00006), `Peanut Dessert Pizza`, `Tap Water`.

#### 22. Consult as Customer / without a token

* URL 1: `http://localhost:8080/api/v1/products` with the **Customer** token
* URL 2: `http://localhost:8080/api/v1/products/PROD-00001` with the **Customer** token
* URL 3: `http://localhost:8080/api/v1/products` with **No Auth**
* What to check: URL 1 and 2 → `403 Forbidden`. URL 3 → `401 Unauthorized` (`No token provided`).

#### 23. Search by name

* URL: `http://localhost:8080/api/v1/products?name=MOZZ`
* What to check: `200 OK` with both `Mozzarella Cheese` products (PROD-00001 and PROD-00006) – partial and case-insensitive.

#### 24. Filter by category, types, stock control and component type

| URL (`http://localhost:8080/api/v1/products…`) | Expected result (`200 OK`) |
| :--- | :--- |
| `?categoryId=CAT-00002` | `Coca-Cola 33cl`, `Tap Water` |
| `?isSellable=true&isPizzaComponent=true` | only `Black Olives` |
| `?isStockControlled=true` | `Coca-Cola 33cl`, `Mozzarella Cheese` (PROD-00001) |
| `?pizzaComponentTypeId=type-03` | both `Mozzarella Cheese` |

#### 25. Exclude allergens (IT05 – Q9)

| URL (`http://localhost:8080/api/v1/products…`) | Expected result (`200 OK`) |
| :--- | :--- |
| `?excludeAllergenIds=7` (no Milk) | `Black Olives`, `Coca-Cola 33cl`, `Peanut Dessert Pizza`, `Tap Water` |
| `?excludeAllergenIds=1,7` (no Gluten, no Milk) | `Black Olives`, `Coca-Cola 33cl`, `Tap Water` |
| `?categoryId=CAT-00001&isSellable=true&excludeAllergenIds=5` (pizzas without Peanuts) | only `Margherita` |

* What to check: products that contain **any** of the excluded allergens are omitted; filters are combined with AND.

#### 26. Search with no matches

* URL: `http://localhost:8080/api/v1/products?name=zzz`
* What to check: `200 OK` with an empty array `[]`.

#### 27. Invalid filters (IT04)

| URL (`http://localhost:8080/api/v1/products…`) | Expected `400` message |
| :--- | :--- |
| `?isSellable=yes` | `Invalid request query` |
| `?categoryId=Drinks` | `Invalid request query` |
| `?excludeAllergenIds=a` | `Invalid request query` |
| `?price=1` (unknown parameter) | `Invalid request query` |
| `?name=a&name=b` (repeated parameter) | `Invalid request query` |
| `?excludeAllergenIds=15` | `Invalid excludeAllergenIds filter` |

#### 28. Get one product by id

* URL 1: `http://localhost:8080/api/v1/products/PROD-00001`
* URL 2: `http://localhost:8080/api/v1/products/prod-00001`
* What to check: both `200 OK` with `Mozzarella Cheese` (the id is case-insensitive).

#### 29. Get an id that does not exist / is malformed (IT06, IT04)

* URL 1: `http://localhost:8080/api/v1/products/PROD-99999`
* URL 2: `http://localhost:8080/api/v1/products/abc`
* What to check: URL 1 → `404 Not Found` (`Product not found`). URL 2 → `400 Bad Request` (`Invalid request params`).

### Part E – Update (AC 1, AC 10, BR 11)

`PUT` uses **full-replacement** semantics: send the complete body (same ten fields as create). Auth: Bearer Token > **Manager** token.

#### 30. Update name, description and price

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/products/PROD-00002`
* Body:

```json
{
  "name": "Coca-Cola Zero 33cl",
  "description": "Canned soft drink, no sugar",
  "categoryId": "CAT-00002",
  "isSellable": true,
  "isPizzaComponent": false,
  "isStockControlled": true,
  "pizzaComponentTypeId": null,
  "allergenIds": [],
  "pricingMode": "FIXED",
  "basePrice": 1.8
}
```

* What to check: `200 OK`. New `name`, `description` and `basePrice`; `id` and `createdAt` unchanged; `updatedAt` is newer.

#### 31. Enable and disable stock control (UT12 – D2/D3)

* Enable (`false → true`): `PUT http://localhost:8080/api/v1/products/PROD-00003` with the body of step 9 but `"name": "Black Olives"`, `"isStockControlled": true` and `"basePrice": 2.25`.
* Disable (`true → false`): `PUT http://localhost:8080/api/v1/products/PROD-00002` with the body of step 30 but `"isStockControlled": false`.
* What to check: both `200 OK` with the new `isStockControlled` value. `GET /api/v1/products/PROD-00002` confirms `"isStockControlled": false`.

> **BCK09 note:** until BCK09 (Stock Information Management) is merged, `IStockProvisioning` is implemented by `PendingStockProvisioningAdapter`. While the `stock_information` table does not exist, the stock calls are no-ops and only the product flag is stored. If the table exists but BCK09's adapter has not been wired in `index.js`, the request fails with `500` and the transaction is rolled back (it never deletes stock data). Once BCK09 is wired, check `GET /api/v1/products/PROD-00003/stock` → `availableUnits: 0`.

#### 32. Change the types of a product (not referenced elsewhere)

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/products/PROD-00006`
* Body (the component becomes sellable too):

```json
{
  "name": "Mozzarella Cheese",
  "description": "Buffalo mozzarella, premium topping",
  "categoryId": "CAT-00003",
  "isSellable": true,
  "isPizzaComponent": true,
  "isStockControlled": false,
  "pizzaComponentTypeId": "type-03",
  "allergenIds": [7],
  "pricingMode": "FIXED",
  "basePrice": 3
}
```

* What to check: `200 OK` with `isSellable: true`, `pricingMode: "FIXED"`, `basePrice: 3`.

#### 33. Invalid updates

* Method: `PUT`, URL: `http://localhost:8080/api/v1/products/PROD-00002`, Manager token
* Body 1 – step 30 body with `"isSellable": false, "pricingMode": null, "basePrice": null` (only stock-controlled) → `400` – `A product must be sellable, a pizza component, or both`.
* Body 2 – partial body `{"basePrice": 2}` → `400` – `Invalid request body` (`PUT` is full replacement).
* Body 3 – step 30 body plus `"isActive": false` → `400` – `Invalid request body`.
* Body 4 – step 30 body with `"categoryId": "CAT-99999"` → `404` – `Product category not found`.

#### 34. Update a non-existent / malformed id, or with the wrong role

* Body: step 30 body
* URL 1: `http://localhost:8080/api/v1/products/PROD-99999` (Manager) → `404 Not Found` (`Product not found`)
* URL 2: `http://localhost:8080/api/v1/products/abc` (Manager) → `400 Bad Request` (`Invalid request params`)
* URL 3: `http://localhost:8080/api/v1/products/PROD-00002` with **Customer** token → `403 Forbidden`
* URL 4: same with **Employee** token → `403 Forbidden`

#### 35. Change that would break a BCK08/BCK10 reference (UT16 – BR 10.1)

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/products/PROD-00001`
* Auth: Bearer Token > Manager token
* Body 1 – remove the pizza-component role:

```json
{
  "name": "Mozzarella Cheese",
  "description": "Shredded fresh mozzarella cheese for pizza topping",
  "categoryId": "CAT-00003",
  "isSellable": true,
  "isPizzaComponent": false,
  "isStockControlled": true,
  "pizzaComponentTypeId": null,
  "allergenIds": [7],
  "pricingMode": "FIXED",
  "basePrice": 2.5
}
```

* Body 2 – step 7 body with `"pizzaComponentTypeId": "type-04"` (change the component type).
* Body 3 – step 7 body with `"description": "Fior di latte mozzarella, shredded"` (types unchanged).
* What to check:
  * Body 1 and Body 2 → `409 Conflict` with `{"error":{"message":"Product is used as a pizza component by existing configurations or predefined pizzas","status":409}}`.
  * Body 3 → `200 OK` (changes that keep the reference valid are allowed).
  * `DELETE http://localhost:8080/api/v1/products/PROD-00001` → `204` (deactivation is allowed and keeps the reference), then `PATCH http://localhost:8080/api/v1/products/PROD-00001/activate` → `200` with `isActive: true`.


### Part F – Deactivate & Reactivate (AC 9, BR 9, BR 12)

#### 36. Deactivate as Customer / Employee

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/products/PROD-00007`
* Auth: **Customer** token, then **Employee** token
* What to check: both `403 Forbidden`. The product stays active.

#### 37. Deactivate a product (Manager)

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/products/PROD-00007`
* Auth: Bearer Token > Manager token
* What to check: `204 No Content` with an empty body. `GET /api/v1/products/PROD-00007` still returns `200 OK` with `"isActive": false` and the same `allergenIds` `[1, 5]` – the product is **not** physically deleted.

#### 38. Deactivate the same product again

* Method: `DELETE`
* URL: same as step 37
* What to check: `204 No Content` again (the operation is idempotent).

#### 39. Filter by active state

* Method: `GET`, Employee token
* URL 1: `http://localhost:8080/api/v1/products?isActive=false` → `200 OK` with only `Peanut Dessert Pizza`.
* URL 2: `http://localhost:8080/api/v1/products?isActive=true&name=pizza` → `200 OK` with `[]`.

#### 40. Edit an inactive product

* Method: `PUT`
* URL: `http://localhost:8080/api/v1/products/PROD-00007`
* Auth: Manager token
* Body: step 13 body with `"basePrice": 8.5`
* What to check: `200 OK`, `basePrice: 8.5`, `isActive` **stays** `false` (deactivated products remain editable; `PUT` never changes the active state).

#### 41. Deactivate a non-existent / malformed id

* Method: `DELETE`, Manager token
* URL 1: `http://localhost:8080/api/v1/products/PROD-99999` → `404 Not Found` (`Product not found`)
* URL 2: `http://localhost:8080/api/v1/products/abc` → `400 Bad Request` (`Invalid request params`)

#### 42. Reactivate a product

* Method: `PATCH`
* URL: `http://localhost:8080/api/v1/products/PROD-00007/activate`
* Auth: **Customer** token first, then **Manager** token
* What to check: Customer → `403 Forbidden`. Manager → `200 OK` with the full product and `"isActive": true`. Repeating the request → `200 OK` (idempotent). `PATCH …/PROD-99999/activate` → `404 Not Found`.

### Part G – Cross-story checks (BCK03 AC 5, BCK04 AC 6)

Now that real products reference categories and allergens, the "cannot remove if referenced" rules of the previous stories can be verified directly. Auth: Manager token.

#### 43. Delete an allergen used by products

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/allergens/7` (Milk – used by Mozzarella and Margherita)
* What to check: `409 Conflict` with `{"error":{"message":"Allergen referenced by existing business information cannot be removed","status":409}}`.

#### 44. Delete a category used by products

* Method: `DELETE`
* URL: `http://localhost:8080/api/v1/categories/CAT-00002` (Drinks)
* What to check: `409 Conflict` with `{"error":{"message":"Product category referenced by existing products cannot be removed","status":409}}`.

> Deactivated products still count as references (step 37 keeps the allergen links), so the category/allergen of an inactive product cannot be removed either.

### Part H – Extra robustness checks

#### 45. Invalid JSON

* Method: `POST`
* URL: `http://localhost:8080/api/v1/products`
* Auth: Bearer Token > Manager token
* Body (`raw` > `JSON`): `{"name":`
* What to check: `400 Bad Request` with message `Invalid JSON body`.

---

## 4. Quick Reference – Expected Status Codes

| Endpoint | Roles | Success | Possible errors |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/products[?name=&categoryId=&isSellable=&isPizzaComponent=&isStockControlled=&isActive=&pizzaComponentTypeId=&excludeAllergenIds=]` | Manager, Employee | 200 | 400 (invalid/unknown/repeated filter), 401, 403 |
| `GET /api/v1/products/:id` | Manager, Employee | 200 | 400, 401, 403, 404 |
| `POST /api/v1/products` | Manager | 201 + `Location` | 400, 401, 403, 404 (category / component type / allergen) |
| `PUT /api/v1/products/:id` | Manager | 200 | 400, 401, 403, 404, 409 (BR 10.1) |
| `DELETE /api/v1/products/:id` (soft) | Manager | 204 | 400, 401, 403, 404 |
| `PATCH /api/v1/products/:id/activate` | Manager | 200 | 400, 401, 403, 404 |

All errors follow the shape `{ "error": { "message": "...", "status": <code> } }`.

---

## 5. Automated Tests

From `backend/`:

```bash
# Unit + HTTP integration (no database needed)
npm test

# Only BCK05
npm test -- tests/unit/product-management tests/integration/product-management/api.test.js

# Real PostgreSQL suites (needs a database whose name ends in _test)
createdb -U laprizza laprizza_test         # or via docker compose exec postgres createdb ...
PGDATABASE=laprizza_test npm run test:db   # PowerShell: $env:PGDATABASE="laprizza_test"; npm run test:db


```

---
