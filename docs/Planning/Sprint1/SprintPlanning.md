# Sprint Planning – Sprint 1

## 1. General Information

**Sprint Planning Date:** 14-09-2026

**Sprint Duration:** 6 weeks (14-09-2026 to 25-10-2026)

**Scrum Master:** Paulo Sérgio dos Santos Matos

**Sprint Master:** Francisco Sá

### Development Team

| Name                | Mechanographic Number |
|---------------------|-----------------------|
| **Sofia Carvalho**  | 1240898               |
| **Francisco Sá**    | 1241341               |
| **Leonor De Moura** | 1240914               |
| **Mariana Moreira** | 1240905               |

---

# 2. Sprint Goal

> Set up the project's repository, development environment, and engineering practices, define the core domain model and system architecture, and implement the first set of LaPrizza back-end business capabilities — exposed through a persistent, tested REST API — providing a coherent foundation for the functionality and integrations introduced in subsequent sprints.

---

# 3. User Stories

| US    | Description                                       |
|-------|---------------------------------------------------|
| ENG01 | Project repository and development environment    |
| ENG02 | Sprint planning and project monitoring            |
| ENG03 | Self and peer evaluation                          |
| BCK01 | User and authentication management                |
| BCK02 | Customer management                               |
| BCK03 | Product category management                       |
| BCK04 | Allergen management                               |
| BCK05 | Product management                                |
| BCK06 | Pizza size management                             |
| BCK07 | Pizza component type management                   |
| BCK08 | Pizza component configuration                     |
| BCK09 | Stock information management                      |
| BCK10 | Predefined pizza management                       |
| BCK11 | Product catalogue and product information         |
| ARC01 | Core domain analysis and modelling                |
| ARC02 | System architecture                               |
| ARC03 | REST API                                          |
| ARC04 | Persistence and data integrity                    |
| ARC05 | Automated testing                                 |

---

# 4. User Stories Breakdown into Tasks

## ENG01 – Project Repository and Development Environment

| # | Task                                                                                              | Status  | Responsible      | Depends on      |
|---|---------------------------------------------------------------------------------------------------|---------|------------------|-----------------|
| 1 | Create GitHub repository under DEI organization (naming convention `LEI-SEM5-PI-2026-27-XXX-YY`)  | To Do   | All team members | —               |
| 2 | Define repository structure to accommodate applications, modules, technologies, and documentation | To Do   | All team members | Task 1          |
| 3 | Define and document branching and integration strategy                                            | To Do   | All team members | Task 1          |
| 4 | Set up issue/task tracking and project board                                                      | To Do   | All team members | Task 1          |
| 5 | Document project structure and development environment setup                                      | To Do   | All team members | Tasks 2, 3      |
| 6 | Tag repository at end of sprint (`sprint-1-submission`) and submit archive on Moodle              | To Do   | All team members | All Sprint 1 US |

---

## ENG02 – Sprint Planning and Project Monitoring

| # | Task                                                                  | Status  | Responsible      | Depends on     |
|---|-----------------------------------------------------------------------|---------|------------------|----------------|
| 1 | Analyse and decompose Sprint 1 User Stories into tasks                | To Do   | All team members | —              |
| 2 | Assign status and responsible member(s) to each task                  | To Do   | All team members | Task 1         |
| 3 | Identify dependencies between relevant tasks                          | To Do   | All team members | Task 1         |
| 4 | Keep project board updated throughout the sprint                      | To Do   | All team members | ENG01 (Task 4) |
| 5 | Associate implementation work with corresponding tasks/User Stories   | To Do   | All team members | Task 4         |
| 6 | Maintain evidence of development process and individual contributions | To Do   | All team members | Task 4         |

---

## ENG03 – Self and Peer Evaluation

| # | Task                                                 | Status  | Responsible      | Depends on  |
|---|------------------------------------------------------|---------|------------------|-------------|
| 1 | Complete individual self-evaluation for Sprint 1     | To Do   | All team members | ENG02       |
| 2 | Evaluate the contribution of every other team member | To Do   | All team members | ENG02       |
| 3 | Submit evaluation within the established deadline    | To Do   | All team members | Tasks 1, 2  |

