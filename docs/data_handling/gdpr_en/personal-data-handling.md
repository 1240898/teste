# GDP01 — Personal Data Processing

## 1. Context and Scope

- **User Story:** GDP01
- **Sprint:** Sprint 2
- **Area:** GDPR, Compliance and Data Protection (GDP)
- **Responsible:** All team members — Sofia Carvalho (1240898), Francisco Sá (1241341), Leonor de Moura (1240914), Mariana Moreira (1240905)
- **Related user stories:** GDP02 (controller), GDP03 (personal data breaches), AA01–AA07 (authentication and authorisation), SYS08 (backups), WEB03 (public privacy notice)

> **As a** LaPrizza representative,
> **I want** to ensure that the team understands how the project processes personal data,
> **so that** all data processing operations comply with applicable data protection law.

| AC | Acceptance Criterion | Section |
|---|---|---|
| AC1 | Explain the project scope and its core functions clearly and concisely | 2 |
| AC2 | Identify the personal data processed | 3, 5 |
| AC3 | Describe how those data are processed | 4, 6, 7, 8 |

**Status labels**

- **Implemented** — present in the code.
- **Planned** — agreed by the team and awaiting implementation.
- **Not collected** — deliberately excluded in accordance with the principle of data minimisation.

## 2. Project Scope and Core Functions

LaPrizza is an information system for managing a pizzeria. It consists of a React single-page application, an Express REST API backed by PostgreSQL, a browser-based 3D kitchen viewer and a Prolog planning service.

| Function | Does it process personal data? |
|---|---|
| User accounts and authentication (email and password or a Google account), roles, account activation, password recovery and sessions | **Yes** |
| Customer management and customer self-service | **Yes** |
| Product catalogue, categories, allergen catalogue, pizza sizes and components, and predefined pizzas | No. Business data only |
| Stock information and history | No |
| Kitchen configuration and 3D visualisation | No |
| AI planning (bill of materials, requirements planning and supplier selection) | No. Uses stock, recipe and supplier data only |
| Orders, payments and invoicing | Not implemented in this increment |

**Data subjects** include customers with or without an account, members of staff (Administrator, Manager and Employee), and visitors to public pages, whose IP addresses are processed on a transient basis.

## 3. Personal Data Inventory

| No. | Data | Data Subjects | Source | Storage | Required | Status |
|---|---|---|---|---|---|---|
| 1 | Name | Customers and members of staff with a user account | Registration form, invitation, Google sign-in or customer record form completed by the Manager | `users.name`, `customers.name` | Yes | Implemented |
| 2 | Email address | Customers, members of staff and recipients of activation invitations | Registration form, activation invitation, Google sign-in or customer record form | `users.email`, `customers.email`, `activation_invitations.intended_email` | Yes | Implemented |
| 3 | Password (stored as a hash) | Users with local accounts | Registration, activation, password change or password recovery | `users.password_hash` | Local accounts only | Implemented |
| 4 | Google account identifier | Users who sign in with Google | Google OpenID Connect | `user_external_identities` | Google sign-in only | Implemented |
| 5 | Roles and account status | All users | System or Administrator | `users.roles`, `users.active`, `users.ever_activated`, `role_change_records` | Yes | Implemented |
| 6 | Marketing consent and its timestamp | Customers | Registration form | `users.marketing_consent_given`, `users.marketing_consent_timestamp` | Optional. Consent is withheld by default | Implemented |
| 7 | Sessions and security tokens (hashes) | All users | System | `application_sessions`, `password_recovery_tokens`, `activation_invitations` | Yes | Implemented |
| 8 | Mobile phone number | Customers | Customer record form completed by the Manager, local registration form or profile completion form | `customers.phone_number` | Yes, to create the customer record | Implemented |
| 9 | Allergens and dietary restrictions that reveal data concerning health | Customers | My Data or customer record form | `customers.dietary_restrictions`, `customer_dietary_restriction_allergens`, `customers.health_data_consent_given`, `customers.health_data_consent_timestamp` | Optional, with explicit consent | Implemented |
| 10 | IP address associated with sign-in requests | People who attempt to sign in, with or without an account | HTTP sign-in request | Application memory, within a 15-minute rate-limiting window | Collected automatically | Implemented |
| 11 | AA05 security audit events, including actor ID and roles when available | People whose API requests are denied | Authentication and authorisation checks | PostgreSQL `security_audit_logs` | Recorded automatically for covered denials | Implemented |

