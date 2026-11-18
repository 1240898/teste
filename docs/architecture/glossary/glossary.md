# Domain Glossary

## Cross-cutting concepts

| Term | Definition |
|---|---|
| Aggregate | A cluster of domain objects treated as a single consistency unit, accessed through its root. |
| Aggregate Root | The entity that controls access to the aggregate and enforces its business rules. |
| Entity | An object with its own identity that persists over time. |
| Value Object (VO) | An immutable object defined only by its values, with no identity. |

## User

| Term | Definition |
|---|---|
| User | System access account, with credentials and one or more roles. |
| UserId | Unique identifier of the user. |
| Email | The user's email address, used for authentication and contact. |
| Password | Access credential, stored as a hash. |
| UserName | The user's name. |
| UserRole | Role assigned to the user: MANAGER, EMPLOYEE or CUSTOMER. |
| active | Whether the user account is active. |

## Customer

| Term | Definition |
|---|---|
| Customer | A pizzeria customer, linked to a User. |
| CustomerId | Unique identifier of the customer. |
| CustomerName | The customer's name. |
| ContactInfo | The customer's contact details (phone number and email). |
| PhoneNumber | The customer's phone number, part of ContactInfo. |
| Address | A customer address (street, postal code, city). A customer may have several. |
| AddressId | Unique identifier of the address. |
| DietaryRestriction | A dietary restriction recorded for the customer, related to allergens. |
| MarketingConsent | The customer's consent to marketing communications, with timestamp. |

## Catalogue

| Term | Definition |
|---|---|
| Product | A catalogue item. It may be sellable, stock-controlled and/or a pizza component (roles can be combined). |
| ProductId, ProductName, ProductDescription | Identifier, name and description of the product. |
| Money | A monetary value (amount and currency). |
| basePrice | The product's base price (Money). |
| isActive | The product is active in the catalogue. |
| isSellable | The product can be sold directly. |
| isStockControlled | The product's available quantity is tracked. |
| isPizzaComponent | The product can be used as an ingredient/component of a pizza. |
| ProductCategory | A category that groups products (with CategoryId and CategoryName). |
| Allergen | A food allergen that may be present in products and dietary restrictions (with AllergenId and AllergenName). |

## Pizzas

| Term | Definition |
|---|---|
| PizzaSize | An available pizza size (with PizzaSizeId and PizzaSizeName). |
| Pizza Component | A product designated as suitable for use in pizza configuration. It is not a distinct kind of product. |
| PizzaComponentType | A type of pizza component (e.g. base, sauce, topping). Defines assembly order and minimum/maximum quantities. |
| ComponentTypeId, ComponentTypeName | Identifier and name of the pizza component type. |
| Base Dough, Base Sauce, Cheese, Topping | Examples of pizza component types, classifying the role a component plays in a pizza. |
| assemblyOrder | Position of the component type in the pizza assembly sequence. |
| minQuantity, maxQuantity | Minimum and maximum number of components of that type in a pizza. |
| ComponentSizeConfiguration | Configuration of a component for a specific size: price and stock units consumed. |
| ComponentSizeConfigId | Unique identifier of the component size configuration. |
| StockUnitsConsumed | Stock units consumed by a component at a given size. |
| PredefinedPizza | A menu pizza with a default configuration. |
| PredefinedPizzaId | Unique identifier of the predefined pizza. |
| PizzaConfiguration | The list of components that make up a predefined pizza. |
| Personalized Pizza | A pizza configuration created in the context of an order, typically derived from a predefined pizza. It is not a catalogue product. |
| PersonalizedPizzaConfiguration | A custom pizza configuration (chosen size and components), preserved in the order item. |

## Stock

| Term | Definition |
|---|---|
| StockInformation | Stock information for a stock-controlled product. |
| StockId | Unique identifier of the stock record. |
| AbstractStockQuantity | Abstract quantity of available units (availableUnits, never negative). |
| Stock Unit | A normalized, product-specific quantity used for stock control, without physical units of measurement. |
| Replenishment | An increase in the number of stock units available for a product. |