---

## BCK01 – User and Authentication Management

| # | Task                                                                  | Status  | Responsible      | Depends on  |
|---|-----------------------------------------------------------------------|---------|------------------|-------------|
| 1 | Design user and role model                                            | To Do   | All team members | ARC01       |
| 2 | Implement user registration and management                            | To Do   | All team members | Task 1      |
| 3 | Implement authentication with credentials                             | To Do   | All team members | Task 2      |
| 4 | Ensure invalid authentication attempts are rejected                   | To Do   | All team members | Task 3      |
| 5 | Apply appropriate security practices to credential storage            | To Do   | All team members | Task 2      |
| 6 | Design role model as foundation for future authorization requirements | To Do   | All team members | Task 1      |

---

## BCK02 – Customer Management

| # | Task                                                                    | Status  | Responsible     | Depends on  |
|---|-------------------------------------------------------------------------|---------|-----------------|-------------|
| 1 | Implement creation and update of customer records                       | To Do   | Mariana Moreira | ARC01       |
| 2 | Implement unique customer identifier and contact-information validation | To Do   | Mariana Moreira | Task 1      |
| 3 | Implement customer search by identifying information                    | To Do   | Mariana Moreira | Task 1      |
| 4 | Represent dietary restrictions associated with a customer               | To Do   | Mariana Moreira | Task 1      |
| 5 | Ensure referenced customer information cannot be inconsistently removed | To Do   | Mariana Moreira | Task 1      |

---

## BCK03 – Product Category Management

| # | Task                                                                       | Status  | Responsible     | Depends on             |
|---|----------------------------------------------------------------------------|---------|-----------------|------------------------|
| 1 | Implement CRUD for Product Categories                                      | To Do   | Leonor De Moura | ARC01                  |
| 2 | Associate products with a Product Category                                 | To Do   | Leonor De Moura | Task 1, BCK05 (Task 1) |
| 3 | Implement search by identifying information                                | To Do   | Leonor De Moura | Task 1                 |
| 4 | Prevent inconsistent removal of categories referenced by existing products | To Do   | Leonor De Moura | Task 1                 |

---

## BCK04 – Allergen Management

| # | Task                                                                                  | Status  | Responsible     | Depends on             |
|---|---------------------------------------------------------------------------------------|---------|-----------------|------------------------|
| 1 | Implement catalogue of allergens (CRUD)                                               | To Do   | Leonor De Moura | ARC01                  |
| 2 | Associate allergens with products (one or more)                                       | To Do   | Leonor De Moura | Task 1, BCK05 (Task 1) |
| 3 | Implement search by identifying information                                           | To Do   | Leonor De Moura | Task 1                 |
| 4 | Prevent inconsistent removal of allergens referenced by existing business information | To Do   | Leonor De Moura | Task 1                 |

---

## BCK05 – Product Management

| # | Task                                                                              | Status  | Responsible     | Depends on    |
|---|-----------------------------------------------------------------------------------|---------|-----------------|---------------|
| 1 | Implement creation and update of products (identifier, name, description)         | To Do   | Leonor De Moura | ARC01         |
| 2 | Associate product with Product Category                                           | To Do   | Leonor De Moura | Task 1, BCK03 |
| 3 | Implement sellable / stock-controlled / pizza-component designations (combinable) | To Do   | Mariana Moreira | Task 1        |
| 4 | Associate Pizza Component products with exactly one Pizza Component Type          | To Do   | Mariana Moreira | Task 3, BCK07 |
| 5 | Implement commercial information for sellable products                            | To Do   | Leonor De Moura | Task 3        |
| 6 | Associate products with allergens                                                 | To Do   | Mariana Moreira | Task 1, BCK04 |
| 7 | Implement product search and filtering                                            | To Do   | Leonor De Moura | Task 1        |
| 8 | Support deactivating products without losing historical information               | To Do   | Mariana Moreira | Task 1        |
| 9 | Ensure consistency of existing relationships on product changes                   | To Do   | Leonor De Moura | Tasks 1–8     |