## 4. Personal Data Processing

The purpose of each processing operation determines its lawful basis. Personal data are retained for the period prescribed by applicable law or regulation or, in the absence of a prescribed period, for as long as necessary for the purpose of the processing. This follows Article 5(1)(e) of the GDPR and Article 21 of Portuguese Law No. 58/2019. The term **erasure** describes the operation and is also used in Article 17 of the GDPR for the **right to erasure**. [GDPR][gdpr] · [Law No. 58/2019][lei58]

### 4.1. Name

- **Collection** — The name is obtained during registration, the invitation process, Google sign-in or completion of the customer record by the Manager.
- **Storage** — It is stored in `users.name` or `customers.name`.
- **Organisation** — The name is linked to a user account or customer record. A customer record can exist without an associated account.
- **Alteration** — The user can rectify the name in the customer record.
- **Consultation** — The user can view the name on their account. The Administrator can consult account records and the Manager can consult customer records within the scope of their respective permissions.
- **Use** — To identify the data subject when managing the account or customer record and to improve the user experience.
- **Erasure** — Erase the name from the account or customer record when it is no longer necessary and there is no lawful basis for retaining it. A procedure for erasing account data is planned.
- **Lawful basis** — Article 6(1)(b) of the GDPR applies to identifying the customer where this is necessary for the performance of a contract or to take steps at the customer's request before entering into a contract. [GDPR][gdpr]

### 4.2. Email Address

- **Collection** — The address is obtained during registration, the activation invitation process, Google sign-in or completion of the customer record.
- **Storage** — It is stored in `users.email`, `customers.email` or `activation_invitations.intended_email`.
- **Organisation** — The address is linked to the account, customer record or invitation for which it was provided.
- **Alteration** — The email address is read-only in My Data. The customer can request rectification and can edit their name and mobile number directly.
- **Consultation** — The data subject can view their email address. Internal access is restricted to people authorised to manage accounts, customer records or invitations.
- **Use** — To identify the account, send activation invitations and password recovery messages, and contact the customer where necessary. The application uses its email service to send activation and recovery messages.
- **Erasure** — Erase the email address from records that are no longer necessary. Expired invitations require a separate retention period because the address may still be needed for the account or customer record.
- **Lawful basis** — Article 6(1)(b) of the GDPR applies where the email address is necessary to provide or recover an account requested by the customer or to provide the service. [GDPR][gdpr]

### 4.3. Password

- **Collection** — The user enters a password during registration, account activation, a password change or recovery of a local account.
- **Hashing and storage** — The application generates a hash using `bcrypt` and stores it in `users.password_hash`, linked to the account.
- **Alteration** — Setting a new password generates a new hash, which replaces the previous one.
- **Use** — During authentication, the application uses the stored hash to verify the password supplied.
- **Erasure** — Remove the hash when the local credential is no longer needed or when the account data are erased.
- **Lawful basis** — Article 6(1)(b) of the GDPR applies where a local credential is necessary to authenticate the customer and provide access under the contract. For staff accounts, individual authentication may be based on legitimate interests under Article 6(1)(f), subject to assessment. Article 32 governs the protection of credentials as part of the security of processing. [GDPR][gdpr]

### 4.4. Google Account Identifier

- **Collection** — The identifier is obtained through OpenID Connect when the user chooses to sign in with Google.
- **Storage** — The identifier, provider and date of the association are stored in `user_external_identities`.
- **Organisation** — The combination of the provider and the external identifier is linked to the LaPrizza account.
- **Use** — To recognise the corresponding LaPrizza account when the user signs in with Google.
- **Erasure** — Remove the association when it is no longer required for Google sign-in or as part of erasing the account data.
- **Lawful basis** — Article 6(1)(b) of the GDPR applies to customers where storing the association is necessary to provide the sign-in method they requested as part of the service. [GDPR][gdpr]

### 4.5. Roles and Account Status