## Orders

| Term | Definition |
|---|---|
| Order | An order placed by a customer, made up of one or more items. |
| OrderId | Unique identifier of the order. |
| OrderStatus | Order state: DRAFT_SIMULATED, CONFIRMED, IN_PREPARATION, READY, SERVED or CANCELLED. |
| Simulated Order | A preview of an order's contents and price, before confirmation, that does not create an effective order (DRAFT_SIMULATED). |
| placedAt | Date/time when the order was placed. |
| OrderItem | An order line: a catalogue product or a personalized pizza, with quantity and unit price. |
| OrderItemId | Unique identifier of the item. |
| quantity | Number of units of an order item (must be positive). |
| OrderItemStatus | Item state: PENDING, PREPARING, READY or SERVED. |
| unitPrice | The item's unit price, preserved when the order is confirmed. |

## Kitchen and scheduling

| Term | Definition |
|---|---|
| PreparationActivity | An activity required to prepare an order, with an estimated duration. |
| ActivityId | Unique identifier of the preparation activity. |
| ActivityType | Activity type: ASSEMBLY or BAKING. |
| ExecutionState | Execution state: WAITING, SCHEDULED, IN_EXECUTION or COMPLETED. |
| Dependency | A sequencing constraint: a preparation activity may require another activity to be completed first. |
| KitchenResource | A kitchen resource with a capacity, type and status. |
| ResourceId, ResourceName | Identifier and name of the kitchen resource. |
| ResourceType | Resource type: PREPARATION_STATION or OVEN. |
| Oven, Preparation Station | Kitchen resources used in preparation activities. Ovens are the main constraint when scheduling baking. |
| ResourceStatus | Resource status: AVAILABLE, BUSY or MAINTENANCE. |
| FoodPreparationSchedule | A generated preparation plan that schedules activities and allocates resources. |
| ScheduleId | Unique identifier of the schedule. |
| generatedAt | Date/time when the schedule was generated. |
| ScheduledSlot | A time interval (start and end) assigned in the schedule. |

## Context Map Level 2

Catalogue items keep the same `ProductId` in both contexts. [Procurement Context Map](../SAD.md#26-procurement-context-map-ddd)

### Backoffice (Web API)

| Term | Meaning in Backoffice |
| --- | --- |
| Customer order (`Order`) | Order placed by a customer, made up of one or more items. |
| Order item (`OrderItem`) | Line of an order with a quantity and, for pizzas, the selected size and any recorded custom components. |
| Consumption forecast | Saved estimate of demand over a period. |
| Forecast entry | Expected quantity of a product on a given day, with the size where applicable. |
| Predefined pizza | A pizza in the catalogue with a default selection of components. |
| Component size configuration | Settings for one component at one pizza size, including how many stock units it uses per pizza. |
| Product | Catalogue record with the product ID, active status and roles, such as sellable item or pizza component. |
| Stock information | Operational stock record for a product. Its current balance gives the available stock units. |

### Procurement (Prolog)

| Term | Meaning in Procurement |
| --- | --- |
| Demand line | Quantity to plan for, with a date for daily forecasts and a BOM reference for pizzas. |
| Pizza BOM | Components and stock units needed for one pizza of the selected size and composition. Demand lines refer to it by `bomId` within the scenario. |
| Product | Item needed by the selected planning scenario. It keeps the Backoffice `ProductId` if it comes from the catalogue, along with its stock-tracking status and classification as a terminal item or aggregate. |
| Stock snapshot | Set of starting balances used in a run. It can come from current, simulated or previously saved stock. |
| Opening stock | Starting balance for one product in the snapshot. |
| Confirmed supplier scenario | Version of the suppliers and offers the Manager approved for planning. |
| Supplier offer | Terms for one product from one supplier. They include the price in EUR, the stock units that price covers, the delivery lead time and an optional daily limit. |
| Supplier | Business that offers products for replenishment. |
| Supplier order proposal (AI02) | Suggested purchase with a supplier, products, quantities and order and delivery dates. A real purchase order requires separate confirmation in Backoffice. |