---

## BCK06 – Pizza Size Management

| # | Task                                                                              | Status  | Responsible     | Depends on  |
|---|-----------------------------------------------------------------------------------|---------|-----------------|-------------|
| 1 | Implement CRUD for Pizza Sizes                                                    | To Do   | Mariana Moreira | ARC01       |
| 2 | Make Pizza Sizes available for use in pizza-related configurations                | To Do   | Mariana Moreira | Task 1      |
| 3 | Implement search by identifying information                                       | To Do   | Mariana Moreira | Task 1      |
| 4 | Ensure Pizza Sizes can evolve without compromising existing business information  | To Do   | Mariana Moreira | Task 1      |
| 5 | Prevent inconsistent removal of sizes referenced by existing business information | To Do   | Mariana Moreira | Task 1      |

---

## BCK07 – Pizza Component Type Management

| # | Task                                                                                                                            | Status  | Responsible   | Depends on  |
|---|---------------------------------------------------------------------------------------------------------------------------------|---------|---------------|-------------|
| 1 | Implement CRUD for Pizza Component Types                                                                                        | To Do   | Sofia Carvalho  | ARC01       |
| 2 | Implement assembly order (unique per type) and min/max cardinality (max may be unbounded)                                       | To Do   | Sofia Carvalho  | Task 1      |
| 3 | Make Pizza Component Types configurable (not fixed in source code)                                                              | To Do   | Sofia Carvalho  | Task 1      |
| 4 | Seed initial configuration: Base Dough (1/1, order 1), Base Sauce (0/1, order 2), Cheese (0/1, order 3), Topping (0/∞, order 4) | To Do   | Sofia Carvalho  | Task 2, 3   |
| 5 | Implement search by identifying information                                                                                     | To Do   | Sofia Carvalho  | Task 1      |
| 6 | Prevent inconsistent removal of types referenced by existing business information                                               | To Do   | Sofia Carvalho  | Task 1      |

---

## BCK08 – Pizza Component Configuration

| # | Task                                                                                | Status  | Responsible   | Depends on           |
|---|-------------------------------------------------------------------------------------|---------|---------------|----------------------|
| 1 | Restrict Component Size Configurations to products designated as Pizza Components   | To Do   | Sofia Carvalho  | BCK05 (Task 3, 4)    |
| 2 | Implement association between Pizza Component and Pizza Size (at most one per pair) | To Do   | Sofia Carvalho  | Task 1, BCK06, BCK07 |
| 3 | Implement price definition per size                                                 | To Do   | Sofia Carvalho  | Task 2               |
| 4 | Implement stock-unit consumption definition per size, for stock-controlled products | To Do   | Sofia Carvalho  | Task 2               |
| 5 | Implement business validation rules for prices and stock-consumption values         | To Do   | Sofia Carvalho  | Tasks 3, 4           |
| 6 | Implement consultation of size-dependent configurations for a component             | To Do   | Sofia Carvalho  | Task 2               |
| 7 | Ensure consistency of existing business information on configuration changes        | To Do   | Sofia Carvalho  | Task 2               |

---

## BCK09 – Stock Information Management

| # | Task                                                                 | Status  | Responsible    | Depends on     |
|---|----------------------------------------------------------------------|---------|----------------|----------------|
| 1 | Restrict stock information to stock-controlled products              | To Do   | Francisco Sá | BCK05 (Task 3) |
| 2 | Implement current stock quantity (non-negative abstract stock units) | To Do   | Francisco Sá | Task 1         |
| 3 | Implement consultation of current stock level                        | To Do   | Francisco Sá | Task 2         |
| 4 | Implement stock search by product information                        | To Do   | Francisco Sá | Task 2         |
| 5 | Implement operations to increase/decrease stock quantity             | To Do   | Francisco Sá | Task 2         |
| 6 | Prevent stock reductions resulting in negative quantities            | To Do   | Francisco Sá | Task 5         |
| 7 | Validate consistency of resulting stock information on changes       | To Do   | Francisco Sá | Task 5         |

