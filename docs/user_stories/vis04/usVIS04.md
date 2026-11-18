# US WEB01 – SPA Setup and Integration

## 1. Context & Scope

*   **User Story ID:** WEB01
*   **Sprint:** Sprint 2
*   **Area:** Front-end Web Application (WEB)
*   **Responsible:** All Members – Sofia Carvalho (1240898), Francisco Sá (1241341), Leonor de Moura (1240914), Mariana Moreira (1240905)
*   **Related Requirements / Stories:**
    *   Sprint 2 User Stories, *PART IV – Sprint 2 – User Stories*, WEB01, and *IV.2.3 Sprint 2 Deliverable* (SPA providing access to the Sprint 1 business functionality; business identifiers and data representations consistent across components; reproducible solution).
    *   System Specification: *PART II – System Specification*, section II.3.2 Web Application (main interface to the information system) and II.3.6 Integration and General System Concerns (one integrated system, documented interfaces, security as a cross-cutting concern).
    *   ARQSI, *Single Page Applications*, slides 9, 12, 14–16, 19–20 and 26–27 (router, state, REST client, security, testing and static deployment). The framework examples illustrate the same SPA principles used here with React and Vite.
    *   Architecture: [System Architecture Description](../../architecture/SAD.md) (*Static Content* and *Front-End* containers; principles *Back-end authority* and *Client-side 3D rendering*; repository layout `frontend/`, `frontend/src/visualization`), [ADR-001 – Monorepo](../../architecture/ADR.md), [ADR-003 – REST and JSON](../../architecture/ADR.md), [ADR-004 – GitHub Actions](../../architecture/ADR.md) and [ADR-007 – Shared PostgreSQL on the DEI infrastructure](../../architecture/ADR.md) (consequence: front end and Prolog access business data only through back-end APIs).
    *   Related stories:
        *   **WEB02 – Consistent Layout and Navigation:** fills the `AppShell` layout slot (header, logo, primary navigation), i18n (PT/EN), `NotFoundPage` and the starting page.
        *   **WEB03 – Role-Based Navigation:** extends the route and menu policy and handles permission changes across the full SPA.
        *   **WEB04 – User Feedback and Validation:** consumes the normalised `ApiError` (`kind`, `status`, `message`) to show loading, error and retry feedback.
        *   **WEB05 / WEB06 / WEB07:** feature pages built in `src/features/<feature>` on top of `apiClient`.
        *   **AA01–AA04 – Authentication and Session:** the existing account and Google sign-in flows, `AuthProvider` and the AA04 cookie-based session lifecycle use the shared REST client.
        *   **VIS01 – 3D Module Integration:** the 3D viewer is mounted through the lazy *module slot* defined here, inside the common layout and route guard.
        *   **AI05 / AI06 – Artificial Intelligence Service Access:** the Back-End API calls the Prolog service. Prolog retrieves planning inputs through authorised back-end endpoints. The SPA reaches planning through the Back-End API via `planningApi` (OP1).
        *   **SYS01 – Automated Deployment and Validation:** deploys the static bundle produced by `npm run build` with the per-environment values documented here.
    *   **Dependencies:** WEB01 builds on the Sprint 1 front-end skeleton (React + Vite) and on the existing back-end REST API (`/api/v1`). It is a prerequisite of WEB02–WEB07 and VIS01 (*WEB01–WEB02 → WEB05–WEB07, VIS01* in the Sprint 2 planning).

### Scope boundary

WEB01 concerns **the technical foundation of the SPA and how it talks to the rest of the system**. It does not define *how the screens look* (WEB02), *which sections each role sees* (WEB03), *how feedback is presented* (WEB04), *the business pages* (WEB05–WEB07), *the session lifecycle* (AA04), *the 3D scene* (VIS02–VIS07), *the AI endpoints* (AI05) nor *the deployment pipeline* (SYS01).

WEB01 owns:

1. The choice and justification of the framework, router and tooling.
2. The folder structure of `frontend/src` and the dependency rules between its parts, so that features can be maintained and extended independently.
3. The single application entry point (`main.jsx` → `App` → providers → router → `AppShell`) shared by every role.
4. The single HTTP client (`apiClient`) and its normalised error (`ApiError`), used by every feature to read and maintain business information through the Back-End API.
5. The configuration module (`appConfig`) and the documented per-environment configuration, including the rule that no secret reaches the browser bundle.
6. The integration points for the 3D viewer and AI planning functionality. The lazy module slot is inside the common shell and gives the SPA-side adapters a session-bound request function. WEB06 / VIS01 / AI05 / AI06 / WEB07 own the actual modules and endpoint contracts (OP1).
7. Reproducible install, configuration, execution, test and build from the common repository (scripts, Node version, lockfile, CI checks, README).

---

## 2. Requirements & Analysis

### 2.1. User Story Description

> **As a** Project Manager,
> **I want** a single-page web application integrated with the existing back end,
> **so that** users can access the LaPrizza services through one interface.

The actor is the **Project Manager**, as named in the Sprint 2 specification. The beneficiaries are every website role of Table 1 (Guest, Customer, Restaurant Staff, LaPrizza Manager, Administrator), who use the same application, and the development team, who extends it in the following stories.

### 2.2. Acceptance Criteria

- [ ] **AC 1:** The Web Application provides a single, integrated interface for the different user roles.
- [ ] **AC 2:** The application uses an appropriate framework and is organized so that functionality can be maintained and extended independently.
- [ ] **AC 3:** Business information is obtained from and maintained through the corresponding back-end services, using consistent identifiers across the system.
- [ ] **AC 4:** The application is reproducibly installed, configured, and executed from the common project repository.
- [ ] **AC 5:** The integration of the 3D viewer and Artificial Intelligence services preserves the common navigation, authentication, and visual identity.
- [ ] **AC 6:** Configuration for different environments is documented, and sensitive credentials are not included in publicly accessible application files.

Section 6 records the evidence already obtained and the checks still needed for the Sprint 2 demonstration.

Criteria from related stories and from the architecture that constrain WEB01 (not owned, but must hold). They are listed separately from the WEB01 acceptance criteria and classified in 2.4.2:

*   **SAD – Back-end authority / ADR-007 (Consequences):** only the Back-End API enforces business rules and accesses the databases; *"the frontend and Prolog components access business data through backend APIs rather than connecting directly to the database"* → the SPA never talks to the databases. The SAD container view also places the AI service behind the Back-End API (*Back-End API → AI service*), which WEB01 adopts for planning (D7).
*   **AA03 AC 8 / AC 9, AA04 AC 6:** the API supplies roles and protected functionality stays unavailable while the roles are unconfirmed. The access JWT travels in the `Authorization` header. AA04 uses an HttpOnly cookie for session credentials and `X-CSRF-Token` for renewal and logout.
*   **AA05 AC 2 / AC 3:** `401` (authentication) is distinguished from `403` (permission) → `ApiError` keeps the HTTP status unchanged.
*   **WEB04 AC 4 / AC 7:** failures are shown without internal details and connection failures allow safe retry → `ApiError.kind` separates `network`, `timeout`, `http`, `aborted` and `invalid-response`.
*   **VIS01:** the 3D engine is embedded as a component of the SPA, uses its navigation and layout, preserves authentication, and its source lives in the existing repository.
*   **WEB06 / VIS02:** the viewer obtains the active kitchen configuration from a documented back-end endpoint and must not rely on a layout embedded in the front end.
*   **AI05 / AI06:** requests and results use JSON and identifiers consistent with the back end; access is restricted to the appropriate roles *or authorized service identities* (here: the Back-End API calling the Prolog service).
*   **SYS01:** sensitive configuration is managed separately from published source and deployment logs.


