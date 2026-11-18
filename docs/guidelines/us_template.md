# US BCK<XX> – <User Story Title>

## 1. Context & Scope

- **User Story ID:** BCK<XX>
- **Sprint:** Sprint 1
- **Area:** Back-End (BCK)
- **Responsible:** <Team Member Name> (<Mechanographic Number>)
- **Related Requirements / Stories:**
  - System Specification: *PART II – System Specification, Section <X.Y>*
  - Architectural Stories: [ARC01 (Domain Modelling)](../../architecture/domainmodel.puml), [ARC02 (System Architecture)](../../architecture/SAD.md), [ARC03 (REST API)](../../architecture/SAD.md), [ARC04 (Persistence)](../../architecture/SAD.md), [ARC05 (Automated Testing)](../../architecture/SAD.md)
  - Dependencies: *<e.g., BCK05 (Product Management), BCK07 (Pizza Component Type Management)>*

---

## 2. Requirements & Analysis

### 2.1. User Story Description
> **As a** <Role, e.g., LaPrizza Manager / Customer>,  
> **I want** <action / feature>,  
> **so that** <business value / goal>.

### 2.2. Acceptance Criteria (from Sprint 1 Specification)

- [ ] **AC 1:** <e.g., Each entity must have a unique identifier and descriptive name.>
- [ ] **AC 2:** <e.g., Data used to identify or configure the entity must be appropriately validated.>
- [ ] **AC 3:** <e.g., Entities referenced by existing business information must not be removed in a manner that compromises consistency.>
- [ ] **AC 4:** <e.g., Search and filtering by relevant attributes must be supported.>

### 2.3. Client Clarifications & Questions

> **Question:** <e.g., Can a product exist without an assigned category or role?>  
> **Answer:** <e.g., All products must have at least one type: Sellable, Pizza Component, or both. (Client Clarifications, Q6)>

### 2.4. Business Rules & Invariants
- **BR 1 (Identification):** <e.g., Identifier must be unique and immutable (UUID or business code).>
- **BR 2 (Format / Validation):** <e.g., Name cannot be null, blank, or exceed 100 characters.>
- **BR 3 (Cardinality / Logic):** <e.g., Min quantity >= 0, Max quantity >= Min quantity (or unbounded).>
- **BR 4 (Referential Integrity):** <e.g., Prevent deletion if referenced in active orders or configurations.>

### 2.5. Domain Model Excerpt
Relevant domain concepts and aggregates directly involved in this User Story:

![Domain Model Excerpt](path)

---

## 3. Design

### 3.1. Architecture & C4 Alignment

This User Story operates within the established **C4 Model** of the system:
- **C4 Level 1 (System Context):** The actor (<Role>) interacts with the *LaPrizza Information System* via HTTPS ([System Architecture and Design](../../architecture/SAD.md)).
- **C4 Level 2 (Containers):** The request originates from the *UI* and targets the *Back-End API*, which persists state in the *Database*([System Architecture and Desig](./architecture/SAD.md)).
- **C4 Level 3 (Component Diagram):** As defined in the global Back-End architecture ([System Architecture and Desig](./architecture/SAD.md)).
---

### 3.2. Class Diagram (CD)
Structural design of the classes participating in this User Story:

![Class Diagram Example](path)

---

### 3.3. Sequence Diagram (SD)
Dynamic interaction view tracing the message flow across the classes modeled above for the principal scenario:

![Sequence Diagram Example](path)

### 3.4. REST API Specification (ARC03)

