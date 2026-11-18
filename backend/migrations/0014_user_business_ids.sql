-- Replace the persistence UUID exposed as UserId with the BCK01 business ID.
-- Preserve existing customer links while moving their FK to the business ID.
CREATE SEQUENCE user_id_seq START WITH 1;

CREATE TEMP TABLE user_id_migration_map AS
SELECT
  id AS old_id,
  'USR-' || lpad(id_number::text, GREATEST(5, length(id_number::text)), '0') AS new_id
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS id_number
  FROM users
) ordered_users;

ALTER TABLE customers DROP CONSTRAINT customers_user_id_fkey;
DROP INDEX customers_user_id_key;

ALTER TABLE customers ADD COLUMN user_id_business VARCHAR(32);
UPDATE customers AS customer
SET user_id_business = mapping.new_id
FROM user_id_migration_map AS mapping
WHERE customer.user_id = mapping.old_id;
ALTER TABLE customers DROP COLUMN user_id;
ALTER TABLE customers RENAME COLUMN user_id_business TO user_id;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_check;
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
UPDATE users AS account
SET id = mapping.new_id
FROM user_id_migration_map AS mapping
WHERE account.id = mapping.old_id::text;
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(32);
ALTER TABLE users ADD CONSTRAINT users_id_format CHECK (id ~ '^USR-[0-9]{5,}$');

ALTER TABLE customers
  ADD CONSTRAINT customers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX customers_user_id_key ON customers(user_id) WHERE user_id IS NOT NULL;

DROP TABLE user_id_migration_map;
SELECT setval('user_id_seq', GREATEST(1, (SELECT count(*) + 1 FROM users)), false);
