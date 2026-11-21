# SYS08 - Backup Strategy and Recovery Validation

## 1. Context & Scope

- **User Story ID:** SYS08
- **Sprint:** Sprint 2
- **Area:** System Administration and Business Continuity (SYS)
- **Responsible:** Leonor de Moura (1240914)


## 2. Requirements & Analysis

### 2.1. User Story Description
> **As a** System Administrator,  
> **I want** a justified and implemented backup strategy,  
> **so that** data can be recovered with limited loss and work recovery time.

### 2.2. Acceptance Criteria 

- [ ] **AC 1:** Specify backup frequency, retention, and storage locations, and justify achievable Recovery Point Objective (RPO) and Work Recovery Time (WRT) targets.
- [ ] **AC 2:** Implement and document backup and restore procedures. Test restores, verify that recovered data is usable and consistent, and record results against the targets.
- [ ] **AC 3:** Restrict backup access and protect the confidentiality of copies containing personal data.
- [ ] **AC 4:** Ensure retention and recovery respect completed personal-data erasure or restriction requests, so obsolete data is not silently returned to normal use.

### 2.3 Goal 

The goal of this user story is to ensure that LaPrizza's data can be recovered after accidental deletion, data corruption or infrastructure failure, with limited data loss and recovery time. The main asset to protect is the PostgreSQL database used by the Back-End API, a separate DEI service that holds all persistent business and personal data, such as user accounts, customer records and dietary profiles, products, stock and kitchen configurations. Backups will be produced with database-native tooling while the service remains in operation, automated through scheduled execution, and kept in more than one location, including a copy physically separate from the original, so that a single failure cannot affect both the data and its copies. The chosen backup frequency, retention and storage locations will be justified against achievable RPO and WRT targets.

A backup is only useful if it can be restored. The backup and restore procedures will therefore be documented and validated through test restores into an isolated environment, checking that the recovered data is usable and consistent and recording the measured results against the RPO and WRT targets. The verified result of each restore test also provides the evidence that the SYS01 deployment pipeline requires before applying schema migrations to a non-empty database.

Since the copies contain personal data, they must be protected at the same level as the original database: access to backups is restricted to authorised administrators, copies are protected at rest and transferred only over authenticated and encrypted channels, and they are never placed in the shared resource folder (SYS04). Retention and recovery must also respect completed personal-data erasure or restriction requests, so that restoring a backup does not silently bring obsolete personal data back into normal use.