---

## BCK10 – Predefined Pizza Management

| # | Task                                                                                                     | Status  | Responsible    | Depends on    |
|---|----------------------------------------------------------------------------------------------------------|---------|----------------|---------------|
| 1 | Represent Predefined Pizza as a sellable product with a default configuration                            | To Do   | Francisco Sá | BCK05         |
| 2 | Implement default configuration composed of active Pizza Component products                              | To Do   | Francisco Sá | Task 1, BCK07 |
| 3 | Prevent duplicate components within the same default configuration                                       | To Do   | Francisco Sá | Task 2        |
| 4 | Validate default configuration against Pizza Component Type cardinality rules                            | To Do   | Francisco Sá | Task 2, BCK07 |
| 5 | Restrict availability to Pizza Sizes with corresponding Component Size Configurations for all components | To Do   | Francisco Sá | Task 2, BCK08 |
| 6 | Implement consultation of a Predefined Pizza's default configuration                                     | To Do   | Francisco Sá | Task 2        |

---

## BCK11 – Product Catalogue and Product Information

| # | Task                                                                                  | Status  | Responsible    | Depends on    |
|---|---------------------------------------------------------------------------------------|---------|----------------|---------------|
| 1 | Implement access to currently offered sellable products                               | To Do   | Francisco Sá   | BCK05         |
| 2 | Expose relevant product information (name, description, category, pricing, allergens) | To Do   | Francisco Sá   | Task 1        |
| 3 | Implement consultation of individual sellable product details                         | To Do   | Sofia Carvalho | Task 1        |
| 4 | Expose default configuration and available Pizza Sizes for Predefined Pizzas          | To Do   | Sofia Carvalho | Task 1, BCK10 |
| 5 | Ensure catalogue information is consistent with underlying business information       | To Do   | Francisco Sá   | Tasks 2, 3, 4 |

---

## ARC01 – Core Domain Analysis and Modelling

| # | Task                                                                                                                                                                                                                                                                       | Status  | Responsible      | Depends on              |
|---|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------|------------------|-------------------------|
| 1 | Analyse business concepts and relationships from PART II – System Specification                                                                                                                                                                                            | To Do   | All team members | —                       |
| 2 | Identify principal domain concepts, responsibilities, relationships, and business rules                                                                                                                                                                                    | To Do   | All team members | Task 1                  |
| 3 | Cover, at least: customers, dietary restrictions, products, categories, allergens, pizza sizes, component types, component size configurations, stock information, predefined pizzas, pizza configurations, orders, order items, preparation activities, kitchen resources | To Do   | All team members | Task 2                  |
| 4 | Distinguish domain concepts from implementation/persistence/presentation/infrastructure concerns                                                                                                                                                                           | To Do   | All team members | Task 2                  |
| 5 | Produce and maintain domain-modelling artefacts (e.g., domain diagram)                                                                                                                                                                                                     | To Do   | All team members | Task 3                  |
| 6 | Document modelling decisions and assumptions                                                                                                                                                                                                                               | To Do   | All team members | Task 5                  |
| 7 | Ensure implemented Sprint 1 model is consistent with the documented domain model                                                                                                                                                                                           | To Do   | All team members | Task 5, all BCK stories |

---

## ARC02 – System Architecture

| # | Task                                                                                                         | Status  | Responsible      | Depends on  |
|---|--------------------------------------------------------------------------------------------------------------|---------|------------------|-------------|
| 1 | Identify principal applications, modules, and external systems of the LaPrizza system                        | To Do   | All team members | ARC01       |
| 2 | Identify responsibilities of principal components and their interactions                                     | To Do   | All team members | Task 1      |
| 3 | Consider progressive integration of back-end, Web Application, 3D Visualization, and Artificial Intelligence | To Do   | All team members | Task 2      |
| 4 | Define layers/components of the Sprint 1 back-end and their responsibilities                                 | To Do   | All team members | Task 2      |
| 5 | Ensure appropriate separation of concerns (domain not coupled to presentation/persistence/infrastructure)    | To Do   | All team members | Task 4      |
| 6 | Identify and document dependencies between major components                                                  | To Do   | All team members | Task 4      |
| 7 | Document architectural decisions and rationale (ADRs)                                                        | To Do   | All team members | Tasks 1–6   |
| 8 | Produce architectural views/diagrams for technical documentation                                             | To Do   | All team members | Task 7      |

