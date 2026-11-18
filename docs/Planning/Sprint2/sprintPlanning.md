# Sprint Planning – Sprint 2

## 1. General Information

**Sprint Planning Date:** 26-10-2026  
**Sprint Duration:** 4 weeks (26-10-2026 to 22-11-2026)  
**Scrum Master:** Paulo Matos  
**Sprint Master:** Sofia Carvalho

### Development Team

| Name | Mechanographic Number |
|---|---|
| Sofia Carvalho | 1240898 |
| Francisco Sá | 1241341 |
| Leonor De Moura | 1240914 |
| Mariana Moreira | 1240905 |

---

## 2. Sprint Goal

> Deliver the second integrated and demonstrable LaPrizza MVP by implementing a role-aware multilingual Single-Page Application, secure authentication and authorization, configurable 3D kitchen visualization, Prolog-based materials and requirements planning, and the necessary deployment, continuity and GDPR measures. Incorporate the corrective changes identified by the teaching staff during the Sprint 1 defense, preserving the existing domain model, APIs, persistence and architectural consistency.

## 3. Sprint Backlog

| US | Description | Team Member Responsible |
|---|---|---|
| WEB01 | SPA Setup and Integration | All Members |
| WEB02 | Consistent Layout and Navigation | Francisco Sá |
| WEB03 | Role-Based Navigation | Leonor de Moura |
| WEB04 | User Feedback and Validation | Sofia Carvalho |
| WEB05 | Sprint 1 Business Management Pages | Mariana Moreira |
| WEB06 | Kitchen Configuration and 3D Integration Page | Leonor de Moura & Mariana Moreira |
| WEB07 | Artificial Intelligence Configuration and Execution Page | Sofia Carvalho & Francisco Sá|
| AA01 | Local Authentication | Francisco Sá |
| AA02 | External Identity Provider Integration | Leonor de Moura |
| AA03 | Internal Role Resolution | Leonor de Moura |
| AA04 | Secure Session Handling | Sofia Carvalho |
| AA05 | Authorization Enforcement | Mariana Moreira |
| AA06 | Role Assignment and Activation Invitation | Sofia Carvalho |
| AA07 | Secure Account Activation | Francisco Sá |
| VIS01 | 3D Module Integration | All Members |
| VIS02 | Kitchen Layout and Equipment | Leonor de Moura |
| VIS03 | Automated Pizza Assembly Line Representation | Francisco Sá |
| VIS04 | Textures and Materials | Mariana Moreira |
| VIS05 | Scene Lighting | Sofia Carvalho |
| VIS06 | Interactive Light Controls | Sofia Carvalho & Francisco Sá |
| VIS07 | Perspective Camera Interaction | Leonor de Moura & Mariana Moreira |
| AI01 | Prolog Bill of Materials and Stock Requirements | All Members |
| AI02 | Prolog Requirements Planning and Supplier Selection | All Members |
| AI03 | Artificial Neural Networks Study | All Members |
| AI04 | IARTI Technical Report | All Members |
| AI05 | Artificial Intelligence Service Access | All Members |
| AI06 | Back-End Data and Prolog Knowledge Base | All Members |
| SYS01 | Automated Deployment and Validation | All Members |
| SYS02 | Institutional Network Access Restriction | Leonor de Moura |
| SYS03 | Configurable Allowed Endpoints | Sofia Carvalho |
| SYS04 | Shared Resource Folder | Francisco Sá |
| SYS05 | Controlled Linux Remote Shell Access | Mariana Moreira |
| SYS06 | Operational Risk Assessment | Mariana Moreira |
| SYS07 | Minimum Business Continuity Objective | Sofia Carvalho & Francisco Sá |
| SYS08 | Backup Strategy and Recovery Validation | Leonor de Moura & Mariana Moreira |
| GDP01 | Personal Data Handling | All Members |
| GDP02 | Data Processing Responsibility | All Members |
| GDP03 | Personal Data Breach Handling | All Members |

### Additional Sprint Commitments

