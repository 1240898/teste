# Documentation

## Overview

This document justifies the aggregates defined in the LaPrizza domain model.  
For each aggregate, one representative scenario is presented together with a short explanation.  
The goal is to show the aggregate’s responsibility by demonstrating an invariant enforced by its aggregate root.

The relationships and constraints between aggregates are also justified according to the System Specification and the Sprint 1 User Stories (BCK01–BCK11 and ARC01).

---

## User Aggregate Justification

### Aggregate Root
User

---

### Why is it an Aggregate?
The User is modelled as a separate aggregate because it defines the consistency boundary for identity, authentication credentials, role assignment and marketing consent. Authentication data (email, password hash), the set of roles and the marketing-consent decision must be managed together. Other aggregates (such as Customer) only reference a User by identity and do not own its internal security or consent state.

---

### Responsibility
Manage the identity, authentication credentials, roles and marketing consent of every actor that can access protected functionality in the LaPrizza system (Manager, Employee and Customer).

---

### Enforced Invariant
- A User must have a unique email address used as authentication credential (login).
- A User must be assigned at least one role (MANAGER, EMPLOYEE or CUSTOMER).
- Authentication credentials must be stored in a secure hashed form; plain-text passwords are never persisted.
- Only an active User may successfully authenticate.
- Marketing consent is recorded with a timestamp and is owned by the User (not by the Customer).

---

### Representative Scenario
Registering a new User and assigning the appropriate role(s). The aggregate root validates the uniqueness of the email and the presence of at least one role before the User can be created.

---

### Sequence Diagram
![User Registration Sequence Diagram](../../user_stories/bck01/sequenceDiagram/sequence_diagram_register.svg)

---

### Short Explanation
- The scenario begins when a Manager (or the system itself for self-registration) submits the new user’s data.
- The application service checks global email uniqueness through the User repository.
- The User aggregate root is instantiated and enforces its invariants (valid email, non-empty role set, secure password handling).
- Only after the invariants are satisfied is the new User persisted.
- This demonstrates that the aggregate is responsible for the integrity of identity and access-control data.

---

## Customer Aggregate Justification

### Aggregate Root
Customer

---

### Why is it an Aggregate?
The Customer is modelled as a separate aggregate because it represents a business entity with its own lifecycle and consistency rules (name, contact information, optional addresses and dietary restrictions). A Customer may exist independently of a User account (for example when registered by staff). The optional association with a User is a reference, not ownership. An anonymous kiosk interaction does not create a persistent Customer record.

---

### Responsibility
Maintain the business information required to serve an identified customer: name, phone number, operational contact email, zero or more addresses and dietary restrictions.

---

### Enforced Invariant
- A Customer must have a non-empty name.
- A Customer must have a phone number and an email address (minimum required business data).
- The Customer email is intended for operational business communications (contact, notifications, invoicing). It must not be confused with the authentication credential maintained in the User Aggregate.
- A Customer may have zero or more addresses (0..*). Address is optional.
- Dietary restrictions are optional (0..*).
- Customer information that is referenced by other business information (e.g. Orders) must not be removed in a way that compromises consistency (soft-delete / deactivation preferred).

---

### Representative Scenario
Registering a new Customer with name, phone number and operational email. The aggregate root rejects the creation if any of these three mandatory fields is missing. Addresses may be omitted.

---

### Sequence Diagram
![Customer Registration Sequence Diagram](../../user_stories/bck02/sequenceDiagram/sequence_diagram_create_customer.svg)

---

### Short Explanation
- The Manager submits the customer data through the application layer.
- The Customer aggregate root validates the mandatory name, phone number and operational email.
- Addresses and dietary restrictions may be empty.
- Marketing consent is not part of this aggregate; it belongs to the User Aggregate.
- The new Customer is persisted only when the minimum business data is valid.
- This shows that the aggregate protects the integrity of customer business data independently of authentication.

---

## Product Aggregate Justification

### Aggregate Root
Product

---

### Why is it an Aggregate?
The Product is the central catalogue entity. It owns the flags that define its possible roles (sellable, stock-controlled, pizza component) together with its name, description and optional base price. These flags and the associated business rules form a single consistency boundary that must be enforced transactionally.

---

### Responsibility
Represent any item managed by the restaurant and control which roles it may play (sellable product, pizza component, stock-controlled item, or a combination of them).

---

### Enforced Invariant
- Sellable and Pizza Component are Product **types**. Stock-controlled is an independent characteristic.
- A Product **MUST** have at least one type: Sellable, Pizza Component, or both.
- Invalid combinations that must be rejected:
  - No type (neither Sellable nor Pizza Component)
  - Exclusively stock-controlled
