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

### 2.3 Goal 

The goal of this user story is to ensure that the LaPrizza application deployed in the DEI environment can only be reached by clients connected to the DEI internal network, either directly or through the VPN. To achieve this, network access rules will be applied at the host or reverse-proxy level, so that requests from unapproved network contexts are denied and logged before reaching the application.

This restriction complements, and does not replace, the application's own security: users accessing from an approved network must still authenticate and are only authorised according to their roles. The resulting configuration will be documented and validated by demonstrating both a permitted internal access and a denied external access.

