# LaPrizza — General Data Protection Regulation (GDPR)

The documentation describes how personal data is handled, identifies the responsibilities associated with its processing, and establishes procedures for responding to personal data breaches.

The objective is to promote transparency, accountability and the protection of personal data throughout the application.

## 1. Overview

**LaPrizza** is a restaurant management application developed as part of the fifth-semester Integrative Project of the Bachelor's Degree in Computer Engineering at the Instituto Superior de Engenharia do Porto (ISEP).

The application provides functionalities such as customer management, product catalogue administration, authentication and authorisation, stock management and restaurant operations.

As these functionalities involve the processing of personal data, the project addresses the requirements established by **Regulation (EU) 2016/679**, commonly known as the General Data Protection Regulation (GDPR).

## 2. Documentation

The GDPR documentation is organised into the following files:

| Document | Description |
|---|---|
| [Privacy Policy](privacyPolicy.md) | Public-facing policy explaining how LaPrizza processes and protects personal data. |
| [GDP01 — Personal Data Handling](personal-data-handling.md) | Identification of personal data processed by the application and description of the associated processing activities. |
| [GDP02 — Data Processing Responsibility](data-processing-responsibility.md) | Identification of the data controller and clarification of responsibilities concerning personal data processing. |
| [GDP03 — Personal Data Breach Handling](personal-data-breach-handling.md) | Definition of personal data breaches and explanation of notification obligations, recipients, required information and deadlines. |

The documentation will be complemented by a video explaining the data processing workflow, providing an overview of the application, and outlining the response protocol in the event of a data breach.

## 3. Data Protection Principles

LaPrizza aims to follow the principles established in Article 5 of the GDPR:

- **Principle of Lawfulness:** Personal data will be processed in accordance with applicable data protection legislation, particularly the General Data Protection Regulation
- **Principle of Loyalty**: Personal data must be processed processed lawfully, fairly and in a transparent manner.
- **Principle of Transparency**: Controllers must provide all privacy communications in a concise, easily accessible and clear format.
- **Principle of Purpose:** Personal data must be collected for specified, explicit and legitimate purposes.
- **Principle of Data Minimisation:** Only personal data necessary for the intended purposes should be processed.
- **Principle of Accuracy:** Personal data must be accurate and kept up to date where necessary.
- **Principle of Storage Limitation:** Personal data must not be retained longer than necessary.
- **Principle of Integrity and Confidentiality:** Appropriate security measures must protect personal data against unauthorised access, loss or unlawful processing.
- **Principle of Accountability:** The data controller must be able to demonstrate compliance with the applicable data protection requirements.

## 4. GDPR User Stories

The GDPR requirements for Sprint 2 are organised into three User Stories.

### GDP01 — Personal Data Handling

**Objective:** Identify and document the personal data processed by LaPrizza.

The documentation addresses:

- The scope and core functionalities of the application.
- The categories of personal data processed.
- How personal data is collected, used, stored and otherwise processed.

### GDP02 — Data Processing Responsibility

**Objective:** Identify the entity responsible for determining the purposes and means of personal data processing.

The documentation addresses:

- Identification of the data controller.
- Clarification of the responsibilities associated with personal data processing.

### GDP03 — Personal Data Breach Handling

**Objective:** Explain the procedures and legal obligations associated with personal data breaches that may pose a high risk to individuals' rights and freedoms.

The documentation addresses:

- The definition of a personal data breach.
- The applicable notification obligations.
- The recipients of breach notifications.
- The information required in notifications.
- The applicable notification deadlines.

## 5. Integration with Application Security

Data protection is supported by the application's authentication, authorisation and infrastructure mechanisms.

### Relevant Sprint 2 User Stories include:

| User Story | Relationship to Data Protection |
|---|---|
| AA01 — Local Authentication | Protection of locally managed credentials. |
| AA02 — External Identity Provider Integration | Secure authentication through external identity providers. |
| AA04 — Secure Session Handling | Protection of authenticated sessions. |
| AA05 — Authorization Enforcement | Prevention of unauthorised access to personal information. |
| AA06 — Role Assignment and Activation Invitation | Controlled management of user permissions and account activation. |
| SYS08 — Backup Strategy and Recovery Validation | Protection and recovery of stored information, including personal data. |

These mechanisms contribute to the overall protection of personal data but do not, individually, establish full GDPR compliance.

## 6. Regulatory References

The documentation is based on the following regulatory laws:

- [Regulation (EU) 2016/679 — General Data Protection Regulation](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Law No. 58/2019 — Portuguese GDPR Implementation Law](https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982)
- [European Data Protection Board (EDPB)](https://www.edpb.europa.eu/)
- [Comissão Nacional de Proteção de Dados (CNPD)](https://www.cnpd.pt/)

## 7. Documentation Maintenance

The GDPR documentation should be reviewed whenever changes to the application affect:

- The categories of personal data collected.
- The purposes or legal bases of processing.
- Authentication or authorisation mechanisms.
- Data storage, retention, or deletion procedures.
- External services involved in personal data processing.
- Security controls or personal data breach procedures.

The documentation must distinguish between implemented functionality and planned measures, ensuring that descriptions remain consistent with the actual system.