- When `isPizzaComponent = true` the Product must be associated with exactly one PizzaComponentType.
- The `isActive` flag controls whether a product is currently part of the active catalogue. Setting `isActive = false` disables the product without deleting historical business records (soft deactivation).

---

### Representative Scenario
Creating a new Product that is intended to be used only as a pizza component. The aggregate root rejects the creation if neither the Sellable nor the Pizza Component flag is set, or if the Pizza Component flag is set without a PizzaComponentType.

---

### Sequence Diagram
![Product Creation Sequence Diagram](../../user_stories/bck05/sequenceDiagram/sequence_diagram_create_product.svg)

---

### Short Explanation
- The Manager supplies the product data (name, description, flags and optional base price).
- The Product aggregate root evaluates the type rules before accepting the new instance.
- If the product is marked as a pizza component, the association with exactly one PizzaComponentType is required.
- Only a Product that satisfies the “at least one type” rule is persisted.
- This demonstrates that the aggregate is the guardian of the fundamental classification rules of every item in the catalogue.

---

## Product Category Aggregate Justification

### Aggregate Root
ProductCategory

---

### Why is it an Aggregate?
ProductCategory is an independent aggregate because categories form a shared catalogue that many Products reference. The category’s own identity and name must remain consistent regardless of which products currently belong to it.

---

### Responsibility
Maintain a catalogue of product categories that allow products to be classified and searched.

---

### Enforced Invariant
- Each ProductCategory must have a unique identifier and a non-empty descriptive name.
- A ProductCategory that is still referenced by existing Products must not be removed in a way that compromises consistency.

---

### Representative Scenario
Creating a new Product Category. The aggregate root ensures the name is present and the identifier is unique before the category can be used by Products.

---

### Sequence Diagram
![Product Category Creation Sequence Diagram](../../user_stories/bck03/sequenceDiagram/sequence_diagram_create_category.svg)

---

### Short Explanation
- The Manager requests the creation of a new category.
- The aggregate root validates the name and uniqueness of the identifier.
- Once created, Products may reference the category by ID.
- Removal is only allowed when no Product still depends on it (or is performed as a soft-delete).
- This keeps the classification scheme consistent across the catalogue.

---

## Allergen Aggregate Justification

### Aggregate Root
Allergen

---

### Why is it an Aggregate?
Allergens are shared reference data. They have their own identity and are referenced both by Products and by Customer dietary restrictions. Managing them as an independent aggregate prevents accidental modification of allergen definitions from within a Product or Customer transaction.

---

### Responsibility
Maintain the catalogue of allergens recognised by the restaurant so that products and customer dietary restrictions can be associated with them.

---

### Enforced Invariant
- Each Allergen must have a unique identifier and a non-empty descriptive name.
- An Allergen referenced by existing Products or DietaryRestrictions must not be removed in a way that compromises consistency.

---

### Representative Scenario
Registering a new Allergen. The aggregate root guarantees a unique name/identifier before the allergen becomes available for association with Products.

---

### Sequence Diagram
![Allergen Registration Sequence Diagram](../../user_stories/bck04/sequenceDiagram/sequence_diagram_register_allergen.svg)

---

### Short Explanation
- The Manager adds a new allergen to the catalogue.
- The Allergen aggregate root enforces uniqueness and the presence of a name.
- Products and Customer dietary restrictions later reference the allergen by ID.
- This isolates the allergen catalogue from the lifecycle of any individual Product or Customer.

---

## Pizza Size Aggregate Justification

### Aggregate Root
PizzaSize

---

### Why is it an Aggregate?
PizzaSize is independent reference data. Many ComponentSizeConfigurations and PredefinedPizzas depend on it. Keeping it as its own aggregate guarantees that size definitions remain stable and unique.

---

### Responsibility
Maintain the set of pizza sizes offered by LaPrizza so that size-dependent prices and stock consumption can be defined consistently.

---

### Enforced Invariant
- Each PizzaSize must have a unique identifier and a non-empty descriptive name.
- A PizzaSize referenced by existing ComponentSizeConfigurations must not be removed in a way that compromises consistency.

---

### Representative Scenario
Adding a new Pizza Size (e.g. “Family”). The aggregate root ensures the name is unique before the size can be used in component configurations.

---

### Sequence Diagram
![Pizza Size Creation Sequence Diagram](../../user_stories/bck06/sequenceDiagram/sequence_diagram_create_pizza_size.svg)

---

### Short Explanation
- The Manager registers a new size.
- The aggregate root validates uniqueness and the presence of a name.
- Once accepted, the size can be referenced by ComponentSizeConfigurations.
- This keeps the set of available sizes consistent for all pizza-related pricing and stock rules.