| Method | Endpoint | Description | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/<resources>` | Creates a new `<resource>` | Manager |
| `GET` | `/api/v1/<resources>` | Lists / searches `<resources>` | Manager / Staff |
| `GET` | `/api/v1/<resources>/:id` | Gets details of a `<resource>` | Manager / Staff |
| `PUT` | `/api/v1/<resources>/:id` | Updates an existing `<resource>` | Manager |
| `DELETE` | `/api/v1/<resources>/:id` | Deactivates / removes `<resource>` | Manager |

#### Request & Response Schemas

- **Success Response (`POST /api/v1/<resources>`):**
  - **Status Code:** `201 Created`
  - **Payload:**
    ```json
    {
      "id": "e4b2d3c1-0000-4000-8000-000000000001",
      "name": "Example Name",
      "createdAt": "2026-10-08T18:00:00.000Z"
    }
    ```

- **Error Responses:**
  - `400 Bad Request`: Input validation failed (missing required field, illegal format).
  - `404 Not Found`: Entity not found.
  - `409 Conflict`: Business identifier conflict or referential integrity violation.
  - Standard error format:
    ```json
    {
      "error": {
        "message": "Descriptive error message",
        "status": 400
      }
    }
    ```

### 3.5. Persistence & Data Integrity (ARC04)

- **Persistence Entity / Table Name:** `<table_or_collection_name>`
- **Fields & Constraints:**
  - `id`: Primary Key (UUID / VARCHAR), NOT NULL.
  - `<identifying_field>`: UNIQUE, NOT NULL.
  - `<foreign_key>`: References `<parent_table>(id)`, ON DELETE RESTRICT (prevent inconsistent removal per AC).
  - `is_active`: BOOLEAN DEFAULT TRUE (for soft-delete / historical preservation).
- **Integrity Rules:**
  - Database uniqueness constraints enforce business identifier uniqueness even under concurrent requests.
  - Foreign key constraints prevent orphaned records.

### 3.6. Applied Patterns & Architecture Principles
- **Clean / Layered Architecture:** Domain layer has zero external dependencies; Presentation (Express) depends on Application; Application coordinates Domain and Infrastructure.
- **Aggregate Root (DDD):** All state changes to this boundary pass through `<AggregateRoot>`.
- **Value Objects:** Encapsulate validation and immutability (e.g., [`Money`](../../architecture/domainmodel.puml#L124)).
- **Repository Pattern:** Decouples domain logic from database persistence mechanism.
- **DTO Pattern:** Isolates API request/response structures from internal domain representations.

---

## 4. Tests (ARC05)

### 4.1. Test Plan & Scenarios

| Test ID | Level | Scenario / Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **UT01** | Unit (Domain) | Create entity with valid properties | Success; entity instantiated with valid state |
| **UT02** | Unit (Domain) | Create entity with missing / blank name | Throws domain validation error |
| **UT03** | Unit (Domain) | Enforce boundary / cardinality rule | Throws invariant violation error |
| **UT04** | Unit (Service) | Prevent duplicate creation when identifier already exists | Throws duplicate / conflict exception |
| **IT01** | Integration (API) | `POST /api/v1/<resource>` with valid JSON body | HTTP `201 Created` + persisted entity in response |
| **IT02** | Integration (API) | `POST /api/v1/<resource>` with invalid payload | HTTP `400 Bad Request` + error description |
| **IT03** | Integration (API) | `GET /api/v1/<resource>/:id` for non-existent ID | HTTP `404 Not Found` |
| **IT04** | Integration (API) | `DELETE` entity referenced by active business entity | HTTP `409 Conflict` (preserves referential integrity) |

### 4.2. Sample Test Implementations

#### Unit Test Example (Domain Invariant)
```javascript
describe('<Entity> Domain Invariants', () => {
  it('should successfully create an entity with valid attributes', () => {
    const entity = new <Entity>({ name: 'Valid Name', ... });
    expect(entity.name).toBe('Valid Name');
  });

  it('should reject invalid or empty names', () => {
    expect(() => new <Entity>({ name: '' })).toThrow(/Name cannot be empty/i);
  });
});
```

#### Integration Test Example (HTTP Endpoint via Supertest)
```javascript
const request = require('supertest');
const app = require('../../src/app');

describe('POST /api/v1/<resources>', () => {
  it('returns 201 when payload is valid', async () => {
    const response = await request(app)
      .post('/api/v1/<resources>')
      .send({ name: 'Valid Name' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });

  it('returns 400 when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/v1/<resources>')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});
```

---

## 5. Implementation

### 5.1. File Structure
List the files created or updated for this User Story:
```text
backend/
├── src/
│   ├── api/
│   │   ├── routes/<feature>Routes.js
│   │   └── controllers/<feature>Controller.js
│   ├── application/
│   │   ├── dtos/<feature>Dto.js
│   │   └── services/<feature>Service.js
│   ├── domain/
│   │   ├── model/<entity>.js
│   │   └── repositories/I<feature>Repository.js
│   └── infrastructure/
│       └── persistence/<feature>Repository.js
└── tests/
    ├── unit/<feature>.test.js
    └── integration/<feature>Api.test.js
```

### 5.2. Core Implementation Highlights
Document key code sections that enforce business rules, database transactions, or error handling.

---

## 6. Integration, Verification & Demonstration

### 6.1. Running the Automated Tests
```bash
cd backend
npm test -- tests/unit/<feature>.test.js tests/integration/<feature>Api.test.js
```

### 6.2. Manual Verification & OpenAPI Contract
1. Start the backend: `npm run dev`
2. Open Swagger UI at `http://localhost:8080/api-docs`
3. Verify that the `<resource>` endpoints are documented and can be executed via the interactive Swagger UI.

---

## 7. Observations, Dependencies & Limitations

- **Dependencies:** Document prerequisites and downstream user stories that consume this feature.
- **Known Limitations:** Any mock or simplified assumptions in Sprint 1 (e.g., in-memory or prototype persistence before production database setup).
- **Future Sprint Considerations:** Integration with 3D client or AI scheduling module in Sprint 2 / 3.