| ID | Description | Responsible |
|---|---|---|
| IMP01 | Implement and validate the corrective changes requested by the teaching staff during the Sprint 1 defense | All team members |
| ENG02 (continuation) | Sprint planning, GitHub board monitoring, reviews and coordination | All team members |
| ENG03 (continuation) | Self and peer evaluation | All team members |

---

## 4. User Stories Breakdown into Tasks

### WEB – Front-end Web Application

#### WEB01 – SPA Setup and Integration

| # | Task | Responsible |
|---|---|---|
| 1 | Establish the SPA project structure, routing and environment configuration | All Members |
| 2 | Integrate a reusable API client with the existing back-end | All Members |
| 3 | Provide integration points for the 3D viewer and AI services | All Members |
| 4 | Document setup, configuration and local execution | All Members |
| 5 | Implement or collect applicable tests and acceptance evidence | All Members |
| 6 | Update technical documentation and submit for peer review | All Members |

#### WEB02 – Consistent Layout and Navigation

| # | Task | Responsible |
|---|---|---|
| 1 | Implement shared header, branding, navigation and page layout | Francisco Sá |
| 2 | Provide responsive desktop-first layouts and accessible controls | Francisco Sá |
| 3 | Support Portuguese and English with persistent language selection | Francisco Sá |
| 4 | Implement current-section indicators and return navigation | Francisco Sá |
| 5 | Implement or collect applicable tests and acceptance evidence | Francisco Sá |
| 6 | Update technical documentation and submit for peer review | Francisco Sá |

#### WEB03 – Role-Based Navigation

| # | Task | Responsible |
|---|---|---|
| 1 | Map authenticated roles and permissions to navigation items | Leonor de Moura |
| 2 | Protect routes against direct unauthorized URL access | Leonor de Moura |
| 3 | Show access-denied feedback without leaking protected information | Leonor de Moura |
| 4 | Verify role and account-status changes are enforced | Leonor de Moura |
| 5 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura |
| 6 | Update technical documentation and submit for peer review | Leonor de Moura |

#### WEB04 – User Feedback and Validation

| # | Task | Responsible |
|---|---|---|
| 1 | Implement reusable success, error, loading and empty-state components | Sofia Carvalho |
| 2 | Validate form fields and preserve input after errors | Sofia Carvalho |
| 3 | Prevent duplicate submissions and confirm destructive operations | Sofia Carvalho |
| 4 | Handle connection failures and safe retries | Sofia Carvalho |
| 5 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho |
| 6 | Update technical documentation and submit for peer review | Sofia Carvalho |

#### WEB05 – Sprint 1 Business Management Pages

| # | Task | Responsible |
|---|---|---|
| 1 | Create customer, category, allergen and product management pages | Mariana Moreira |
| 2 | Create pizza size, component type and configuration management pages | Mariana Moreira |
| 3 | Create stock, predefined pizza and catalogue pages | Mariana Moreira |
| 4 | Connect CRUD, search and filtering to existing REST endpoints | Mariana Moreira |
| 5 | Apply role permissions and verify business invariants | Mariana Moreira |
| 6 | Implement or collect applicable tests and acceptance evidence | Mariana Moreira |
| 7 | Update technical documentation and submit for peer review | Mariana Moreira |

#### WEB06 – Kitchen Configuration and 3D Integration Page

| # | Task | Responsible |
|---|---|---|
| 1 | Implement kitchen-configuration listing, CRUD and JSON import | Leonor de Moura & Mariana Moreira |
| 2 | Validate schema, references, dimensions and unique object identifiers | Leonor de Moura & Mariana Moreira |
| 3 | Implement atomic activation of exactly one valid configuration | Leonor de Moura & Mariana Moreira |
| 4 | Expose and consume the active configuration through back-end endpoints | Leonor de Moura & Mariana Moreira |
| 5 | Demonstrate configuration switching and invalid-input rejection | Leonor de Moura & Mariana Moreira |
| 6 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura & Mariana Moreira |
| 7 | Update technical documentation and submit for peer review | Leonor de Moura & Mariana Moreira |