- **Collection** — The system assigns the initial values when the account is created. Activation, deactivation and decisions by the Administrator generate updates.
- **Storage** — Current values are stored in `users.roles`, `users.active` and `users.ever_activated`. The history of role changes is stored in `role_change_records`.
- **Organisation** — Current values are linked to the account. The history identifies the affected account, the person who made the change and the date of the change.
- **Alteration** — The Administrator can change roles. The activation and deactivation processes update the account status.
- **Consultation** — Authorisation components check roles and account status. Access to the history should be restricted to people authorised to conduct audits.
- **Use** — To enforce permissions, determine whether an account can access the system and investigate changes to access rights.
- **Erasure** — Erase account data when they are no longer necessary. Apply a separate retention period to the audit history.
- **Lawful basis** — Article 6(1)(b) of the GDPR applies to data necessary to provide the customer with access under the contract. Legitimate interests under Article 6(1)(f) are a possible basis for managing staff permissions and keeping an audit history, subject to an assessment of the need to protect the system and the impact on data subjects. [GDPR][gdpr]

### 4.6. Marketing Consent

- **Collection** — The customer indicates their choice through a separate, unticked option on the registration form.
- **Storage** — The choice and its timestamp are stored in `users.marketing_consent_given` and `users.marketing_consent_timestamp`.
- **Organisation** — The choice is linked to the account and to the marketing purpose.
- **Alteration** — The customer can give or withdraw consent through their customer record.
- **Consultation** — The customer can view their preference. Internal access should be restricted to people who verify whether consent was given or review the evidence of the decision.
- **Use** — To determine whether the customer has consented to marketing communications and to demonstrate the choice made.
- **Erasure** — Stop sending communications based on consent once it is withdrawn. Erase the record of the choice when it is no longer necessary as evidence.
- **Lawful basis** — Articles 6(1)(a) and 7 of the GDPR apply to consent-based marketing. Article 7 also governs how consent is demonstrated and withdrawn. Electronic direct marketing is also subject to Article 13-A of Portuguese Law No. 41/2004. Any retention of evidence after withdrawal requires its own purpose, lawful basis and retention period. [GDPR][gdpr] · [Law No. 41/2004, Article 13-A][lei41]

### 4.7. Sessions and Security Tokens

- **Collection** — The application generates credentials when it creates a session, issues an activation invitation or initiates password recovery.
- **Storage** — The hashes are stored in `application_sessions`, `activation_invitations` or `password_recovery_tokens`, depending on the process.
- **Organisation** — Each record is linked to the account, its purpose and the data needed to determine whether the credential is valid.
- **Alteration** — Sessions may be renewed or terminated. Single-use tokens are invalidated after use or become unusable upon expiry.
- **Use** — To maintain authenticated sessions, validate account activation and verify password recovery requests.
- **Erasure** — Records of terminated sessions are subject to the configured retention period, which is seven days by default. Retention periods for expired invitations and recovery tokens should be defined separately from the time for which those credentials remain valid.
- **Lawful basis** — Article 6(1)(b) of the GDPR applies to processing necessary for the customer to use their account. Legitimate interests under Article 6(1)(f) are a possible basis for managing internal access or retaining records for longer where necessary for security. Article 32 governs the technical measures used to protect credentials. [GDPR][gdpr]

### 4.8. Mobile Phone Number

- **Collection** — The number is provided through the customer record form and is requested during local registration or profile completion.
- **Storage** — It is stored in `customers.phone_number`.
- **Organisation** — It is linked to the customer record and is accessible through the corresponding account where one is linked.
- **Alteration** — The user can rectify the number in the customer record.
- **Consultation** — The user can view the number in the customer record. Internal access is restricted to people authorised to manage accounts.
- **Use** — To contact the customer where necessary to provide the service.
- **Erasure** — Erase the number when it is no longer needed for the contact purpose for which it was collected.
- **Lawful basis** — Article 6(1)(b) of the GDPR applies if telephone contact is objectively necessary to provide the service. If that need arises only at a later stage, the principle of data minimisation under Article 5(1)(c) supports collecting the number at that stage. [GDPR][gdpr]

### 4.9. Allergens and Dietary Restrictions That Reveal Data Concerning Health