---

## ARC03 – REST API

| # | Task                                                                                   | Status  | Responsible      | Depends on             |
|---|----------------------------------------------------------------------------------------|---------|------------------|------------------------|
| 1 | Expose Sprint 1 business functionality through REST API endpoints                      | To Do   | All team members | ARC02, all BCK stories |
| 2 | Apply consistent resource/naming conventions and appropriate HTTP methods/status codes | To Do   | All team members | Task 1                 |
| 3 | Implement input validation before executing business operations                        | To Do   | All team members | Task 1                 |
| 4 | Ensure API operations preserve domain invariants and business rules                    | To Do   | All team members | Task 1, ARC01          |
| 5 | Design error responses that inform without exposing implementation details             | To Do   | All team members | Task 3                 |
| 6 | Document API contracts using a machine-readable format (e.g., OpenAPI)                 | To Do   | All team members | Task 2                 |
| 7 | Keep documentation consistent with implementation                                      | To Do   | All team members | Task 6                 |

---

## ARC04 – Persistence and Data Integrity

| # | Task                                                                          | Status  | Responsible      | Depends on     |
|---|-------------------------------------------------------------------------------|---------|------------------|----------------|
| 1 | Design persistence model for Sprint 1 business concepts and relationships     | To Do   | All team members | ARC01          |
| 2 | Enforce business identifiers and uniqueness constraints                       | To Do   | All team members | Task 1         |
| 3 | Preserve referential and business consistency across persisted relationships  | To Do   | All team members | Task 1         |
| 4 | Ensure persistence does not bypass domain invariants                          | To Do   | All team members | Task 1, ARC01  |
| 5 | Keep persistence concerns separated from domain/business logic                | To Do   | All team members | ARC02 (Task 5) |
| 6 | Implement reproducible mechanism for creating/evolving persistence structures | To Do   | All team members | Task 1         |
| 7 | Document persistence, mapping, and data-integrity decisions                   | To Do   | All team members | Tasks 1–6      |

---

## ARC05 – Automated Testing

| # | Task                                                                      | Status | Responsible      | Depends on             |
|---|---------------------------------------------------------------------------|--------|------------------|------------------------|
| 1 | Implement automated tests covering Sprint 1 domain and business rules     | To Do  | All team members | All BCK stories, ARC01 |
| 2 | Test relevant application and API behaviour                               | To Do  | All team members | ARC03                  |
| 3 | Include valid and invalid representative scenarios                        | To Do  | All team members | Task 1                 |
| 4 | Verify business invariants and validation rules                           | To Do  | All team members | Task 1, ARC01          |
| 5 | Ensure test suite is repeatable in any configured development environment | To Do  | All team members | Task 1                 |
| 6 | Keep test code under version control alongside production code            | To Do  | All team members | ENG01 (Task 1)         |
| 7 | Maintain testing evidence to support assessment                           | To Do  | All team members | Tasks 1–6              |

---

# 5. Definition of Done (DoD)

A User Story is considered completed when:

- Code is implemented and follows the domain concepts and business rules of PART II – System Specification
- Code compiles successfully
- Business functionality is exposed through the REST API and documented in a machine-readable format
- Business information is persistently and consistently stored
- Unit tests are implemented, cover relevant business rules, and are peer reviewed
- Build passes in the CI pipeline
- Documentation (domain model, architecture, ADRs, API) is updated accordingly
- Commit is pushed to the repository and associated with the corresponding task/User Story

---

# 6. Identified Risks

At this point of the sprint, we haven't identified any risks.