#### WEB07 – Artificial Intelligence Configuration and Execution Page

| # | Task | Responsible |
|---|---|---|
| 1 | Implement consumption-forecast CRUD with date, size and quantity validation | Sofia Carvalho & Francisco Sá |
| 2 | Implement product JSON export and supplier-scenario JSON import | Sofia Carvalho & Francisco Sá |
| 3 | Validate supplier offers, references, prices and lead times | Sofia Carvalho & Francisco Sá |
| 4 | Execute planning scenarios and present versioned results | Sofia Carvalho & Francisco Sá |
| 5 | Demonstrate forecasts, supplier alternatives and unchanged stock | Sofia Carvalho & Francisco Sá |
| 6 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho & Francisco Sá |
| 7 | Update technical documentation and submit for peer review | Sofia Carvalho & Francisco Sá |

---

### AA – Authentication and Authorization

#### AA01 – Local Authentication

| # | Task | Responsible |
|---|---|---|
| 1 | Integrate local login with existing credentials and authentication services | Francisco Sá |
| 2 | Handle authentication failures without disclosing sensitive information | Francisco Sá |
| 3 | Test successful and unsuccessful authentication | Francisco Sá |
| 4 | Implement or collect applicable tests and acceptance evidence | Francisco Sá |
| 5 | Update technical documentation and submit for peer review | Francisco Sá |

#### AA02 – External Identity Provider Integration

| # | Task | Responsible |
|---|---|---|
| 1 | Configure the supported external identity provider and callback flow | Leonor de Moura |
| 2 | Validate external identity assertions and associate identities safely | Leonor de Moura |
| 3 | Test failed, cancelled and successful external sign-in | Leonor de Moura |
| 4 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura |
| 5 | Update technical documentation and submit for peer review | Leonor de Moura |

#### AA03 – Internal Role Resolution

| # | Task | Responsible |
|---|---|---|
| 1 | Resolve internal roles independently of the identity provider | Leonor de Moura |
| 2 | Ensure role and account-status changes are reflected in access decisions | Leonor de Moura |
| 3 | Test multiple-role and inactive-user scenarios | Leonor de Moura |
| 4 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura |
| 5 | Update technical documentation and submit for peer review | Leonor de Moura |

#### AA04 – Secure Session Handling

| # | Task | Responsible |
|---|---|---|
| 1 | Implement secure session creation, expiry and logout | Sofia Carvalho |
| 2 | Protect session credentials and mitigate session-related threats | Sofia Carvalho |
| 3 | Test session invalidation and protected requests | Sofia Carvalho |
| 4 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho |
| 5 | Update technical documentation and submit for peer review | Sofia Carvalho |

#### AA05 – Authorization Enforcement

| # | Task | Responsible |
|---|---|---|
| 1 | Enforce permissions in back-end endpoints and protected SPA routes | Mariana Moreira |
| 2 | Apply ownership and confidentiality restrictions | Mariana Moreira |
| 3 | Test unauthorized access and privilege changes | Mariana Moreira |
| 4 | Implement or collect applicable tests and acceptance evidence | Mariana Moreira |
| 5 | Update technical documentation and submit for peer review | Mariana Moreira |

#### AA06 – Role Assignment and Activation Invitation

| # | Task | Responsible |
|---|---|---|
| 1 | Implement authorized role assignment and activation invitations | Sofia Carvalho |
| 2 | Validate invitation lifecycle and restrict administrative operations | Sofia Carvalho |
| 3 | Test role assignment and invitation edge cases | Sofia Carvalho |
| 4 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho |
| 5 | Update technical documentation and submit for peer review | Sofia Carvalho |

#### AA07 – Secure Account Activation

| # | Task | Responsible |
|---|---|---|
| 1 | Implement secure account activation using invitations or activation tokens | Francisco Sá |
| 2 | Enforce expiry, single-use and invalid-token handling | Francisco Sá |
| 3 | Test account activation and subsequent authentication | Francisco Sá |
| 4 | Implement or collect applicable tests and acceptance evidence | Francisco Sá |
| 5 | Update technical documentation and submit for peer review | Francisco Sá |