---

## Pizza Component Type Aggregate Justification

### Aggregate Root
PizzaComponentType

---

### Why is it an Aggregate?
PizzaComponentType defines configuration rules (assembly order, minimum and maximum number of components) that must be consistent for every pizza. These rules form a clear consistency boundary that is independent of any individual Product.

---

### Responsibility
Classify the role that a pizza component plays (Base Dough, Base Sauce, Cheese, Topping, \ldots) and define the cardinality and assembly-order constraints that every pizza configuration must respect.

---

### Enforced Invariant
- `minQuantity ≥ 0`.
- `maxQuantity ≥ minQuantity` (or unbounded).
- Two PizzaComponentTypes must not share the same `assemblyOrder`.
- The set of types is configurable and must not be hard-coded in the application.

---

### Representative Scenario
Creating the initial set of Pizza Component Types (Base Dough, Base Sauce, Cheese, Topping). The aggregate root rejects any type whose assembly order collides with an existing type or whose quantity bounds are invalid.

---

### Sequence Diagram
![Pizza Component Type Creation Sequence Diagram](../../user_stories/bck07/sequenceDiagram/sequence_diagram_create.svg)

---

### Short Explanation
- The Manager defines a new component type with its assembly order and quantity limits.
- The aggregate root checks that the assembly order is unique and that the quantity bounds are consistent.
- Only a valid type is persisted and later used by Products designated as pizza components.
- This guarantees that every pizza configuration can be validated against a coherent set of rules.

---

## Component Size Configuration Aggregate Justification

### Aggregate Root
ComponentSizeConfiguration

---

### Why is it an Aggregate?
A ComponentSizeConfiguration captures the size-dependent price and stock consumption of a single pizza component. The pair (Product, PizzaSize) must be unique and the numeric values must satisfy business validation rules. These constraints form a natural consistency boundary.

---

### Responsibility
Define, for a given Pizza Component and Pizza Size, the applicable price and the number of abstract stock units consumed when that component is used in a pizza of that size.

---

### Enforced Invariant
- Only a Product designated as Pizza Component may have Component Size Configurations.
- For a given Product + PizzaSize pair at most one configuration may exist.
- Price must be a valid monetary value.
- StockUnitsConsumed must be a non-negative integer.

---

### Representative Scenario
A Manager creates a ComponentSizeConfiguration by providing a Product identifier, a PizzaSize identifier a price, and the applicable stock-consumption value. The system verifies that both entities exist, that the Product is eligible as a pizza component, and that no configuration already exists for the same pair. The aggregate validates the price and the conditional stock-consumption rules. Before persistence, an impact guard checks whether the operation is safe. If all validations succeed, the configuration is persisted within a transaction; otherwise, the operation is rejected.

---

### Sequence Diagram
![Component Size Configuration Sequence Diagram](../../user_stories/bck08/sequenceDiagram/sequence_diagram_create.svg)

---

### Short Explanation
- The Manager supplies a Product (pizza component), a PizzaSize, a price and a stock-consumption value.
- The aggregate root verifies that the Product is a pizza component and that no configuration already exists for that pair.
- Numeric invariants (price validity, non-negative stock units) are enforced before persistence.
- This isolates size-dependent commercial and stock rules from the Product and PizzaSize aggregates themselves.

---

## Predefined Pizza Aggregate Justification

### Aggregate Root
PredefinedPizza

---

### Why is it an Aggregate?
A PredefinedPizza owns its default component configuration. The configuration must satisfy the cardinality rules of every PizzaComponentType and may only be offered in sizes for which all components have a ComponentSizeConfiguration. These rules constitute a single consistency boundary.

---

### Responsibility
Represent a standard pizza offered to customers as a sellable Product together with its default set of pizza components.

---

### Enforced Invariant
- A PredefinedPizza is represented by an appropriate sellable Product.
- The default configuration may contain only active Products currently designated as Pizza Components.
- The same Pizza Component must not appear more than once.
- The configuration must respect the min/max cardinality of each PizzaComponentType.
- The pizza may only be made available in Pizza Sizes for which every component in the default configuration possesses a ComponentSizeConfiguration.
- The selling price of the pizza is calculated from the size-dependent prices of its components (no extra base price is added).

---

### Representative Scenario
A Manager creates a PredefinedPizza by providing a predefined pizza business identifier, a representative Product identifier, and a list of component Product identifiers. The system verifies that the identifiers are not already associated with an existing PredefinedPizza and retrieves the required configuration facts. The aggregate validates that the representative Product is sellable, that all selected components are eligible, that no duplicates exist, and that the cardinality rules of each PizzaComponentType are satisfied. It also requires at least one active PizzaSize with complete ComponentSizeConfiguration coverage for all selected components. If all validations succeed, the PredefinedPizza and its default components are persisted atomically; otherwise, the operation is rejected.