- **Collection** — The customer provides the information voluntarily after giving explicit consent.
- **Storage** — Dietary restrictions are stored in `customers.dietary_restrictions`. Links to the allergen catalogue are stored in `customer_dietary_restriction_allergens`.
- **Organisation** — Each restriction is linked to the customer record and may be associated with an allergen in the catalogue.
- **Alteration** — The customer can rectify or remove the information they provided and withdraw consent.
- **Consultation** — The customer can view their own data. The Manager can view and record restrictions where needed to provide the service and can add or change them in the form after confirming the customer’s explicit consent.
- **Use** — To identify relevant restrictions when selecting and preparing products for the customer.
- **Erasure** — Withdrawing consent deletes the restrictions and their catalogue links together. Migration `0030` deletes legacy restrictions and links for which no explicit consent was recorded and keeps the rest of each customer record.
- **Lawful basis** — Under the proposed model, consent is the lawful basis under Article 6(1)(a) of the GDPR. Explicit consent also satisfies the separate condition in Article 9(2)(a) for processing data concerning health. The controller must obtain consent and be able to demonstrate that it was given, in accordance with Article 7. [GDPR][gdpr]

### 4.10. IP Address Associated with Sign-In Requests

- **Collection** — The IP address is obtained automatically from the HTTP request, including requests made by people without an account.
- **Storage** — The rate limiter keeps the IP address and request counter in memory.
- **Organisation** — The IP address serves as the key for associating requests with the relevant rate-limiting window.
- **Alteration** — The system updates the request counter associated with the IP address for each request subject to the limit.
- **Use** — To limit the frequency of sign-in requests and reduce abuse of the authentication service.
- **Erasure** — The temporary record expires in accordance with the configured 15-minute window. Persistent application audit logs and network access denial logs have separate retention periods.
- **Lawful basis** — Article 6(1)(f) of the GDPR may apply if the controller can demonstrate that the processing is necessary to protect the authentication service and that the interests or fundamental rights and freedoms of the data subjects do not override that legitimate interest. [GDPR][gdpr]

### 4.11. AA05 Security Audit

The API records denied authentication, permission and ownership checks to support investigation. Each event contains an event ID, request ID, timestamp, outcome, HTTP method, route template, response status and, when available, the actor ID and roles. Administrators can consult the audit. The stored route template omits identifiers embedded in URLs and query strings.

## 5. Data Not Collected (Data Minimisation)

The team's preliminary spreadsheet listed data that the system does not collect.

| Data | Decision |
|---|---|
| Date of birth | **Not collected.** There are no age-restricted products or birthday features that justify its collection. |
| Bank or card details | **Not collected or stored.** When payments are introduced, a payment service provider will process them. |
| Postal addresses | **Not collected.** |
| Tax identification number (NIF) | **Not collected.** The project intends to collect it in a later increment. A payment service is outside the scope of the current increment. |
| Order and payment history | Not processed in this increment because order functionality has yet to be implemented. Processing will be documented when the functionality is available. |

## 6. Retention Periods

Article 21 of Portuguese Law No. 58/2019 informs the retention schedule. Data are retained for the period prescribed by law or regulation or, where no period is prescribed, for as long as necessary for the purpose. Once the purpose ceases, the controller must destroy or anonymise the data under Article 21(4). Where the law requires retention for a specified period, Article 21(5) provides that the right to erasure under Article 17 of the GDPR may be exercised once that period has expired. [Law No. 58/2019][lei58]