---

### VIS – 3D Kitchen Visualization

#### VIS01 – 3D Module Integration

| # | Task | Responsible |
|---|---|---|
| 1 | Integrate the 3D module within the SPA | All Members |
| 2 | Load the active kitchen configuration from the back end | All Members |
| 3 | Handle loading and configuration errors | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### VIS02 – Kitchen Layout and Equipment

| # | Task | Responsible |
|---|---|---|
| 1 | Model the kitchen space, dimensions and principal equipment | Leonor de Moura |
| 2 | Position, orient and scale objects according to configuration JSON | Leonor de Moura |
| 3 | Validate multiple kitchen layouts | Leonor de Moura |
| 4 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura |
| 5 | Update technical documentation and submit for peer review | Leonor de Moura |

#### VIS03 – Automated Pizza Assembly Line Representation

| # | Task | Responsible |
|---|---|---|
| 1 | Create the automated pizza assembly-line representation | Francisco Sá |
| 2 | Organize equipment and elements for future Sprint 3 animation | Francisco Sá |
| 3 | Verify positioning and visual consistency | Francisco Sá |
| 4 | Implement or collect applicable tests and acceptance evidence | Francisco Sá |
| 5 | Update technical documentation and submit for peer review | Francisco Sá |

#### VIS04 – Textures and Materials

| # | Task | Responsible |
|---|---|---|
| 1 | Apply appropriate textures and materials to kitchen objects | Mariana Moreira |
| 2 | Maintain consistent appearance and resource loading | Mariana Moreira |
| 3 | Check rendering quality | Mariana Moreira |
| 4 | Implement or collect applicable tests and acceptance evidence | Mariana Moreira |
| 5 | Update technical documentation and submit for peer review | Mariana Moreira |

#### VIS05 – Scene Lighting

| # | Task | Responsible |
|---|---|---|
| 1 | Configure scene lighting for visibility and spatial perception | Sofia Carvalho |
| 2 | Evaluate lighting on equipment and work surfaces | Sofia Carvalho |
| 3 | Check performance and visual clarity | Sofia Carvalho |
| 4 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho |
| 5 | Update technical documentation and submit for peer review | Sofia Carvalho |

#### VIS06 – Interactive Light Controls

| # | Task | Responsible |
|---|---|---|
| 1 | Implement interactive controls for the available lights | Sofia Carvalho & Francisco Sá |
| 2 | Keep UI controls synchronized with the 3D scene | Sofia Carvalho & Francisco Sá |
| 3 | Test light changes | Sofia Carvalho & Francisco Sá |
| 4 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho & Francisco Sá |
| 5 | Update technical documentation and submit for peer review | Sofia Carvalho & Francisco Sá |

#### VIS07 – Perspective Camera Interaction

| # | Task | Responsible |
|---|---|---|
| 1 | Implement perspective camera movement and interaction | Leonor de Moura & Mariana Moreira |
| 2 | Constrain camera movement to usable viewing positions | Leonor de Moura & Mariana Moreira |
| 3 | Test camera controls and navigation | Leonor de Moura & Mariana Moreira |
| 4 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura & Mariana Moreira |
| 5 | Update technical documentation and submit for peer review | Leonor de Moura & Mariana Moreira |

---

### AI – Materials and Requirements Planning

#### AI01 – Prolog Bill of Materials and Stock Requirements

| # | Task | Responsible |
|---|---|---|
| 1 | Build the Prolog representation of the pizza bill of materials | All Members |
| 2 | Calculate required stock units from products, sizes and forecasts | All Members |
| 3 | Validate results against representative pizza configurations | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### AI02 – Prolog Requirements Planning and Supplier Selection

| # | Task | Responsible |
|---|---|---|
| 1 | Implement planning using stock, forecasts and supplier offers | All Members |
| 2 | Compare supplier alternatives using prices, quantities and lead times | All Members |
| 3 | Generate replenishment plans and report unmet requirements | All Members |
| 4 | Validate multi-day scenarios without mutating stored stock | All Members |
| 5 | Implement or collect applicable tests and acceptance evidence | All Members |
| 6 | Update technical documentation and submit for peer review | All Members |

