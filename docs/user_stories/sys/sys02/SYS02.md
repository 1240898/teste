# SYS02 - Institutional Network Access Restriction

## 1. Context & Scope

- **User Story ID:** SYS02
- **Sprint:** Sprint 2
- **Area:** System Administration and Business Continuity (SYS)
- **Responsible:** Leonor de Moura (1240914)


## 2. Requirements & Analysis

### 2.1. User Story Description
> **As a** System Administrator,  
> **I want** development and staging access restricted to the DEI internal network or a Virtual Private Network (VPN),  
> **so that** access follows the approved network context.

### 2.2. Acceptance Criteria 

- [ ] **AC 1:** Restrict development and staging access to the DEI internal network or VPN, using appropriate host or proxy rules.
- [ ] **AC 2:** Keep application authentication and role checks active in addition to network restrictions.
- [ ] **AC 3:** Deny and log access from unapproved network contexts.
- [ ] **AC 4:** Document the configuration and demonstrate both permitted internal access and denied external access.

### 2.3. Client Clarifications & Questions

> **Question:** The only shared environment the team operates is the DEI VM used for integration and demonstration, which is treated as the staging environment. Development runs on each developer's machine, with services bound to `localhost`. Should the development environment in this user story be understood as these local environments, which are not exposed to other networks, or is a separate shared development environment expected inside the DEI infrastructure?  
> **Answer:** *Pending.*

> **Question:** For SYS01, external SSH access to the VM was enabled so that GitHub-hosted runners can deploy. Does SYS02 apply only to access to the deployed application (HTTP/HTTPS), or must the administrative SSH channel also be limited to the DEI network or VPN? Limiting SSH would block the deployment path agreed for SYS01.  
> **Answer:** *Pending.*

> **Question:** Is there an official list of the address ranges that make up the DEI internal network and the DEI VPN, or should the team identify the approved ranges from the client addresses observed when connecting through each of them?  
> **Answer:** *Pending.*

### 2.4 Goal 

The goal of this user story is to ensure that the LaPrizza application deployed in the DEI environment can only be reached by clients connected to the DEI internal network, either directly or through the VPN. To achieve this, network access rules will be applied at the host or reverse-proxy level, so that requests from unapproved network contexts are denied and logged before reaching the application.

This restriction complements, and does not replace, the application's own security: users accessing from an approved network must still authenticate and are only authorised according to their roles. The resulting configuration will be documented and validated by demonstrating both a permitted internal access and a denied external access.