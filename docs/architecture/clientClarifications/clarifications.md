# Client Clarifications

1. **Customer — mandatory data**  
   It was mentioned that the minimum data includes **Name**, **Phone Number**, and a third field that we were unable to identify clearly. What is this third field?

2. **Customer and User**  
   It was confirmed that a Customer can exist without an associated User, for example in a kiosk scenario. If that Customer later creates an account, should we associate the new User with the existing Customer? If so, what information should be used to identify them?

3. **Predefined Pizza price**  
   It was mentioned that customized pizzas have their price calculated through their components. How should the price of a **Predefined Pizza** be calculated? Should there be a base/fixed price, should it be calculated from the components, or should some production cost also be considered?

4. **Changes to a Predefined Pizza**  
   When a customer adds, removes, or replaces components of a Predefined Pizza, should the final price be fully recalculated based on the final components, or should it start from the Predefined Pizza's base price and only apply differences/extras?

5. **Availability by size and Stock**  
   It was indicated that a Predefined Pizza is only available in a given size when the components exist for that size and are in stock. In this context, does "being in stock" simply mean `quantity > 0`, or should there be enough stock to cover the `stock consumption` configured for that size?

6. **Components without Stock control**  
   Should a Pizza Component that is not `stock-controlled` always be considered available when determining the available sizes?

7. **Catalogue behaviour**  
   If a size temporarily becomes unavailable due to insufficient stock of a component, should the size disappear from the catalogue, or should it remain visible as unavailable?

8. **Search by ingredients**  
   When search by **Ingredients** is mentioned, does this mean searching for pizzas that contain a particular ingredient, searching directly for Products that are Pizza Components, or both?

9. **Future search by Allergens/Diet**  
   In the case of Allergens, should the system search for products that **contain** a particular allergen, exclude products that contain it, or support both?

   And regarding "Diet", which categories should be considered (for example Vegetarian, Vegan, Gluten-Free, Lactose-Free)?

10. **Personalized Pizza**  
    Can a personalized pizza be created completely from scratch, or must it always start from a Predefined Pizza?

---

## Answers to the Questions

1. **Customer — mandatory data:**  
   The minimum data for a Customer is **Name, Phone Number, and Email**.

2. **Customer and User:**  
   The Customer referred to in the kiosk scenario is an **anonymous Customer**, meaning that there is no persistent record of that Customer that would later need to be associated with a User. If the customer creates an account, the corresponding record will be created, and there is no need to identify or associate the previous anonymous Customer.

3. **Predefined Pizza price:**  
   For simplicity, assume that the prices of Pizza Components **already include production/labour costs**. Therefore, the price of the pizza is determined by its components.

4. **Changes to a Predefined Pizza:**  
   When components are added, removed, or replaced, the price should be **recalculated based on the pizza's final set of components**.

5. **Availability by size and Stock:**  
   There must be enough stock to cover the `stock consumption` defined for that size. For example, if there are 2 units of dough in stock and a Small pizza consumes 1 unit, Medium consumes 2 units, and Large consumes 4 units, then Small and Medium are available, while Large is not.

6. **Components without Stock control:**  
   Yes. A Pizza Component that is not `stock-controlled` should be considered available for this purpose.

7. **Catalogue behaviour:**  
   The pizza should continue to appear in the catalogue, but should be presented as **unavailable**, either completely or partially, depending on whether none or only some of the sizes are available.

8. **Search by ingredients:**  
   Both situations should be supported. The search is a **Product** search and, in the case of pizzas, it should also allow searching through their respective **Pizza Components**.

9. **Search by Allergens/Diet:**  
   The main goal is to allow users to **exclude products** that contain certain allergens/components, for example gluten, peanuts, or lactose. For restrictions such as `Vegetarian`, an equivalent approach can be considered: for example, identifying/excluding components that contain meat or, more generally, components of animal origin, depending on the restriction being considered.

10. **Personalized Pizza:**  
    A Personalized Pizza **can be built completely from scratch**. It is not mandatory to start from a Predefined Pizza. Naturally, the created pizza must comply with the restrictions defined in the requirements.

---

# 2. Customers and User Accounts