| No. | Data | Retention Period or Criterion |
|---|---|---|
| 1 | Name | For the account, as long as necessary to manage access. For the customer record, as long as necessary for the commercial relationship. Review customer records after 24 months without relevant activity and erase or anonymise data whose purpose has ceased. |
| 2 | Email address | For the account and customer record, as long as necessary for their respective purposes. For activation invitations, the proposed erasure period is 30 days after expiry, use or revocation. The email address on the account follows its own retention period. |
| 3 | Password hash | Retain only the current hash while a usable local credential exists. Replace it when the password changes and erase it when the credential is permanently removed. |
| 4 | Google account identifier | Retain while the association is necessary for authentication. Erase the association when the external identity is unlinked or the account is permanently closed. |
| 5 | Roles and account status | Retain current values for as long as necessary to manage the account. A period of 90 days after each event is proposed for the history of changes to permissions. Any longer retention is limited to records needed to investigate a specific incident. |
| 6 | Marketing consent and its timestamp | Retain the active preference while it is used to manage marketing. Following withdrawal, stop sending communications and retain only the minimum information needed to honour the preference or demonstrate the choice made. Define a separate period based on that need and review it annually. |
| 7 | Sessions and security tokens | Retain terminated session records for seven days by default. The proposed erasure periods are 24 hours after use, expiry or revocation for recovery token records and 30 days for activation invitation records, including their token hashes. |
| 8 | Mobile phone number | Retain as long as necessary to contact the customer about the service. Erase the number when that purpose ceases and review the customer record after 24 months without relevant activity. |
| 9 | Allergens and dietary restrictions that reveal data concerning health | Retain as long as the information is necessary for the stated purpose and valid explicit consent is in place. Erase the restrictions and their links when consent is withdrawn or the purpose ceases, unless a separate lawful basis and a valid condition for retaining the data apply. |
| 10 | IP address associated with sign-in requests | Keep the IP address and counter in memory for the 15-minute rate-limiting window. Persistent audit logs and network access denial logs have separate retention periods. |
| 11 | AA05 security audit events | Persistent in PostgreSQL. A retention period and automated deletion procedure for this audit still need to be defined. |

The 24-month review is a checkpoint. Erase the data sooner if the purpose has already ceased. The 24-hour and 30-day periods are proposals awaiting automated deletion. The proposed 90-day period above concerns the separate role-change history. The expiry of a credential, the termination of a session and the erasure of the corresponding record are distinct events.

## 7. Technical and Organisational Measures (Articles 25 and 32)

- Passwords are stored as `bcrypt` hashes. Session credentials, recovery tokens and invitation tokens are stored only as hashes.
- Customer management operations require `MANAGER`. The `/customers/me` routes require `CUSTOMER` and use the signed-in account. `GET /customers/:id` allows `MANAGER` to read any record and `CUSTOMER` to read their own record. User management and access to the security audit are restricted to `ADMINISTRATOR`. Access is denied by default.
- HTTP request logs use route templates and omit query strings.
- Customer API responses carry the `Cache-Control: no-store` header to prevent caching of personal data.
- The application returns generic sign-in failure messages and rate-limits requests to public endpoints.
- Data are validated in the API using Joi, in domain value objects and through database `CHECK` constraints. SQL queries are parameterised.
- Secrets such as `JWT_SECRET`, database credentials and SMTP credentials are stored in `.env` files kept outside version control.
- Backup and restoration procedures protect personal data and respect completed erasure requests.
- Data protection by default applies to account creation. Marketing and allergen consent options are unticked by default, and optional data are excluded from mandatory account fields.

### Integration Verification

The customer service keeps self-service contact changes scoped to the signed-in customer and updates only the name and phone number. Changes to consent, restrictions and their allergen links run in one PostgreSQL transaction. The WEB05 form sends consent when the Manager confirms the customer’s decision for new or changed restrictions.

The PostgreSQL integration tests apply the migration to an existing customer with a linked allergen and check that the customer record is still available through the API without restrictions. A concurrent update test checks that a contact edit can complete after consent withdrawal without restoring restrictions or links. The SPA tests cover the consent confirmation for creation and editing and the request sent for contact-only edits.

## 8. References

- [Regulation (EU) 2016/679 (GDPR)][gdpr] — Articles 4(2), 4(15), 5, 6, 7, 9, 12 to 22, 25, 30 and 32
- [Portuguese Law No. 58/2019 of 8 August][lei58] — Articles 16, 18 and 21
- [Portuguese Law No. 41/2004, Article 13-A][lei41] — electronic direct marketing
- Portuguese VAT Code — [Article 36][civa36] (invoice contents) and [Article 52][civa52] (ten-year retention period)
- [Comissão Nacional de Proteção de Dados (CNPD), the Portuguese data protection authority](https://www.cnpd.pt/)

[gdpr]: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679
[lei58]: https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982
[lei41]: https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2004-106523049-183878511
[civa36]: https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/pages/iva36.aspx
[civa52]: https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/pages/iva52.aspx