#### AI03 – Artificial Neural Networks Study

| # | Task | Responsible |
|---|---|---|
| 1 | Study artificial neural networks and possible restaurant applications | All Members |
| 2 | Compare suitable model types, data needs and limitations | All Members |
| 3 | Document findings and technical rationale | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### AI04 – IARTI Technical Report

| # | Task | Responsible |
|---|---|---|
| 1 | Prepare the required IARTI technical report | All Members |
| 2 | Describe Prolog modelling, algorithms, test scenarios and results | All Members |
| 3 | Include neural-network study and limitations | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### AI05 – Artificial Intelligence Service Access

| # | Task | Responsible |
|---|---|---|
| 1 | Provide service endpoints for executing Prolog planning | All Members |
| 2 | Validate requests, return results and handle execution failures | All Members |
| 3 | Integrate AI execution with the SPA | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### AI06 – Back-End Data and Prolog Knowledge Base

| # | Task | Responsible |
|---|---|---|
| 1 | Expose consistent product, stock, BOM, forecast and supplier data | All Members |
| 2 | Create and validate Prolog knowledge-base input mappings | All Members |
| 3 | Maintain identifiers, versioning and read-only planning semantics | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

---

### SYS – Systems Administration and Business Continuity

#### SYS01 – Automated Deployment and Validation

| # | Task | Responsible |
|---|---|---|
| 1 | Automate deployment of the integrated application | All Members |
| 2 | Validate service startup, configuration and availability | All Members |
| 3 | Document reproducible deployment and verification | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### SYS02 – Institutional Network Access Restriction

| # | Task | Responsible |
|---|---|---|
| 1 | Configure and verify institutional-network access restrictions | Leonor de Moura |
| 2 | Test authorized and unauthorized access | Leonor de Moura |
| 3 | Document restrictions and evidence | Leonor de Moura |
| 4 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura |
| 5 | Update technical documentation and submit for peer review | Leonor de Moura |

#### SYS03 – Configurable Allowed Endpoints

| # | Task | Responsible |
|---|---|---|
| 1 | Configure permitted service endpoints and access rules | Sofia Carvalho |
| 2 | Validate endpoint accessibility under permitted configurations | Sofia Carvalho |
| 3 | Document changes and verification | Sofia Carvalho |
| 4 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho |
| 5 | Update technical documentation and submit for peer review | Sofia Carvalho |

#### SYS04 – Shared Resource Folder

| # | Task | Responsible |
|---|---|---|
| 1 | Configure the required shared resource folder | Francisco Sá |
| 2 | Apply suitable access permissions | Francisco Sá |
| 3 | Validate sharing and document the setup | Francisco Sá |
| 4 | Implement or collect applicable tests and acceptance evidence | Francisco Sá |
| 5 | Update technical documentation and submit for peer review | Francisco Sá |

#### SYS05 – Controlled Linux Remote Shell Access

| # | Task | Responsible |
|---|---|---|
| 1 | Configure controlled remote shell access on Linux | Mariana Moreira |
| 2 | Enforce appropriate authentication and authorization restrictions | Mariana Moreira |
| 3 | Test and document permitted and denied access | Mariana Moreira |
| 4 | Implement or collect applicable tests and acceptance evidence | Mariana Moreira |
| 5 | Update technical documentation and submit for peer review | Mariana Moreira |

#### SYS06 – Operational Risk Assessment

| # | Task | Responsible |
|---|---|---|
| 1 | Identify operational threats and assess impact and likelihood | Mariana Moreira |
| 2 | Record mitigations and residual risks | Mariana Moreira |
| 3 | Produce the operational risk assessment | Mariana Moreira |
| 4 | Implement or collect applicable tests and acceptance evidence | Mariana Moreira |
| 5 | Update technical documentation and submit for peer review | Mariana Moreira |