The specification states that customers can register themselves. On the other hand, customer management is handled by the LaPrizza manager, who registers and updates customer records. There are also users with credentials to log into the system.

In the first version of the system, the customer needs to have an account to log into the system (for example, with email and password). Are "Customer" and "User" the same record or two linked records?

### Customers and User Accounts


**Customer and User should be considered distinct concepts, although they may be related.** A Customer represents the business information associated with a customer, with Name, Phone Number, and Email as the minimum data. A User represents someone who uses the system and may correspond, for example, to a Customer, Manager, or Employee. Customers may exist without an associated User, namely in the case of an anonymous customer at a kiosk, in which case no persistent record is created that would later need to be associated with an account.

In this first phase, you should **model these concepts and the relationships you consider appropriate for the domain**, including the different types/roles of users. However, regarding implementation, the focus of this Sprint is the **back-end/API**: there is no need to implement a user application, such as a login screen, but you must implement through the API the management of Users/Roles and the authentication mechanisms required to identify users in protected operations.

Therefore, do not assume that Customer and User are simply the same record. The domain model should allow a broader view of the system and support its future evolution, while the implementation in this Sprint should be limited to the back-end functionalities planned for this phase.

---

# 3. Roles and Permissions

The specification requires the system to distinguish what each type of user can do, but it does not indicate what these types are. The descriptions refer to the **manager** (Manager) and the **customer** (Customer).

Which roles should exist in the first phase? Can a user have more than one role?

### Roles and Permissions

In this first phase, you should consider at least the roles **Manager, Customer, and Employee**. A User may have **more than one role**, if necessary to represent different responsibilities in the system.

---

# 4. Administrator and Payments

**1. Administrator:**

Does it make sense to have an administrator profile, with all the manager's functionalities and, in addition, the ability to manage manager permissions? Or should user management be handled by the manager?

**2. Payments:**

Should the system include online payment for orders through an external service? Or is payment outside the scope of the prototype?

### Administrator and Payments

1. **Administrator:**  
   For this phase, it is not necessary to introduce an additional Administrator profile. **User and Role management can be handled by the Manager**. The architecture can, naturally, be designed to allow the future introduction of other roles and different levels of permissions.

2. **Payments:**  
   **Online payment is not part of the current prototype scope**. Therefore, it is not necessary to implement an integration with any external payment service at this stage.

---

# 5. Predefined Pizza Prices

The System Specification (II.3.1.2) states that the price of a pizza may depend on its size and configuration, and that the specific pricing rules are established by the User Stories. BCK11 requires the catalogue to show pricing information for sellable products and the sizes in which each predefined pizza is available. However, the Sprint 1 User Stories do not specify how a predefined pizza's price is determined.

I was wondering if a pre-defined pizza (like a Margherita, for example) has its price defined by either:

a) A fixed price defined by LaPrizza for each available size (for example: Small €8.00, Medium €10.00, Large €12.00)

or

b) A price calculated from the size-dependent prices of its components (for example: Large = Large dough €3.00 + Large sauce €1.00 + Large mozzarella €2.00 = €6.00),

and if so, is there a base price added on top of this value for labour pricing or other reasons?


### Pre-defined Pizza Prices

Option **b)** should be considered: the price of a Predefined Pizza is calculated from the **prices of its components for the respective size**.

For simplicity, assume that the prices defined for Pizza Components **already include production/labour costs**, so no additional base price or extra cost should be added to the sum of the components.

---

# 6. Product Characteristics Combinations

According to User Story BCK05, a product may adopt "any applicable combination" of characteristics (sellable, stock-controlled, or pizza component) based on business rules.

Could you clarify if the system should block invalid combinations, such as a product with no assigned roles or one that is exclusively stock-controlled, or if it should remain flexible, leaving this responsibility to the Manager?

If the system has to enforce these restrictions, could you also specify which exact combinations should be considered invalid?

### Product Characteristics Combinations

The system should validate the combinations. **Sellable** and **Pizza Component** should be considered types of Product, while **stock-controlled** is an independent characteristic.

Therefore, all Products must have **at least one type**: Sellable, Pizza Component, or both. A Product cannot, therefore, be exclusively stock-controlled or exist without either of these two types. On the other hand, any Product, regardless of its type, may or may not be subject to stock control.


