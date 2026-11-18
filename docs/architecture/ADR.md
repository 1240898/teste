# Architecture Decision Records

This document contains the major decisions moved out of the ADR table in [SAD.md](SAD.md). Each record explains the decision, why it was made, alternatives considered, trade-offs, and consequences, including downsides.

## ADR-001: Organize the repository as a monorepo

**Status:** Accepted  
**Decision area:** Sprint 1 - Repository

### Decision

Use one repository with a top-level folder for each deployable or cross-cutting area (`backend`, `frontend`, `ai`, `infra`, and `docs`). Keep the 3D visualization module in `frontend/src/visualization`, since it is part of the Front-End deployable.

### Reason

ENG01 requires a single repository and a single submission tag. A monorepo also simplifies cross-module refactoring, shared documentation, and end-to-end work across closely related modules.

### Alternatives considered

- Maintain a separate repository for each deployable or area.
- Put visualization in a top-level `visualization/` folder.

### Trade-offs

A monorepo makes CI configuration and ownership more complex, and unrelated changes share repository history. A separate repository structure can isolate ownership and pipelines, but makes coordinated changes and a single submission tag harder. A top-level visualization folder would conflict with its placement in the Front-End container.

### Consequences

Cross-area changes can be reviewed and versioned together. CI and ownership rules need to account for multiple areas, and visualization stays coupled to frontend build and release concerns.

## ADR-002: Use domain-first modules with layered architecture

**Status:** Accepted  
**Decision area:** Sprint 1 - Initial Design

### Decision

Organize the backend by domain module, using Layered/Clean Architecture within each module (`domain`, `application`, `infrastructure`, `api`) and `src/shared/` for cross-cutting plumbing.

### Reason

This keeps bounded contexts cohesive while separating domain rules from HTTP, persistence, and framework details, allowing modules to evolve with less coupling.

### Alternatives considered

- Use one global `src/controllers` and `src/domain` tree across all features.
- Use a single layered structure organized by technical layer rather than domain.

### Trade-offs

Module boundaries and interfaces require initial setup and discipline; common plumbing can be duplicated if it is not placed appropriately in `src/shared/`. A global technical layout may be simpler initially, but mixes unrelated features and makes module ownership less clear.

### Consequences

Business logic remains grouped by domain and can be tested separately from adapters. Contributors must follow module boundaries and avoid turning shared plumbing into a dependency for domain-specific rules.

## ADR-003: Standardize APIs on REST and JSON

**Status:** Accepted  
**Decision area:** Sprint 1 - API Standards

### Decision

Format APIs as RESTful interfaces with JSON payloads and document them with OpenAPI/Swagger.

### Reason

REST and JSON provide a broadly understood, machine-readable contract for integration with the web application, 3D visualization, and future AI scheduling modules.

### Alternatives considered

- Use ad hoc endpoints and payload formats without a formal API description.
- Use another protocol or a remote procedure call style interface.

### Trade-offs

REST/JSON is broadly interoperable but can require several requests for a workflow that a specialized interface could handle in one operation. OpenAPI documentation improves discoverability but must be updated with API changes.

### Consequences

Clients can integrate against a documented interface. API evolution requires maintaining the OpenAPI contract and managing compatibility when endpoints or payloads change.

## ADR-004: Run automated checks in GitHub Actions

**Status:** Accepted  
**Decision area:** Sprint 1 - Quality Assurance (ARC05)

### Context

The backend requires unit and database-backed integration checks, and the frontend needs compilation validation. The checks should run consistently in a repeatable environment.

### Decision

Use [`.github/workflows/main.yml`](../../.github/workflows/main.yml) to run CI on a daily schedule and by manual `workflow_dispatch`. The backend job installs dependencies, runs database migrations against a PostgreSQL 18 service, and runs `npm run test:coverage`. The frontend job installs dependencies and runs `npm run build`.

### Reason

Automating the checks helps detect regressions in domain invariants, API validation, database integration, and frontend compilation. A PostgreSQL service in CI makes database tests repeatable without relying on a developer's local database.

