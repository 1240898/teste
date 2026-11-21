-- SYS08 / GDP: erase a customer record (re-applied after a restore).
-- Usage: psql -v id=CUST-0042 -f erase-customer.sql
-- customers and its allergen links use ON DELETE RESTRICT, so the links go first.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM customer_dietary_restriction_allergens WHERE customer_id = :'id';
DELETE FROM customers WHERE id = :'id';
COMMIT;