#### SYS07 – Minimum Business Continuity Objective

| # | Task | Responsible |
|---|---|---|
| 1 | Define a minimum business-continuity objective | Sofia Carvalho & Francisco Sá |
| 2 | Identify critical services and recovery priorities | Sofia Carvalho & Francisco Sá |
| 3 | Document continuity assumptions and verification | Sofia Carvalho & Francisco Sá |
| 4 | Implement or collect applicable tests and acceptance evidence | Sofia Carvalho & Francisco Sá |
| 5 | Update technical documentation and submit for peer review | Sofia Carvalho & Francisco Sá |

#### SYS08 – Backup Strategy and Recovery Validation

| # | Task | Responsible |
|---|---|---|
| 1 | Define and configure backup procedures | Leonor de Moura & Mariana Moreira |
| 2 | Perform a recovery exercise and validate restored data | Leonor de Moura & Mariana Moreira |
| 3 | Document backup, recovery and test evidence | Leonor de Moura & Mariana Moreira |
| 4 | Implement or collect applicable tests and acceptance evidence | Leonor de Moura & Mariana Moreira |
| 5 | Update technical documentation and submit for peer review | Leonor de Moura & Mariana Moreira |

---

### GDP – GDPR, Compliance, and Data Protection

#### GDP01 – Personal Data Handling

| # | Task | Responsible |
|---|---|---|
| 1 | Identify personal data collected, stored and displayed | All Members |
| 2 | Document lawful handling, access and retention considerations | All Members |
| 3 | Review relevant technical safeguards | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### GDP02 – Data Processing Responsibility

| # | Task | Responsible |
|---|---|---|
| 1 | Identify the responsible data-processing entity and relevant roles | All Members |
| 2 | Document responsibilities and processing relationships | All Members |
| 3 | Check consistency with system design | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

#### GDP03 – Personal Data Breach Handling

| # | Task | Responsible |
|---|---|---|
| 1 | Define a personal-data-breach response procedure | All Members |
| 2 | Describe assessment, escalation, documentation and notification considerations | All Members |
| 3 | Prepare evidence and an example response workflow | All Members |
| 4 | Implement or collect applicable tests and acceptance evidence | All Members |
| 5 | Update technical documentation and submit for peer review | All Members |

---

## 5. Sprint 1 Defense Feedback – Corrective Implementation (IMP01)

The team also committed to implementing the changes requested by the teaching staff during the Sprint 1 defense. The exact change list must be transcribed from the actual feedback and tracked as linked GitHub issues; it is not specified in the Sprint 2 assignment.

| # | Task | Responsible |
|---|---|---|
| 1 | Consolidate all feedback received during the Sprint 1 defense into actionable items | All Members |
| 2 | Classify changes by affected modules, severity and dependencies | All Members |
| 3 | Create GitHub issues with acceptance criteria and link them to IMP01 | All Members |
| 4 | Implement assigned corrective changes in dedicated branches | All Members |
| 5 | Update affected class/sequence diagrams, SAD, ADRs and API documentation | All Members |
| 6 | Add or update regression tests for corrected behaviour | All Members |
| 7 | Review and merge changes, confirming Sprint 2 compatibility | All Members |

---

## 6. Shared Engineering and Project Management Tasks

| # | Task | Responsible |
|---|---|---|
| 1 | Analyse and refine all Sprint 2 stories, acceptance criteria and dependencies | All Members |
| 2 | Create and prioritize Sprint 2 issues and subtasks on the GitHub Project board | All Members |
| 3 | Assign owners and adjust workloads after effort estimation | All Members |
| 4 | Maintain daily progress notes, board statuses and evidence of contributions | All Members |
| 5 | Keep architectural documentation, API contracts and diagrams aligned with the implementation | All Members |
| 6 | Perform pull-request reviews and automated integration/regression testing | All Members |
| 7 | Demonstrate end-to-end SPA, 3D, AI and infrastructure integration | All Members |
| 8 | Complete self and peer evaluation | All Members |
| 9 | Create the immutable `sprint-2-submission` tag and submit the tag-generated archive | All Members |