### 2.3. Client Clarifications & Questions

**Framework choice:** The Sprint 1 skeleton README records that the RFP leaves the front-end stack to the team. The justification for React and Vite is in D1.

The [Sprint 2 client clarifications (§§15–19)](https://github.com/Departamento-de-Engenharia-Informatica/LEI-SEM5-PI-2026-27-3DE-01/blob/d3f1b4295b3feb219423e91b28c8b729aae44945/docs/architecture/clientClarifications/clarifications.md#15-interface-localization-and-usability) and the [AA04 client answers](../aa/aa04/AA04.md#23-client-clarifications--questions) also apply.

| Source | Implication for the SPA |
| --- | --- |
| §15 – Interface and localisation | Keep the primary navigation accessible. WEB02 persists the PT/EN preference across reloads and later visits, preserving in-progress forms when the language changes. Interface text and allergen names follow the selected language. Ordinary business names and descriptions come from the API. |
| §15 – Concurrent editing | WEB04 / WEB05 explain that a record has changed and require a reload before saving when the API reports a conflict. |
| §16 – Roles and authentication | Restaurant Staff maps to `EMPLOYEE`. Removing a role removes its permissions while the other roles remain usable. The API enforces current permissions and the SPA rechecks roles on module entry and after a protected `401` / `403`. The team may choose the identity provider. |
| §18 – Account activation | Local registration requires email activation. First verified external sign-in can create and activate the Customer account. AA01 / AA02 / AA06 / AA07 own the account flows. |
| §§17, 19 – Planning | Purchase plans are for consultation. Calculations can record their results and input references. Stock changes and supplier order confirmation are outside the calculation. |
| AA04 answers – Session lifecycle | The inactivity timeout is configurable. Activity may renew a valid session. Logout ends the current device session. |

### 2.4. Business Rules & Invariants

The rules are split by **where their authority comes from**, so that a team choice is never presented as a specification requirement:

*   **2.4.1 – Requirements of WEB01:** only what the six WEB01 acceptance criteria state.
*   **2.4.2 – Constraints from related stories and architecture:** rules WEB01 must respect because another story or an accepted architecture document states them.
*   **2.4.3 – Team design rules:** choices made by the team **to satisfy** a requirement; they are justified in 3.8 and may be replaced by another choice that satisfies the same AC.
*   **2.4.4 – Open points:** what is not defined yet and therefore cannot be validated in WEB01.


#### 2.4.1. Requirements of WEB01 (Sprint 2 specification)

| ID | Rule | Source |
| --- | --- | --- |
| **BR 1** | All website roles (Table 1, including Guest) use **one** integrated Web Application; there is no separate application per role. What each role sees is decided by WEB03. | WEB01 AC 1 |
| **BR 4** | Business information is read and maintained through the back-end services, and identifiers are consistent across the system: the SPA uses the identifiers issued by the back end (`PROD-00001`, `CAT-00001`, …) without generating, rewriting or deriving them, including in data passed to the 3D viewer and the AI pages. | WEB01 AC 3; AI05 ("identifiers consistent with the back end"); IV.2.3 Deliverable |
| **BR 8** | Sensitive credentials are not included in publicly accessible application files. Because `VITE_*` values are public and may be embedded in the bundle, no secret (passwords, JWT secret, OAuth client secret, database credentials, API keys) is placed in a `VITE_*` variable, in `frontend/` files or in `dist/`. | WEB01 AC 6 |
| **BR 11** | The 3D viewer and the AI pages preserve the common navigation, authentication and visual identity: they are shown inside the common application shell, with the same session and navigation as the rest of the SPA. | WEB01 AC 5; VIS01 AC 2 |
| **BR 15** | Configuration for each supported environment is documented. | WEB01 AC 6 |
| **BR 16** | The application can be installed, configured and executed reproducibly from the common repository. | WEB01 AC 4 |

#### 2.4.2. Constraints from related stories and architecture

| ID | Rule | Source |
| --- | --- | --- |
| **BR 6** | The SPA never accesses PostgreSQL or MongoDB directly; business data (including kitchen layouts and asset references) is obtained through back-end APIs. | ADR-007 Consequences; SAD *Back-end authority*; WEB06 ("documented back-end endpoint", "must not rely on a layout embedded in the front end") |
| **BR 12** | Session information stays out of URLs, logs and errors. Protected requests carry the access JWT in `Authorization`. AA04 owns the browser-managed session cookie and the CSRF header. | AA04 AC 6 |
| **BR 14** | After a successful change, the displayed result reflects the saved state (the page re-reads it from the back end). | WEB05 ("information must be refreshed after a successful change") |
| **BR 17** | `401` (not authenticated) and `403` (not permitted) remain distinguishable to the UI; failures are shown without internal details and connection failures can be retried. | AA05 AC 3; WEB04 AC 4 / AC 7 |

#### 2.4.3. Team design rules (chosen to satisfy the requirements above)

| ID | Rule | Satisfies | Decision |
| --- | --- | --- | --- |
| **BR 2** | Every feature lives in its own folder and depends only on shared modules (`api`, `config`, `auth`, `layout`, `feedback`, `i18n`, `navigation`), never on another feature; shared modules never import from a feature. ESLint guards direct REST calls and imports into the API and configuration layers. | AC 2 | D2 |
| **BR 3** | Every REST request goes through `apiClient`; no feature calls `fetch` directly. | AC 3, BR 12, BR 17 | D3 |
| **BR 5** | Business data is not persisted in browser storage (`localStorage`, `sessionStorage`, IndexedDB). | AC 3, BR 14 | D4 |
| **BR 7** | Configuration is read once through `appConfig`, from an allow-list of `VITE_*` variables; a missing / invalid required value stops the application with a configuration error. | AC 6, BR 8 | D5 |
| **BR 9** | `.env.example` is the only tracked environment file and documents every variable; `.env` and `.env.*.local` are git-ignored; a CI step scans `dist/` for known secret names. | AC 6, BR 8, BR 15 | D6 |
| **BR 10** | Node 24 (`frontend/.nvmrc`), `npm ci` from the committed lockfile, and the same scripts (`dev`, `build`, `preview`, `test`, `lint`) locally and in CI; CI also runs the Express health check and the bundle scan. | AC 4, BR 16 | D8 |
| **BR 13** | Heavy modules (3D viewer, planning) are loaded on demand, and a failure while loading or rendering them is contained inside the shell. | AC 5, BR 11 | D7 |
| **BR 18** | The SPA calls the Back-End API. The back end authorises planning and calls Prolog. Prolog reads versioned business inputs through the AI06 back-end endpoints. | AC 3, AC 5, BR 11 | D7, AI06 |

#### 2.4.4. Open points

| ID | Open point | Owner | How WEB01 handles it |
| --- | --- | --- | --- |
| **OP1** | Routes, payloads and permissions of the active kitchen configuration endpoint and of the planning endpoints on the Back-End API. | WEB06 / VIS01 / AI05 / AI06 / WEB07 | WEB01 states the conditions those contracts must meet (3.4) and validates the shell integration with stub modules (FT05); end-to-end validation (MT05) is deferred until the contracts exist. |
| **OP2** | Reject edits based on a stale product record and require a reload (client clarification §15). The current BCK05 `PUT` contract does not check a record version. Its existing `409` responses cover business conflicts. | WEB05 and the product API | The REST client preserves the API status and message and does not replay writes. The owning stories must agree on a version or precondition and the corresponding UI feedback. |

### 2.5. Domain Model Excerpt

![WEB01 Domain Model Excerpt](./excerptDomainModel/LaPrizzaDomainModel.svg)

PlantUML source: [`excerptDomainModel/domain_model_excerpt.puml`](./excerptDomainModel/domain_model_excerpt.puml).

| Concept | Kind | Role in WEB01 |
| --- | --- | --- |
| **UserId**, **CustomerId**, **CategoryId**, **ProductId**, **StockId** | Value Objects (existing, unchanged) | Business identifiers generated by the back end (`USR-…`, `CUST-…`, `CAT-…`, `PROD-…`, `STOCK-…`) and used unchanged by the SPA, the 3D viewer and the AI pages (BR 4) |
| **User** / **UserRole** | Aggregate Root / Enumeration (existing, unchanged) | One SPA for all roles of Table 1 (BR 1); roles are consumed by WEB03, never decided by WEB01 |
| **Customer**, **Product**, **ProductCategory**, **StockInformation** | Aggregate Roots (existing, unchanged) | Examples of business information read and maintained only through the Back-End API (BR 3, BR 6) |

The kitchen configurations (WEB06) and consumption forecasts / supplier scenarios (WEB07) are modelled by their own stories; their identifiers must follow the same rule (issued by the back end, reused unchanged by the SPA, the 3D viewer and the Prolog knowledge base).

WEB01 introduces **no new domain concept**. `apiClient`, `ApiError`, `appConfig` and the module slot are technical concepts of the SPA (`frontend/src`), not domain concepts, and are therefore not part of the domain model. The excerpt shows only the identifiers and aggregates whose consistency across the SPA, the 3D viewer and the AI module is required by AC 3.

**DDD stays on the back-end side.** Aggregates, value objects, repositories and domain rules exist only in the Back-End API (ADR-002). The SPA receives their **DTO representations** (plain JSON objects) and does not re-model them: there are no entities, aggregates, repositories or domain services in `frontend/src`. The front-end design is evaluated with front-end criteria instead – modularity, dependency direction and SOLID (section 3.6).

---

## 3. Design

### 3.1. Architecture & C4 Alignment

This User Story operates within the established **C4 Model** of the system ([SAD](../../architecture/SAD.md)):

*   **C4 Level 1 (System Context):** every actor of Table 1 uses the *LaPrizza Information System* through **one** Web Application; Google Identity Services (AA02) is reached only through the back-end-driven redirect flow.
*   **C4 Level 2 (Containers):** *Static Content* delivers the compiled bundle (`dist/`) produced by `npm run build`; the *Web Application* (React SPA, including Three.js) talks to the *Back-End API* over HTTP / JSON; the *Back-End API* owns database access and calls the *AI service*. The AI service reads planning inputs through the Back-End API (AI06).
*   **C4 Level 3 (Components – Front-End):** WEB01 defines the component skeleton of the Front-End container: *App bootstrap* (`main`, `App`, `AuthProvider`, `BrowserRouter`, `AppShell`), *Configuration* (`appConfig`), *HTTP client* (`apiClient`, `ApiError`) and the *Module slot* (`ModulePage`, `LazyModule`, `ModuleErrorBoundary`). The other components plug into it: *Layout & i18n* (WEB02), *Navigation* (WEB03), *Feedback* (WEB04), *Authentication state* (AA03/AA04), *Feature pages* (WEB05–WEB07), *3D Visualization* (VIS01). **No back-end change is required by WEB01**; it only consumes the existing `/api/v1` API and its CORS setting.

---

### 3.2. Class Diagram (CD)

The class diagram is presented in two views of the same design. `component` denotes a React component (typically a function), `record` describes the shape of a JavaScript object, and `extension` denotes a page or adapter supplied by another story. Only members relevant to WEB01 are shown.

![Class Diagram — Application and module slot](./classDiagram/class_diagram.svg)

> PlantUML source: [`classDiagram/class_diagram.puml`](./classDiagram/class_diagram.puml).

![Class Diagram — REST, configuration and session](./classDiagram/class_diagram_rest_session.svg)

> PlantUML source: [`classDiagram/class_diagram_rest_session.puml`](./classDiagram/class_diagram_rest_session.puml).

The views follow the SPA separation between views, router, shared state, feature services and HTTP transport (ARQSI slides 9, 12, 15–16 and 20–21). The request received by a feature exposes `body`, `query` and `signal`. `ConfirmedModule` supplies the bearer token and checks current roles after a protected `401` or `403`.

Key design points:

*   **Reused unchanged:** back end – `/api/v1` routers, `errorHandler` (`{ error: { message, status } }`), `GET /health`, CORS middleware, Swagger; front end – `GoogleSignInButton`, `googleSignIn.js`, `session.js` (AA02).
*   **Refactored:**
    *   `healthApi` and both existing auth adapters now use `apiClient`. The app reads the API base from `appConfig`.
    *   `App.jsx` uses `BrowserRouter` for routing. `GoogleCallbackPage` removes the OAuth query via a router replacement and still uses `/auth/callback/google`.
*   **New:**
    *   `appConfig` (`src/config/appConfig.js`): reads the allow-listed `VITE_*` variables once, validates and freezes them.
    *   `apiClient` + `ApiError` (`src/api`) centralise JSON, timeout, optional bearer and cookie credentials and normalised errors. The route supplies the access token explicitly. `ModulePage` asks `AuthProvider` to revalidate roles after a protected `401` or `403`.
    *   `App.jsx` is the composition root for `AuthProvider`, `BrowserRouter`, `AppShell` and the initial routes. WEB02 extends the layout and WEB03 extends the route policy.
    *   `ModulePage`, `moduleRoutes`, `LazyModule` and `ModuleErrorBoundary` (`src/app`) mount registered modules on demand inside the shared layout.
    *   `<feature>Api` convention (e.g. `productApi`, `kitchenConfigurationApi`, `planningApi`): one thin module per feature on top of `apiClient`, owned by WEB05 / WEB06 / WEB07. These are **HTTP adapters**, one function per endpoint, returning DTOs; they are **not** repositories (no identity map, no cache, no domain rules – DDD stays in the back end, 2.5).

#### Folder structure and dependency rules (BR 2)

The tree shows the implemented foundation and the intended locations for the dependent stories.

```text
frontend/src/
├── main.jsx                 entry point (only renders <App/>)
├── App.jsx                  WEB01 – composition root, BrowserRouter, AppShell and initial routes
├── app/                     WEB01 – moduleRoutes, ModulePage, LazyModule, ModuleErrorBoundary
├── config/                  WEB01 – appConfig (environment)
├── api/                     WEB01 – apiClient, ApiError
├── auth/                    AA01–AA04 – authApi, AuthProvider, ProtectedRoute, Google sign-in
├── navigation/              WEB03 – navigationPolicy, accessPolicy, NavigationMenu, RequireRole
├── layout/                  WEB02 – AppLayout, header, logo, NotFoundPage, starting page (replaces the WEB01 placeholders)
├── i18n/                    WEB02 – PT / EN messages
├── feedback/                WEB04 – loading, error, empty, confirmation components
├── features/                WEB05 – one folder per business area
│   ├── customers/  categories/  allergens/  products/  pizza-sizes/
│   ├── component-types/  predefined-pizzas/  stock/  catalogue/
│   └── <feature>/{<feature>Api.js, pages/, components/, *.test.js(x)}
├── kitchen/                 WEB06 – kitchen configuration pages + kitchenConfigurationApi
├── planning/                WEB07 – forecasts, supplier scenarios, executions + planningApi
└── visualization/           VIS01–VIS07 – Three.js viewer (KitchenViewerPage, scene/)
```

| May import from → | `config` | `api` | `auth` | `navigation` | `layout` / `i18n` / `feedback` | a feature / `kitchen` / `planning` / `visualization` |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `app` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (only through route registration / `LazyModule`) |
| feature / `kitchen` / `planning` / `visualization` | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ (never another feature) |
| `navigation`, `layout`, `i18n`, `feedback`, `auth` | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| `api` | ✔ | – | ✘ | ✘ | ✘ | ✘ |
| `config` | – | ✘ | ✘ | ✘ | ✘ | ✘ |

ESLint rejects direct use of the global `fetch` outside the REST client and imports from app, auth and feature folders into `api` / `config`. The rest of the table guides the dependent stories. `kitchen` (WEB06) and `visualization` (VIS01) read the active configuration through the same back-end contract.

#### Route map

| Route | Access | View or transition |
| --- | --- | --- |
| `/`, `/login` | Public | Shows sign-in, current account or session feedback. |
| `/register` | Guest | Opens the local registration form. |
| `/password-recovery` | Public | Opens recovery. The existing `/?recoveryToken=…` link also works. |
| `/auth/callback/google` | Public | Consumes the OAuth query once and returns to `/` after sign-in. |
| `/account/password` | Authenticated account with a local password | Changes the password and returns to sign-in. |
| `/kitchen/viewer` | `EMPLOYEE`, `MANAGER` | Enabled when VIS01 supplies the loader. |
| `/kitchen/configurations` | `MANAGER` | Enabled when WEB06 supplies the loader. |
| `/planning` | `MANAGER` | Enabled when WEB07 supplies the loader. |
| `*` | Public | Shows the not-found view in the common shell. |

#### `ApiError` (normalised failure returned by `apiClient`)

| Situation | `kind` | `status` | `message` | Typical use |
| --- | --- | --- | --- | --- |
| Back-end answered `4xx` with a non-empty `{ error: { message, status } }` | `http` | HTTP status | back-end message | WEB04 feedback and WEB03 permission handling |
| Back-end answered `5xx` or `4xx` without a usable message | `http` | HTTP status | `Request failed with status <n>` | Generic failure feedback |
| `fetch` rejected (offline, DNS, CORS, connection refused) | `network` | `0` | `The server could not be reached.` | WEB04 retry |
| No answer within `appConfig.apiTimeoutMs` | `timeout` | `0` | `The server took too long to answer.` | Safe retry for reads. Writes are not automatically replayed. |
| Caller cancels the request | `aborted` | `0` | `Request cancelled.` | Discard a request that is no longer needed |
| `2xx` whose body is not valid JSON (except `204`) | `invalid-response` | HTTP status | `Unexpected response from the server.` | Treated as failure (fail closed) |

The client builds `ApiError` without attaching request headers, tokens or the request body. The back end must also keep sensitive data out of its error messages (BR 12).

---

### 3.3. Use Cases and Sequence Diagrams (SD)

The **Project Manager** requests the integrated application. UC1 expresses the user's goal in WEB01. UC2–UC4 illustrate how the shared SPA supports functionality specified in the related stories. The actors show who can perform each action. Sections 3.4 and 6 cover the installation, build and environment checks for AC 4 and AC 6.

![Use Case Diagram](./useCaseDiagram/use_case_diagram.svg)

> Source: [`use_case_diagram.puml`](./useCaseDiagram/use_case_diagram.puml)

| Use case | Actor and conditions | Outcome | Design |
| --- | --- | --- | --- |
| **UC1 — Access available LaPrizza services** | Any visitor or signed-in user | Open a deep link or navigate internally in the same SPA. Access to protected content depends on the confirmed session and roles. | SD1 · WEB01, AA03/AA04 |
| **UC2 — Edit a product** | LaPrizza Manager, with a product selected | Read and save the product through BCK05, then refresh it using the original identifier. | SD2 · WEB05/BCK05 integration example |
| **UC3 — View the active kitchen** | Restaurant Staff (`EMPLOYEE`) or LaPrizza Manager; viewer loader registered | Use the common shell to view the active back-end configuration. Report an unavailable configuration in the viewer. | SD3, SD4 · WEB06/VIS01 |
| **UC4 — Run a forecast and consult its result** | LaPrizza Manager; planning loader registered and a saved forecast selected | Run planning through the back end and consult the result in the SPA. The execution does not change stock or confirm supplier orders. | SD3, SD5 · WEB07/AI05/AI06 |

#### SD 1 — SPA Start-up and Configuration (AC 1, AC 4, AC 6)

The static host serves `index.html` for a direct SPA link. After configuration validation, `BrowserRouter` handles internal navigation without another document load. The shared layout shows connection status, while AA04 restores the session and AA03 resolves roles. The same router serves the AA02 callback; its detailed OAuth exchange stays in [AA02](../aa02/sequenceDiagram/sequence_diagram_google_login.puml). The fallback must still be verified on the target host (MT04).

![Sequence Diagram — SPA Start-up](./sequenceDiagram/sequence_diagram_spa_startup.svg)

> Source: [`sequence_diagram_spa_startup.puml`](./sequenceDiagram/sequence_diagram_spa_startup.puml)

#### SD 2 — Reading and Maintaining Business Information through the Back End (AC 2, AC 3)

The proposed WEB05 product editor uses `productApi` → `ModuleRequest` → `apiClient` with the product ID returned by BCK05. The back end authorises the read and the write separately. `PUT` sends the complete writable body, followed by a GET with the same ID on success. Errors retain their HTTP status or transport kind; a write with an unconfirmed outcome is never replayed automatically. Concurrency protection remains OP2.

![Sequence Diagram — Back-End Integration](./sequenceDiagram/sequence_diagram_backend_integration.svg)

> Source: [`sequence_diagram_backend_integration.puml`](./sequenceDiagram/sequence_diagram_backend_integration.puml)

#### SD 3 — Opening a Protected Module inside the Common Shell (AC 5)

The existing module slot checks current roles before loading the feature and contains import or render failures inside the shared layout. SD4 and SD5 reuse this flow. The module request also rechecks roles on a `401` or `403` and returns the original error to the caller without replaying the operation.

![Sequence Diagram — Protected module](./sequenceDiagram/sequence_diagram_module_integration.svg)

> Source: [`sequence_diagram_module_integration.puml`](./sequenceDiagram/sequence_diagram_module_integration.puml)

#### SD 4 — View the Active Kitchen (AC 3, AC 5)

The proposed viewer reads the active configuration from the Back-End API and reports a missing configuration or unavailable WebGL in the shell. It uses the configuration ID and asset references returned by the API. Editing kitchen configurations is a separate Manager operation owned by WEB06.

![Sequence Diagram — Active kitchen viewer](./sequenceDiagram/sequence_diagram_kitchen_viewer.svg)

> Source: [`sequence_diagram_kitchen_viewer.puml`](./sequenceDiagram/sequence_diagram_kitchen_viewer.puml)

#### SD 5 — Execute and Consult a Planning Result (AC 3, AC 5)

Planning follows D7 / BR 18: `planningApi` → Back-End API → Prolog. Prolog obtains planning inputs through authorised back-end endpoints (AI06). The back end records the result and the versions of the forecast, stock snapshot, pizza BOM and supplier scenario. Calculation leaves stock and purchase orders unchanged. The endpoint paths and payloads in SD4 and SD5 remain with the owning stories (OP1).

![Sequence Diagram — Planning](./sequenceDiagram/sequence_diagram_planning.svg)

> Source: [`sequence_diagram_planning.puml`](./sequenceDiagram/sequence_diagram_planning.puml)

---

### 3.4. REST API Specification (ARC03)

WEB01 **adds no endpoint**. It defines how the SPA consumes the existing API and which contracts every feature must respect.

| Method | Endpoint | Use in WEB01 | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Start-up connectivity indicator (existing `healthApi`, now through `apiClient`) | Public |
| *any* | `/api/v1/<resource>` (Sprint 1 endpoints, Swagger `/api-docs`) | Called only through `<feature>Api` → `apiClient` by the pages of WEB05 | As defined by each endpoint / AA05 |
| *any* | `/api/v1/auth/*` | Called by `authApi` (AA01–AA04) through `apiClient` | As defined by AA01–AA04 |
| ***open (OP1)*** | Active kitchen configuration (WEB06 / VIS01) | Called only by `kitchenConfigurationApi` through `apiClient` | Read: `EMPLOYEE` or `MANAGER` for viewer access. Configuration changes require `MANAGER`. |
| ***open (OP1)*** | Planning execution / results on the Back-End API (AI05 / WEB07) | Called only by `planningApi` through `apiClient`; the Back-End API calls the Prolog service | `MANAGER` (Table 1) |

#### Pending integration contracts (OP1)

The kitchen-configuration and planning contracts are **not defined yet**, so their routes, payloads and endpoint enforcement **cannot be validated end-to-end in WEB01**. WEB01 fixes only the SPA side and the conditions those contracts must meet to fit the SPA:

| Condition the future contract must meet | Why (source) |
| --- | --- |
| JSON request / response; identifiers as issued by the back end | ADR-003; AI05; BR 4 |
| Bearer token in `Authorization` accepted; `401` vs `403` distinguished | AA04, AA05 AC 3; BR 12, BR 17 |
| Errors in `{ "error": { "message", "status" } }`; an unavailable AI service is reported by the Back-End API as an error response (e.g. `503`), never as an apparently valid result | `ApiError` model (3.2); AI05 ("distinguish … service unavailability") |
| Documented in Swagger / the owning story's REST section | ADR-003; AI05 ("documented REST endpoints"); WEB06 ("documented back-end endpoint") |
| Role restrictions follow Table 1 | AA05 |

Proposed SPA-side adapter interfaces for the owning stories:

| Adapter | Function | Returns | Owner of the endpoint |
| --- | --- | --- | --- |
| `kitchenConfigurationApi` | `getActive()` | active configuration DTO, or `ApiError` (e.g. `404` when none is active) | WEB06 / VIS01 |
| `planningApi` | `execute(forecastId)`, `getResult(executionId)` | result DTO, or `ApiError` | AI05 / WEB07 |

**Verification status:** the shell, session and permission checks are exercised with stub components using the real shared client and mocked HTTP responses. MT05 requires the actual WEB06 / VIS01 / WEB07 / AI05 / AI06 modules and API contracts.

#### Request & Response Schemas

- **Request conventions (`apiClient`):**
  - Feature adapters reuse identifiers as issued by the back end and apply `encodeURIComponent` to each dynamic path segment (e.g. `/products/PROD-00001`). This encodes the URL representation while preserving the identifier value.
  - `apiClient` validates the supplied path and appends it to `appConfig.apiBaseUrl`. It preserves encoded segments and rejects invalid paths before making a request, including paths outside the configured base and paths containing raw `?` or `#`. Query parameters go in the separate `query` option.
  - Headers include `Accept: application/json` and `Content-Type: application/json` for JSON bodies. An explicit access token is sent as `Authorization: Bearer <token>`.
  - Query parameters built with `URLSearchParams` (no manual concatenation); never contain tokens or credentials.
  - AA04's adapters include the HttpOnly cookie for cookie-backed requests and send `X-CSRF-Token` for renewal and logout. The REST client does not initiate renewal or replay a write. The module route rechecks `/auth/me` on a protected `401` or `403`.
- **Success:** `2xx` → parsed JSON body (`204` → `null`).

  Example (`GET /api/v1/products/PROD-00001`, excerpt of the existing BCK05 `ProductResponseDTO`):
  ```json
  {
    "id": "PROD-00001",
    "name": "Mozzarella",
    "categoryId": "CAT-00001",
    "isSellable": false,
    "isPizzaComponent": true,
    "isActive": true
  }
  ```
  The `id` / `categoryId` values are kept as strings and reused unchanged in the next route and request (BR 4).

- **Error Responses** (existing `errorHandler` format, mapped to `ApiError`):
  ```json
  {
    "error": {
      "message": "Descriptive error message",
      "status": 400
    }
  }
  ```
  → `ApiError { kind: "http", status: 400, message: "Descriptive error message" }`. Network failure, timeout and malformed bodies are mapped as in the `ApiError` table (3.2).

#### Environment configuration (AC 6)

The application reads only the named public settings below. The port is used by the Vite dev server.

| Variable | Read by | `development` (`npm run dev`) | `test` (Jest / CI) | `production` (`npm run build`) | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_BACKEND_BASE_URL` | `appConfig.apiBaseUrl` | `http://localhost:8080/api/v1` | `http://localhost:8080/api/v1` | **Required.** Absolute `https://…/api/v1` of the deployed back end, or `/api/v1` when the reverse proxy serves SPA and API on the same origin | Use the same site for the session cookie. The base must end in `/api/v1` with no trailing slash. |
| `VITE_API_TIMEOUT_MS` | `appConfig.apiTimeoutMs` | `15000` | `15000` | `15000` (optional) | Positive integer |
| `VITE_DEV_SERVER_PORT` | `vite.config.js` only | `5173` | – | – | Must match the origin in the back-end `CORS_ORIGIN` |

- **Where the values come from:** `development` → `frontend/.env` copied from `.env.example`; `test` → defaults in `appConfig`; `production` / staging → environment variables of the build job (SYS01) or `.env.production.local` on the build machine — never committed.
- **Back-end counterpart (documented, unchanged):** `CORS_ORIGIN` must be the SPA origin; `GOOGLE_REDIRECT_URI` must be `<SPA origin>/auth/callback/google`.
- **Never in the front end:** `JWT_SECRET`, `PG*`, `GOOGLE_CLIENT_SECRET`, `BOOTSTRAP_MANAGER_PASSWORD`, AI service credentials or any other secret (BR 8).
- **AI service:** no front-end variable. Its address and any credentials are configured only in the Back-End API (D7, BR 18).
- **Environments (team assumption):** `development` (local), `test` (Jest / CI) and `production` (static build on the DEI infrastructure, SYS01); staging uses the `production` build with its own values.

### 3.5. Persistence & Data Integrity (ARC04)

WEB01 uses the existing schema. A local installation must apply the branch migrations, including the AA04 session table, before testing login.

- **Client-side state:** form state stays in the mounted component. AA03 keeps the user and roles in memory. AA04 keeps the access JWT and CSRF value in memory and uses a browser-managed HttpOnly cookie for the session credential. The router carries a selected ID or non-sensitive filters where useful. WEB02 persists the language preference without resetting form data.
- **Identifier integrity:** the SPA treats identifiers as opaque strings; it does not parse, increment or build them (no client-side `PROD-` numbering), so the back end remains the only source of identity and the 3D / AI modules receive the same values (BR 4).
- **Freshness:** after a successful create / update / delete, the page re-reads the resource or list from the back end instead of patching a local copy (BR 14; WEB05).
- **Configuration integrity:** `appConfig` is frozen after validation; a test checks that only the allow-listed variables are read and that a CI step finds no known credential name or private-key marker in `dist/` (D6).

### 3.6. Applied Patterns & Architecture Principles

DDD tactical patterns (aggregates, repositories, domain services) belong to the Back-End API and are **not** reproduced in the SPA (2.5). The front-end design is assessed by **modularity, dependency direction and SOLID**.

#### Patterns

- **Single Page Application + client-side routing:** one document, one router, all roles (BR 1).
- **Feature-based modular structure (vertical slices):** features are added or removed without touching others; shared modules form a stable core (BR 2).
- **Composition Root:** `App` wires the provider, router, common shell and module loaders.
- **Gateway:** `apiClient` is the single gateway for HTTP; each `<feature>Api` is a thin **HTTP adapter** (one function per endpoint, DTO in / DTO out) – not a repository.
- **Adapter:** `ApiError` adapts HTTP, network and timeout failures to one error model for the UI.
- **Lazy loading + Error Boundary:** heavy modules are loaded on demand and their failures are contained inside the shell (BR 13).
- **Twelve-Factor configuration:** configuration in the environment, validated at start-up, separated from code; secrets never in the client (BR 7, BR 8).
- **Back-end authority:** the SPA presents and requests; the back end validates, authorizes and persists (BR 6).

#### Modularity and dependency direction

Dependencies point **inwards to stable, generic modules** and never sideways between features:

```text
app  ──►  features / kitchen / planning / visualization  ──►  navigation · layout · i18n · feedback · auth  ──►  api  ──►  config
```

- `config` depends on nothing; `api` depends only on `config`; the feature import direction is described in 3.2 (D2).
- The route or auth adapter passes request credentials to `apiClient`. `AuthProvider` owns session renewal and role revalidation.
- Features never share state or call each other; data needed by two features (e.g. product ids in WEB07) is re-read from the back end.

#### SOLID in the SPA

| Principle | How it is applied in WEB01 |
| --- | --- |
| **S** – Single Responsibility | `appConfig` only reads / validates configuration; `apiClient` only performs HTTP and maps failures; `<feature>Api` only maps a feature's endpoints; pages only present and orchestrate; `ModuleErrorBoundary` only contains failures. |
| **O** – Open / Closed | New features are added as new folders and new routes (WEB03 `navigationPolicy`) without editing `apiClient`, `AppShell` or other features; The composition root registers lazy modules using the shared route policy. |
| **L** – Liskov Substitution | Any adapter that honours the `<feature>Api` contract (DTO or `ApiError`) can replace another: the real adapter or a mock in tests (FT05); pages behave the same. Any lazy module honours the same `LazyModule` contract (default-exported component). |
| **I** – Interface Segregation | Pages use the operations exposed by their own adapter (e.g. `productApi.getById`). The module receives only its scoped `request` function. |
| **D** – Dependency Inversion | The REST client receives request options and stays independent of `AuthProvider`. A feature adapter can use the scoped request function without depending on the provider. |

### 3.7. New Components and Justification

| Component | Layer | Why it is needed / why an existing one is not enough |
| --- | --- | --- |
| React Router (`react-router`, declarative mode) | Front-End – Routing | AC 1 needs one application with many sections reachable by URL (bookmarks, back button, WEB03 manual-URL check); the former pathname check did not scale. WEB03 diagrams already assume `Routes` / `Navigate`. |
| `App`, `BrowserRouter`, `AppShell` | Front-End – App | Single composition root so that every role, the 3D viewer and the AI pages share the same providers, layout and guard (AC 1, AC 5). |
| `appConfig` | Front-End – Config | Centralises the public settings and reports invalid configuration before routes make API requests (AC 6). |
| `apiClient` + `ApiError` | Front-End – HTTP | The existing auth and health calls share the API base, timeout and error model. Feature adapters reuse that transport (AC 3). |
| `LazyModule` + `ModuleErrorBoundary` | Front-End – App | Three.js and the planning views are heavy and can fail (WebGL, chunk download); they must not slow down nor break the rest of the SPA (AC 5, BR 11, BR 13). |
| ESLint REST and dependency rules | Tooling | Enforces the direct REST call and transport-layer import restrictions described in 3.2. |
| Jest, jsdom and React `act` | Tooling | Tests both transport functions and routing/component behaviour, including the callback and the lazy module slot. |
| CI `frontend-checks`: `npm run lint`, `npm test`, bundle secret scan | Tooling / CI | AC 4 / AC 6 evidence: the same commands as locally, and a failed check stops the pipeline. |
| `frontend/.nvmrc` (`24.22.3`) | Tooling | Pins the Node version for the frontend CI job and reproducible setup. |

### 3.8. Design Decisions

These are **team decisions** made to satisfy the requirements in 2.4.1 and the constraints in 2.4.2; none of them is stated by the specification itself.

| ID | Decision |
| --- | --- |
| **D1** | Keep **React 19 + Vite 7 + JavaScript** (already in the repository and in the SAD Front-End container). Reasons: component model suited to role-dependent UIs, mature routing / testing ecosystem, direct integration of Three.js in a component, fast dev server and static build for *Static Content*, and the team's existing JavaScript stack (back end in Node.js). Alternatives considered: Angular (heavier, TypeScript-first, would discard the Sprint 1 skeleton and AA02 code), Vue (no team experience, no gain for the requirements). The implementation reuses the existing JavaScript code and tests. |
| **D2** | Feature-based folder structure (3.2) with the ESLint checks described in 3.2. Features expose pages and a `<feature>Api`; they never import another feature. Cross-feature data (e.g. product ids used by WEB07) is always re-read from the back end. |
| **D3** | One `apiClient` uses native `fetch` with `request(method, path, options)` and `get/post/put/patch/delete(path, options)`. Options carry JSON, queries, cancellation and credentials as needed. The client handles timeouts and `ApiError`. Auth adapters preserve the AA04 cookie and CSRF contract. The module route rechecks permissions on `401` / `403` without automatically replaying a write. |
| **D4** | Identifiers are opaque strings issued by the back end and reused unchanged in routes (`/manage/products/:productId`), requests, the 3D viewer and the AI pages; URL path segments are encoded. No business data is cached in browser storage; pages re-read after changes. |
| **D5** | `appConfig` reads an allow-list of `VITE_*` variables once, validates them (URL format, `/api/v1` suffix, positive timeout) and freezes the result. In `production` mode a missing `VITE_BACKEND_BASE_URL` is an error (no silent `localhost` fallback); in `development` / `test` the documented local default is used. The build rejects invalid production configuration. A configuration failure at start-up shows an error before the router makes requests. |
| **D6** | Secrets policy: everything under `VITE_*` is treated as public. `.env.example` is the only tracked env file. A CI step scans `dist/` for known secret names (`JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `PGPASSWORD`, `BOOTSTRAP_MANAGER_PASSWORD`) and private-key markers and fails the job if found. |
| **D7** | The kitchen and planning routes use `AppShell`, the existing `ProtectedRoute` and `LazyModule` (`React.lazy` + `Suspense` + `ModuleErrorBoundary`). `moduleRoutes` supplies the paths and Table 1 roles. A route is enabled when its owning story supplies a loader. The viewer uses the WEB06 configuration endpoint. For planning, the Back-End API authorises the Manager request and invokes Prolog as a service identity. Prolog retrieves the required inputs through AI06. The back end stores the result with the forecast version, stock snapshot, BOM and supplier scenario. Calculation leaves stock and supplier orders unchanged. The SPA uses the same API and session as the other pages. |
| **D8** | Reproducibility: Node 24 LTS (`frontend/.nvmrc` + `engines`), `npm ci` from the committed lockfile, documented scripts `dev`, `build`, `preview`, `test`, `lint`, `format:check`; CI `frontend-checks` runs `npm ci → lint → test → Express health check → build → bundle scan`. The README documents install, configuration per environment, run, test, build and the static-hosting rule (unknown paths must serve `index.html` so that client-side routes survive a reload). |
| **D9** | `AppShell` provides the application name, health feedback, enabled module links and the common `<main>` area. The route map in 3.2 lists the initial and conditional routes. WEB02 owns the final layout and WEB03 owns the full navigation policy. |

---

## 4. Tests (ARC05)

### 4.1. Test Plan & Scenarios

| Test ID | Level / Source | Scenario / Description | Expected Result |
| ------- | -------------- | ---------------------- | --------------- |
| UT01 | Config — `appConfig.test.js` | Valid `development` values; `production` without `VITE_BACKEND_BASE_URL`; URL not ending in `/api/v1`; `VITE_API_TIMEOUT_MS=-1` | Frozen config; three configuration errors |
| UT02 | Config — `appConfig.test.js` | Environment with extra variables (`VITE_SECRET=x`, `JWT_SECRET=y`) | Only allow-listed keys present in `appConfig` |
| UT03 | HTTP — `apiClient.test.js` | `get('/products/PROD-00123')` with an explicit access token | `fetch` called with `<base>/products/PROD-00123`, `Authorization: Bearer …`, `Accept: application/json` |
| UT04 | HTTP — `apiClient.test.js` | No access token supplied | No `Authorization` header |
| UT05 | HTTP — `apiClient.test.js` | Caller supplies an already encoded ID segment and `query: { name: 'a&b' }`; also try paths with raw `?` or `#` and paths outside the API base | Encoded segment preserved, query encoded separately and invalid paths rejected before `fetch` |
| UT06 | HTTP — `apiClient.test.js` | `post` with body; `204` answer | JSON body + `Content-Type`; resolves `null` |
| UT07 | HTTP — `apiClient.test.js` | `401` / `403` / `503` with an error body | Preserve the status. Use a generic message for `503`. |
| UT08 | HTTP — `apiClient.test.js` | `fetch` rejects; answer slower than `apiTimeoutMs`; `200` with invalid JSON | `ApiError` `network`; `timeout` (request aborted); `invalid-response` |
| UT09 | HTTP — `apiClient.test.js` | Protected request with an access token fails with HTTP `401`, `403` or `503` | No request headers on the error object and no access token in its message or serialised form |
| UT10 | Auth (regression) — `test/auth/*.test.js` | Existing AA02 tests after migrating `authApi` / `healthApi` to `apiClient` | Same results (unchanged contract) |
| UT11 | Lint — `npm run lint` | Direct `fetch` outside the client or an API-layer import from `auth` | ESLint reports the violation. |
| FT01 | Component — `App.test.jsx` | Direct `/register`, Google callback and unknown path | Registration and fallback render in `AppShell`. The callback posts once, clears the query and returns to the confirmed session. |
| FT02 | Component — `App.test.jsx` | Production API base fails configuration validation | Configuration error shown before the shell mounts; `fetch` never called |
| FT03 | Component — `App.test.jsx` | Lazy module loads or its loader rejects | An error stays inside the shell. Retrying invokes the loader again. |
| FT04 | Component — `App.test.jsx` | Loader resolves successfully, then the viewer fixture throws during render | Section error with retry; the recovered viewer uses the same mounted header |
| FT05 | Component — `App.test.jsx` | Staff or Manager opens viewer fixture. Manager opens planning fixture. Guest, Staff or Administrator attempts restricted routes. Recheck roles after a `403`. | Use the common shell and confirmed session. Allowed requests carry the bearer and original ID. Unauthorised modules stay unmounted. A revoked role hides its section while other roles remain available. |
| IT01 | Integration — `scripts/health.integration.mjs` | Request the health endpoint on the repository's Express app | HTTP `200`, `{ status: "ok" }`, configured CORS origin and `Cache-Control: no-store`. |
| IT02 | Build — CI `frontend-checks` | `npm ci && npm run lint && npm test && npm run build` on a clean runner | All steps succeed with the committed lockfile |
| IT03 | Build — CI secret scan | `dist/` scanned for secret names / private-key markers | No match; the job fails if a match is introduced |
| MT01 | Manual | Fresh clone → steps of the README (backend + frontend) | SPA on `http://localhost:5173`, *Backend: OK* |
| MT02 | Manual | Open a product page from the list, edit and save | URL and requests use the back-end id (`PROD-…`); list shows the saved values after save |
| MT03 | Manual | Stop the back end and navigate | The shell shows the connection error and retry control. Restarting and retrying restores the health indicator. |
| MT04 | Manual — pending on the target host | Serve the production bundle and reload `/register` | The actual host serves the SPA fallback. The configured API health URL returns JSON. |
| MT05 | Manual – **deferred** until WEB06 / VIS01 / WEB07 / AI05 / AI06 contracts exist (OP1) | Navigate to kitchen viewer and planning page as Manager | Same header, menu and session; network tab shows calls only to the back-end origin, with the bearer token on protected calls (no request to the AI service) |
| MT06 | Manual — Google sign-in | Sign in using Google after applying the branch migrations | Callback completes and the user returns to the SPA with a valid session. |

Acceptance-criteria traceability:

| AC | Main scenarios |
| --- | --- |
| AC1 | FT01, FT05, MT05, MT06 |
| AC2 | UT11, UT10, IT02 |
| AC3 | UT03, UT04, UT05, UT06, UT07, UT08, IT01, MT02, MT03, MT06 |
| AC4 | IT02, MT01, MT04 |
| AC5 | FT03, FT04, FT05 (shell integration, in WEB01); MT05 (end-to-end, after OP1) |
| AC6 | UT01, UT02, UT09, FT02, IT03, MT04 |

### 4.2. Sample Test Implementations

- [Configuration validation](../../../frontend/src/config/appConfig.test.js) covers defaults, invalid production URLs and timeout values.
- [REST client tests](../../../frontend/src/api/apiClient.test.js) cover path validation, query encoding, bearer headers, empty responses, failure classification and cancellation.
- [SPA tests](../../../frontend/src/App.test.jsx) cover invalid configuration, routing, the Google callback, module permissions and recovery after load or render failures.

---

## 5. Implementation

### 5.1. File Structure

Key implementation files:

```text
.github/workflows/main.yml                      frontend verification job
frontend/
├── .nvmrc                                      pinned frontend Node version
├── .env.example                                public settings template
├── README.md                                   run, build, deployment and module integration
├── eslint.config.js                            REST and import boundary checks
├── jest.config.cjs                             JavaScript and JSX test discovery
├── scripts/
│   ├── check-bundle-secrets.mjs                  bundle marker scan
│   └── health.integration.mjs                   Express API smoke test
└── src/
    ├── main.jsx                                renders App
    ├── App.jsx                                 configuration, provider, router and shell
    ├── App.test.jsx                             routing and module fixtures
    ├── app/                                    module route policy, lazy slot and error boundary
    ├── api/                                    apiClient and ApiError
    ├── config/appConfig.js                      public settings validation
    ├── healthApi.js                             health endpoint adapter
    ├── authApi.js                               local account endpoint adapter
    ├── auth/                                    Google and session adapters, AuthProvider and guard
    └── visualization/README.md                  VIS01 integration notes
```

### 5.2. Core Implementation Highlights

The same `moduleRoutes` entries drive the menu and router for enabled modules. `App` accepts dynamic imports via its `modules` prop. The guard checks current roles before the loader runs. The loaded component receives a session-bound `request(method, path, options)`.

The application uses the existing AA04 restore, renewal and logout lifecycle. The Google callback uses router navigation to remove the query and return to the start page. Successful configuration and API calls are exercised by the tests in section 4.

---

## 6. Integration, Verification & Demonstration

### 6.1. Running the Automated Tests

```bash
cd frontend
npm ci
npm run lint
npm test -- --runInBand
npm --prefix ../backend ci
npm run test:integration
VITE_BACKEND_BASE_URL=/api/v1 npm run build
npm run check:bundle
```

See the [frontend README](../../../frontend/README.md) for the PowerShell build command and configuration by environment.

### 6.2. Manual Verification & OpenAPI Contract

1. Start PostgreSQL using the [infrastructure instructions](../../../infra/README.md). Use a local database compatible with the branch migration history, then run `npm ci`, `npm run db:migrate` and `npm run dev` in `backend/`.
2. `cd frontend && cp .env.example .env && npm ci && npm run dev`; open `http://localhost:5173` and confirm *Backend: OK*.
3. Open Swagger UI (`http://localhost:8080/api-docs`) and compare one endpoint used by a real feature page when it is available with the request shown in the browser network tab (same path, same identifier, bearer header only when signed in).
4. Use MT02–MT06 for the corresponding integration scenarios. Start with a known route such as `/register` for the hosting check.
5. Build with the destination API URL and use MT04 against the actual host. `npm run preview` can check the local bundle. SYS01 verifies the deployment fallback and proxy.

**Verification recorded:** the clean install, lint, 90 Jest tests, Express health check, production build and bundle scan passed locally. The build rejected a missing API base and excluded an unrelated `VITE_*` test value. Google sign-in was confirmed in the browser after applying the migrations in a compatible local database. The configured GitHub Actions workflow has yet to be run on GitHub. The real WEB05 business operation, the actual 3D and planning modules, and the deployed host checks remain to be demonstrated.

---

## 7. Observations, Dependencies & Limitations

- **Dependencies:** WEB02 (layout, i18n and navigation accessibility), WEB03 (full role-based navigation), WEB04 (feedback), AA03 / AA04 (role and session lifecycle), WEB05 / WEB06 / WEB07 (feature pages and adapters), VIS01 (viewer loader), AI05 / AI06 (Prolog contracts) and SYS01 (deployment and static-host routing).
- **Alignment needed with other stories:**
  - **WEB03:** places `apiClient` in `src/api/apiClient.js` and assumes React Router – both confirmed by this design.
  - **AA04:** existing session adapters reuse the WEB01 client with the HttpOnly cookie and CSRF header. The provider continues to manage renewal and logout.
  - **AI05 / AI06:** the Back-End API invokes Prolog. Prolog retrieves planning data from the Back-End API using the AI06 contracts.
  - **WEB06 / VIS01 / WEB07 / AI05 / AI06 (OP1):** must define the routes, payloads and permissions behind `kitchenConfigurationApi` and `planningApi`, meeting the conditions in 3.4; until then those integrations are verified only with stubs (FT05) and MT05 stays pending.
  - **SYS01 / back end:** the deployed `CORS_ORIGIN` and `GOOGLE_REDIRECT_URI` must match the SPA origin of each environment; with a same-origin reverse proxy (`/api/v1`) CORS is not needed.
- **Open points:** OP1 (kitchen / planning endpoint contracts) is not closed; AC 5 is verified in WEB01 only for the shell integration, and end-to-end only after those stories deliver their contracts.
- **Known Limitations:** `VITE_*` values are fixed at build time, so each environment needs its own build (no runtime configuration file in Sprint 2). The ESLint import rules cover the specified REST and transport-layer import restrictions. The secret scan detects only known names / patterns; the main protection remains not putting secrets in `VITE_*` variables (BR 8).
