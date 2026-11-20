# SYS05 - Controlled Linux Remote Shell Access

## 1. Context & Scope

- **User Story ID:** SYS05
- **Sprint:** Sprint 2
- **Area:** System Administration and Business Continuity (SYS)
- **Responsible:** Mariana Moreira (1240905)


## 2. Requirements & Analysis

### 2.1. User Story Description
> **As a** System Administrator,  
> **I want** remote Linux shell logins controlled and monitored,  
> **so that** unauthorized administrative access can be prevented and reported.

### 2.2. Acceptance Criteria 

- [ ] **AC 1:** Permit authentication only between 08:00 and 22:00 local time; deny attempts outside that period.
- [ ] **AC 2:** After a failed authentication attempt, require Multi-Factor Authentication (MFA) before subsequent login attempts are allowed.
- [ ] **AC 3:** After more than three consecutive failed authentication attempts, automatically generate an email alert to the system administrator.
- [ ] **AC 4:** Document the deployed timezone and provide evidence of allowed, denied, MFA, and alert scenarios.
- [ ] **AC 5:** Administrative accounts must be individually identifiable, and shared credentials must not be used for routine administration.
- [ ] **AC 6:** Login and alert records must remain available only to authorized personnel and follow a documented retention period.

### 2.3. Client Clarifications & Questions

> **Question (SYS01):** Deployment to the DEI VM needs to be handled via GitHub Actions; however, the VM only has private addresses. What is the expected approach?  
> **Answer:** Deployment via SSH is possible, provided that external SSH access is enabled for the VM hosted in the DEI cloud and a secure authentication mechanism is used, without storing private keys or other credentials directly in the repository. Appropriate secret management mechanisms, such as GitHub Actions Secrets, should be used.

**Consequence for SYS05:** the SSH service controlled by SYS05 is also the channel used by the SYS01 deployment workflow. The deployment identity is therefore subject to the same controls, uses its own key stored as a GitHub Actions secret and is distinct from every personal administrative account.

**Questions to confirm with the client** (see 3.9):

- Whether a denial outside the 08:00–22:00 window counts as a failed authentication attempt for AC 2 and AC 3.
- Whether "consecutive failed attempts" is counted per account, per source address or both.
- Whether the non-interactive deployment identity used by SYS01 must also respect the time window.

### 2.4 Goal 

The goal of this user story is to control and monitor remote shell access to the Linux VM that hosts LaPrizza in the DEI cloud. SSH logins are restricted to an approved daily time window, every failed attempt raises the authentication requirement to MFA, repeated failures are reported by email, each administrator uses a personal account, and the resulting records are protected and retained for a documented period.

---