### Alternatives considered

- Run checks manually or only on developer machines.
- Use a different CI provider.
- Trigger checks on each push or pull request instead of the current schedule/manual triggers.

### Trade-offs

Automated CI uses runner time and requires workflow maintenance. The current daily/manual triggers do not validate each push or pull request immediately, so a change can be merged before the next scheduled run unless someone dispatches the workflow. Running on every push or pull request would provide faster feedback but consume more CI resources.

### Consequences

Backend tests and frontend build checks run in a consistent GitHub-hosted environment. Developers can start a run manually, but immediate per-change feedback depends on manual dispatch or waiting for the daily schedule.

## ADR-005: Use PostgreSQL and MongoDB for different data needs

**Status:** Superseded by [ADR-010](#adr-010-use-postgresql-as-the-single-database) 
**Decision area:** Sprint 1 - Persistence Strategy

### Decision

Use PostgreSQL for core transactional business data and MongoDB for 3D visual configurations, coordinates, and related flexible metadata.

### Reason

PostgreSQL provides ACID transactions, foreign keys, and referential integrity for the catalogue, allergens, sizes, stock, orders, and users (ARC04). MongoDB's document model fits variable 3D spatial coordinates, mesh metadata, and scene layouts (SGRAI).

### Alternatives considered

- Store all data in PostgreSQL.
- Store all data in MongoDB.

### Trade-offs

Polyglot persistence allows each data set to use a suitable model, but adds operational, backup, monitoring, and integration complexity. Using one database would reduce operational burden, but would make either relational integrity or flexible 3D document storage less natural.

### Consequences

The Back-End API must integrate with and manage two database technologies. Relational business data uses PostgreSQL constraints and transactions; the 3D data model can evolve flexibly in MongoDB, with additional responsibility for consistency and backup across both stores.

## ADR-006: Secure authentication with bcrypt and JWTs

**Status:** Accepted  
**Decision area:** Sprint 1 - BCK01 Authentication

### Decision

Hash passwords with bcrypt. Use JWTs with explicit issuer and audience and a configured lifetime capped at one day. Resolve current account status and roles on protected requests.

### Reason

This preserves the BCK01/course authentication approach while ensuring committed account deactivation and role changes apply on the next authorization lookup. Plaintext passwords and credential hashes are excluded from API projections.

### Alternatives considered

- Store plaintext passwords or reversible password encryption.
- Rely entirely on role and status claims in stateless tokens.

### Trade-offs

Database lookups keep authorization current but add latency and make protected requests dependent on database availability. JWTs allow token-based authentication, but a token can remain valid until expiry; the configured maximum lifetime limits that window. Bcrypt hashing also adds computation to login verification.

### Consequences

Password material is not exposed as plaintext through storage or API projections, and role/account changes take effect on the next protected-request lookup. Protected requests incur a database lookup, and users may need to authenticate again after token expiry.

# ADR-007: Host Shared PostgreSQL Separately on the DEI Infrastructure

**Status:** Accepted  
**Decision Area:** Sprint 2 – Deployment and Persistence

### Decision

Deploy a shared PostgreSQL 18 database using the DEI infrastructure template as an independent service for integration and demonstration environments.

Deploy the backend and frontend independently from the database service, maintaining separate deployment lifecycles.

Retain local databases for individual development and isolated databases for automated testing.

Configure database connections through environment variables, without committing credentials or other sensitive configuration values to version control.

Manage database schema changes through version-controlled migrations to ensure consistency across environments.

### Reason

The DEI PostgreSQL template provides a preconfigured database environment with a static internal endpoint and persistent storage.

Using this infrastructure reduces provisioning effort, centralizes shared application data and separates database resource management from application deployment.

This separation also allows the application components to be deployed or updated without necessarily recreating the database service.

This is an architectural decision made by the team rather than an explicit requirement of SYS01.

### Alternatives Considered

- **Host the application and PostgreSQL together on the Debian VM:** Simplifies network communication but couples application and database resource management and deployment lifecycles.
- **Use an external managed database service:** May provide additional management and operational capabilities but introduces external dependencies and potentially additional costs.
- **Use only individual local databases:** Simplifies individual development but complicates shared integration, consistent demonstrations and collaborative testing.

### Trade-offs

- Separate hosting introduces network configuration requirements, communication latency and an additional service to maintain.
- Backend availability depends on database connectivity and service availability.
- Independent deployment does not automatically provide high availability, redundancy or failover.
- Persistent storage does not replace database backup and recovery mechanisms.

### Consequences

- The backend connects to PostgreSQL through the internal DEI network.
- The frontend and Prolog components access business data through backend APIs rather than connecting directly to the database.
- Database access must be restricted to authorized application and administrative clients.
- A dedicated database role with minimum required privileges must be used by the deployed backend.
- Database credentials and connection parameters must be managed through environment-specific configuration.
- Schema changes must be applied using version-controlled database migrations.
- Database persistence, backup and recovery procedures must be considered as part of infrastructure maintenance.
- Deployment documentation must describe database connectivity, required environment variables and initialization procedures.
- PostgreSQL version compatibility must be validated across development, CI and deployment environments.

## ADR-008: Use Google Identity Services for External Authentication

**Status:** Accepted  
**Decision Area:** Sprint 2 – AA02 External Identity Provider Integration

### Decision

Use Google Identity Services as the external identity provider for the LaPrizza Web Application, integrating authentication through OpenID Connect (OIDC) and OAuth 2.0.

External authentication will coexist with the existing local authentication mechanism.

The backend will validate the externally authenticated identity and integrate it with the existing internal account, role resolution, activation and JWT-based authentication mechanisms.

Google will be responsible for authenticating the external identity, while LaPrizza will remain responsible for managing internal accounts, roles, permissions and application access.

### Reason

AA02 requires integration with an external identity provider using OpenID Connect with OAuth 2.0, or an equivalent supported mechanism.

Google Identity Services provides a widely adopted, standards-based authentication solution that supports secure user authentication without requiring the application to collect or store external passwords.

It is suitable for the LaPrizza context, where customers and restaurant personnel may authenticate using existing Google accounts.

The service also provides a straightforward integration path for the existing Web Application and backend architecture, while allowing the project to preserve its internal authorization model.

Additionally, Google Identity Services provides the authentication functionality required for this User Story without licensing costs.

### Alternatives Considered

- **Microsoft Entra ID:** Supports OIDC and OAuth 2.0 and provides enterprise identity management capabilities, but introduces additional configuration complexity that is not necessary for the current prototype.

- **Auth0:** Provides authentication services and integration with multiple identity providers, but introduces an additional intermediary service, pricing considerations, and configuration dependencies.

- **Keycloak:** Offers an open-source identity and access management solution with OIDC support and greater control over authentication infrastructure, but requires additional deployment, configuration, and maintenance.

### Trade-offs

- Using Google Identity Services introduces a dependency on an external service and requires internet connectivity for external authentication.
- Users must have a Google account to use this authentication method, although local authentication remains available.
- Google OAuth credentials, authorized origins, and redirect URIs must be configured and maintained for each applicable environment.
- External identity verification must be integrated carefully with existing internal accounts to avoid duplicate accounts or unauthorized account linking.
- Google authentication does not replace the internal account activation, role resolution, or authorization mechanisms.
- The application must handle authentication failures, cancelled authentication attempts, and temporary Google service unavailability.

### Consequences

- The Web Application will offer Google authentication alongside the existing local login mechanism.
- The authentication flow will use OIDC and OAuth 2.0, with secure validation of the external identity by the backend.
- Google passwords will never be collected or stored by LaPrizza.
- External identities will be associated with internal user accounts using a verified, provider-specific identity identifier.
- Internal roles and account status will continue to be managed by the LaPrizza backend, independently of Google.
- On the first successful external authentication of an unknown identity, an account with the Customer role is created automatically and activated, without an invitation (client clarification). Accounts created by an Administrator keep the invitation-based activation defined in AA06 and AA07.
- The existing JWT-based authentication and authorization approach established in ADR-006 will be preserved where applicable.
- Logout will terminate the LaPrizza application session without requiring the user's Google account session to be terminated.
- The implementation will require environment-specific Google OAuth configuration and appropriate documentation of the authentication flow.
- Local authentication will remain available if users do not wish to authenticate through Google or if the external provider is unavailable.

## ADR-009: Use SMTP with Mailpit and Brevo for Transactional Email

**Status:** Accepted  
**Decision Area:** Sprint 2 – Trasactional Email

### Context

The system needs to send transactional messages, including account activation invitations and password-recovery messages. The existing system architecture models the Back-End API communicating with an Email Service over SMTP. Development and automated testing need a safe, repeatable way to inspect messages without delivering them to real recipients.

### Decision

Use SMTP as the email transport interface from the Back-End API. Use Mailpit as the SMTP server for local development and automated test environments, where it captures messages for inspection instead of delivering them to external recipients. Use Brevo's SMTP relay for deployed demonstration and production environments that need to deliver messages to real recipients.

Keep SMTP connection details in environment-specific configuration. Brevo's SMTP credentials and sender configuration must be provisioned for the deployed environment, and the sender address or domain must be verified before sending. Mailpit remains a capture service and is not used for delivery to real recipients.

Email sending must be behind a backend adapter so the application workflows depend on an internal email interface rather than Mailpit-specific APIs. Delivery failures must be surfaced to the relevant workflow so invitation delivery can be retried while the account remains inactive.

### Reason

SMTP provides a standard integration boundary already reflected in the SAD and allows the backend to use the same message-sending interface across environments. Mailpit provides a local SMTP sink that makes message content and delivery attempts inspectable while preventing accidental emails to real users during development and tests. Brevo offers a transactional SMTP relay suitable for the project's expected low message volume. Separating the adapter from the SMTP server keeps the application independent of a particular provider.

### Alternatives Considered

- **Send through a transactional provider SDK directly:** May expose provider-specific features, but couples application code to a vendor and requires separate development/test arrangements.
- **Use Mailpit in every environment:** Simple for local inspection, but Mailpit captures messages and does not provide production delivery to recipients.
- **Use another transactional email provider, such as Amazon SES or Resend:** Both can support programmatic email delivery, but would require a separate account and sender setup; Brevo is selected for this project as a straightforward SMTP relay for low-volume transactional email.
- **Use a different local SMTP sink:** Could provide similar capture behavior, but would add another tool choice without improving the existing SMTP-based architecture.
- **Use a production provider's sandbox for development:** Offers provider-realistic behavior, but needs credentials and external connectivity and can make routine local and CI work dependent on an external service.

### Trade-offs

- SMTP keeps the integration portable, but provider-specific capabilities may not be available through the common interface.
- Mailpit makes local and test messages easy to inspect, but those environments do not prove external deliverability, sender reputation, or production provider configuration.
- A real provider introduces external availability, credentials, delivery limits, and potentially cost; these require environment-specific operational configuration.
- Brevo's free plan currently allows up to 300 email sends per day and includes Brevo branding in sent emails. The limit is adequate for the expected prototype/demo volume, but a paid plan or another provider may be needed if volume grows or branding must be removed.
- Retrying delivery needs application-level handling and must avoid duplicating or reusing expired or superseded invitations.

### Consequences

- The Back-End API will send transactional messages through an email adapter using SMTP.
- Local development and automated tests can route messages to Mailpit and inspect them through its interface without contacting real recipients.
- Production and shared demonstration deployments use Brevo's SMTP relay, configured through environment-specific endpoint, authentication, and TLS settings.
- Deployment setup must verify the sender address or domain and document Brevo's sending limits and free-plan branding.
- Credentials and other sensitive mail configuration must not be committed to version control.
- Email content and delivery outcomes must be tested separately from successful capture by Mailpit; capture alone does not establish production delivery.
- The existing C4 email-service relationship remains expressed as SMTP; deployment-specific SMTP endpoints determine whether messages are captured or delivered.

## ADR-010: Use PostgreSQL as the single database

**Status:** Accepted (supersedes ADR-005)  
**Decision Area:** Sprint 2 – Persistence Strategy

### Context

ADR-005 planned MongoDB for 3D visual configurations, coordinates and asset metadata, next to PostgreSQL for the transactional business data. MongoDB was never introduced: the Back-End API, the migrations, the test setup, `infra/compose.yaml` and the DEI deployment (ADR-007) use only PostgreSQL, and the C4 container and component diagrams already show a single relational database. Sprint 2 introduces the first 3D data (WEB06 kitchen configurations and the kitchen asset catalogue), so the persistence decision for that data has to be settled now.

The 3D data has strong consistency needs: exactly one active kitchen configuration, activation as a single consistent operation, no deletion of the active configuration, no replacement of the last valid configuration by an invalid one, protection against concurrent edits and references to existing assets (WEB06).

### Decision

Use **PostgreSQL as the only database** of the LaPrizza system, including 3D data. MongoDB is not used.

- Data that is queried or constrained is stored in normal columns with constraints (identifiers, names, status, versions, audit fields, asset references).
- Document-like 3D content that is always read and replaced as a whole and has its own versioned format (for example the WEB06 kitchen layout) is stored in a `JSONB` column, validated by the back end before it is written.
- Invariants that cross rows are enforced with transactions and constraints (for example a partial unique index for "at most one active kitchen configuration" and foreign keys from configurations to the asset catalogue).
- Model and texture files are not stored in the database; they are files deployed with the Back-End API and served read-only, and only their metadata is kept in PostgreSQL.

### Reason

The 3D data needs the same guarantees as the rest of the business data (ACID transactions, unique constraints, foreign keys, ARC04), and keeping it in the same database allows one transaction to cover it. `JSONB` gives enough flexibility for layouts whose structure evolves through a versioned JSON format. A single database also keeps deployment, backups and recovery (SYS01, SYS07, SYS08), monitoring, local setup and CI to one technology, which suits the size of the team and of the data.

### Alternatives Considered

- **Keep ADR-005 (PostgreSQL + MongoDB):** flexible document storage for 3D data, but adds a second database to deploy, secure, back up and restore, and cannot enforce consistency between the two stores in one transaction (for example activation or references to assets).
- **Store all data in MongoDB:** rejected for the reasons already given in ADR-005 (relational integrity of catalogue, stock, users and orders).
- **Fully normalised tables for every 3D element:** strongest typing, but every change to the layout format needs a migration and many joins, without any query that needs element-level access.

### Trade-offs

- `JSONB` content is not checked by the database beyond basic type checks; the back end must validate it completely before writing (WEB06 `KitchenLayoutValidator`).
- Queries inside the JSON content are less natural than in a document database; this is acceptable because the content is read and replaced as a whole.
- Large 3D files stay outside the database, so their presence must be checked separately from the database references.

### Consequences

- The Back-End API uses only the PostgreSQL driver and the existing persistence layer (`createDatabase`, `PostgresUnitOfWork`, migrations under `backend/migrations`).
- New 3D data is added through normal migrations and is covered by the existing PostgreSQL backup and restore procedures.
- The SAD lists a single Relational Database container; the *Non-Relational Database* container and the *Polyglot persistence* boundary are removed.
- User Stories that referred to ADR-005 for 3D data (WEB06, VIS01) refer to this ADR instead.

## ADR-011: Deploy application modules to the DEI VM through GitHub Actions

**Status:** Accepted

**Decision Area:** Sprint 2 – SYS01 Automated Deployment and Validation

### Context

SYS01 requires an automated, repeatable deployment of at least one system module to a controlled DEI environment, followed by validation and retention of deployment evidence. The team has selected the DEI VM as that deployment target.

The VM is reachable only through the DEI network by default. The client clarification for SYS01 states that a GitHub-hosted runner can deploy to it over SSH only if external SSH access is enabled for the VM and a secure authentication mechanism is used.

### Decision

Use a GitHub Actions workflow with a GitHub-hosted runner to build, validate and deploy the selected application module(s) to the DEI VM over SSH. External SSH reachability for the VM is a prerequisite for this deployment path; the pipeline must not assume that a private address is reachable from a public runner.

The workflow must deploy an identifiable revision (at minimum, the source commit SHA) and its matching environment configuration. It must run the configured validation before reporting the deployment as successful, retain deployment logs and validation results as workflow artifacts, and provide a documented recovery procedure for returning to a previously working revision.

SSH credentials and deployment configuration containing secrets must be supplied through GitHub's secret-management facilities or an equivalent protected environment mechanism. They must not be committed to the repository or written to retained logs. The workflow schedule must be configurable in version-controlled workflow settings. The application deployment does not provision or replace the shared PostgreSQL service.

### Reason

The DEI VM provides the controlled department environment requested for SYS01 and a concrete destination for repeatable integration and demonstration deployments. A GitHub-hosted runner keeps workflow execution in GitHub Actions without requiring a self-hosted runner on the VM. SSH provides the deployment channel identified by the client clarification, provided the VM is made externally reachable over SSH.

### Alternatives Considered

- **Deploy only to a local or CI environment:** avoids configuring access to the DEI network, but does not satisfy the selected controlled DEI deployment target.
- **Install a self-hosted GitHub Actions runner on the VM:** could access private DEI resources directly, but this option is unavailable under the current organization policy and is not needed if SSH access is enabled.
- **Use a GitHub-hosted runner without enabling a route to the VM:** cannot reach a private-only address and therefore cannot perform the deployment.
- **Deploy to an external cloud or managed platform:** could provide a reachable target, but would add a different hosting environment and would not use the selected DEI VM.
- **Host PostgreSQL on the application VM:** would simplify some network paths but couple application deployment to database lifecycle and conflict with the separate shared database decision in ADR-007.

### Trade-offs

- The deployment depends on external SSH access being enabled and maintained for the VM. If that access is unavailable, this workflow cannot deploy until an approved connectivity path is provided.
- SSH exposure and deployment credentials require careful restriction and rotation; GitHub secret storage protects credential values but does not by itself secure the VM or workflow permissions.
- A single VM is a limited-capacity deployment target and does not provide high availability or automatic failover.
- Post-deployment checks can identify a failed deployment, but recovery still depends on retaining a usable prior revision and following the documented recovery procedure.
- Workflow artifacts improve traceability but need an explicit retention period and must not contain secrets.

### Consequences

- The DEI VM is the shared deployment target for the SYS01 application increment; local development and CI validation remain available independently.
- The GitHub Actions workflow must define its triggers and configurable schedule, pre-deployment checks, SSH deployment, post-deployment validation, artifact retention and failure reporting.
- The VM's SSH host identity must be verified by the workflow; host-key verification must not be bypassed to make deployment succeed.
- Workflow access must use narrowly scoped deployment credentials and must not print secrets into logs.
- Deployment records identify the deployed source revision and non-secret configuration version or identity.
- A failed validation must produce a failed workflow result and must not be presented as a successful deployment.
- Recovery instructions must identify how to redeploy a previous working revision and how to verify recovery.
- The backend continues to connect to the separately hosted PostgreSQL service; application deployment must not reset or recreate its persistent data.
- Deployment access to the VM over SSH is an administrative channel and must be treated separately from access to the deployed application. SYS02's internal-network/VPN restrictions continue to govern application access.
- SYS01 implementation documentation must record the VM prerequisites, selected modules, workflow entry points, validation commands, artifact retention, secret names (not values), and recovery steps.