---

### Sequence Diagram
![Predefined Pizza Creation Sequence Diagram](../../user_stories/bck10/sequenceDiagram/sequence_diagram_create.svg)


---

### Short Explanation
- The Manager selects a sellable Product and a list of component Product IDs.
- The PredefinedPizza aggregate root checks that every component is an active pizza component, that there are no duplicates, and that the cardinality rules of each PizzaComponentType are satisfied.
- Availability per size is derived from the existence of ComponentSizeConfigurations.
- Only a configuration that passes all invariants is stored.
- This guarantees that every predefined pizza offered in the catalogue is commercially and operationally consistent.

---

## Stock Information Aggregate Justification

### Aggregate Root
StockInformation

---

### Why is it an Aggregate?
Stock quantity is a consistency-critical piece of data. Increasing or decreasing the quantity must never produce a negative value, and stock information may exist only for Products that are marked as stock-controlled. These rules form a clear transactional boundary.

---

### Responsibility
Maintain the current quantity (in abstract stock units) of every product that is subject to stock control, and provide safe operations to increase or decrease that quantity.

---

### Enforced Invariant
- StockInformation may exist only for Products with `isStockControlled = true`.
- `availableUnits` must always be a non-negative integer.
- A stock-reduction operation must be rejected if it would result in a negative quantity.

---

### Representative Scenario
A Manager adjusts the stock of a Product by providing its identifier, an adjustment direction, and the number of units. The system verifies that the Product exists and is stock-controlled, then retrieves its StockInformation within a transaction. The aggregate validates that the adjustment does not result in a negative stock quantity. If the validation succeeds, the updated stock is persisted atomically; otherwise, the operation is rejected without modifying the available quantity.

---

### Sequence Diagram
![Stock Adjust Sequence Diagram](../../user_stories/bck09/sequenceDiagram/sequence_diagram_adjust_stock.svg)

---

### Short Explanation
- The Manager requests a stock adjustment for a Product, specifying the direction and number of units.
- The application service verifies that the Product exists and is stock-controlled, then retrieves its StockInformation with a database lock.
- The StockInformation aggregate root applies the adjustment, ensuring that the resulting availableUnits is a non-negative integer.
- If the adjustment is valid, the updated quantity is persisted within a transaction; otherwise, the operation is rejected.
- Stock adjustments do not modify the Product's activation state, and a stock quantity of zero is permitted.

---

## Cross-Aggregate Relationships and Constraints (Summary)

| Relationship | Cardinality / Constraint | Justification |
|--------------|--------------------------|---------------|
| Customer ↔ User | 0..1 ↔ 0..1 | A Customer may or may not have a login account; a User with role MANAGER/STAFF is not a Customer. |
| Product → ProductCategory | many-to-one | Every product is classified by a category (BCK03). |
| Product → Allergen | many-to-many | Products may contain one or more allergens (BCK04/BCK05). |
| Product → PizzaComponentType | 0..1 → 1 (when isPizzaComponent) | A pizza component must have exactly one type (BCK05/BCK07). |
| ComponentSizeConfiguration → Product + PizzaSize | unique pair | At most one price/stock configuration per component and size (BCK08). |
| PredefinedPizza → Product | 1 → 1 (sellable) | A predefined pizza is represented by a sellable product (BCK10). |
| StockInformation → Product | 1 → 1 (stock-controlled only) | Stock is maintained only for products marked as stock-controlled (BCK09). |
| Order → Customer | 0..1 | An order may be placed by an identified Customer or anonymously (kiosk); anonymous interactions do not create a persistent Customer. |
| OrderItem → Product / PersonalizedPizzaConfiguration | alternative | An item is either a catalogue product or a preserved custom pizza configuration. |

---

## Catalogue (BCK11) – Not an Aggregate

The Product Catalogue is **not** modelled as a domain aggregate.  
It is a read-model / query built from:

- Products with `isSellable = true` and `isActive = true`
- PredefinedPizzas and their default configurations
- ComponentSizeConfigurations (for size-dependent prices and availability)
- Allergens and ProductCategories

The catalogue simply reflects the current state of the domain; it has no independent identity or lifecycle.

---

## Persistence Recommendation (linked to the model)

Given the number of cross-aggregate constraints, uniqueness rules and referential-integrity requirements expressed above, a **relational database** is the most appropriate persistence technology for this domain model.  
Foreign keys, unique constraints and check constraints can enforce many of the invariants at the storage level, complementing the validations performed by the aggregate roots (see ARC04).