---

## 7. Main Dependencies and Integration Checkpoints

| Dependency | Coordination requirement |
|---|---|
| AA01–AA05 → WEB03, WEB05–WEB07 | Secure authentication, authorization and route protection must be available for protected pages. |
| WEB01–WEB02 → WEB05–WEB07, VIS01 | Shared SPA shell, navigation and API integration precede feature-page integration. |
| WEB06 ↔ VIS01–VIS03 | Active kitchen configuration and documented JSON format must be agreed jointly. |
| AI06 → AI01–AI02, AI05, WEB07 | Consistent BOM, stock, forecast and supplier data contracts must be established early. |
| AI01–AI02 → AI05 → WEB07 | Planning logic and service endpoints precede complete UI execution flows. |
| SYS01–SYS05 → Integrated demonstration | Deployment and access controls must support the final working MVP. |
| IMP01 → Affected Sprint 2 stories | Sprint 1 corrections must not be overwritten by new features. |

---

## 8. Workload Distribution and Collaboration

The Sprint 2 workload has been distributed among the four team members, considering the complexity of each User Story, technical dependencies, and the need for participation across different course units.

Several User Stories are assigned to pairs or to the entire team to encourage collaboration, knowledge sharing, and collective responsibility for the integrated solution.

| Member | Assigned Responsibilities | Shared Responsibilities |
|---|---|---|
| Sofia Carvalho | WEB04, AA04, AA06, VIS05, SYS03 | WEB01, WEB07, VIS01, VIS06, AI01–AI06, SYS01, SYS07, GDP01–GDP03, IMP01 |
| Francisco Sá | WEB02, AA01, AA07, VIS03, SYS04 | WEB01, WEB07, VIS01, VIS06, AI01–AI06, SYS01, SYS07, GDP01–GDP03, IMP01 |
| Leonor de Moura | WEB03, AA02, AA03, VIS02, SYS02 | WEB01, WEB06, VIS01, VIS07, AI01–AI06, SYS01, SYS08, GDP01–GDP03, IMP01 |
| Mariana Moreira | WEB05, AA05, VIS04, SYS05, SYS06 | WEB01, WEB06, VIS01, VIS07, AI01–AI06, SYS01, SYS08, GDP01–GDP03, IMP01 |

**Collaboration Guidelines:**

- All team members participate in the analysis, development, integration, and validation of the shared User Stories.
- Tasks assigned to two members require coordination to avoid duplicated work and ensure consistent implementation.
- Each member is responsible for documenting and testing their assigned functionality.
- Pull requests must undergo peer review before integration into the main branch.
- Workload distribution may be adjusted during the sprint if significant differences in effort or unexpected technical difficulties arise.
- All team members remain collectively responsible for the quality, integration, and successful demonstration of the Sprint 2 MVP.

## 9. Definition of Ready (DoR)

A User Story is ready when its acceptance criteria are understood, dependencies and API/data contracts are identified, the responsible member and reviewer are agreed, and the required environment and test approach are available.

## 10. Definition of Done (DoD)

A User Story is completed when its applicable acceptance criteria are satisfied; code and configuration are committed to the repository; automated and/or reproducible validation is recorded; authorization, data integrity and error handling are verified where applicable; documentation and diagrams are updated; the pull request is reviewed and merged; and the feature is integrated into the Sprint 2 MVP. Documentation-only stories require a reviewed deliverable and evidence rather than executable code.

## 11. Identified Risks

| Risk | Mitigation |
|---|---|
| Integration complexity across SPA, 3D, Prolog and back end | Agree interfaces early and run frequent end-to-end integration checks. |
| Uneven effort across stories | Estimate subtasks and rebalance assignments during sprint monitoring. |
| Authentication and role enforcement delays | Prioritize AA interfaces before dependent WEB functionality. |
| Unresolved Sprint 1 feedback | Record and prioritize corrective issues at sprint start. |
| Deployment and recovery issues | Validate infrastructure incrementally rather than at the end. |


