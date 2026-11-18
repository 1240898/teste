CREATE SEQUENCE customer_id_seq START WITH 1;

CREATE TABLE customers (
  id VARCHAR PRIMARY KEY CHECK (id ~ '^CUST-[0-9]{4,}$'),
  name VARCHAR(100) NOT NULL CHECK (length(btrim(name)) > 0 AND name = btrim(name)),
  phone_number VARCHAR(16) NOT NULL CHECK (length(btrim(phone_number)) > 0 AND phone_number = btrim(phone_number)),
  email VARCHAR(254) NOT NULL CONSTRAINT customers_email_key UNIQUE,
  dietary_restrictions JSON NOT NULL DEFAULT '[]' CHECK (json_typeof(dietary_restrictions) = 'array'),
  user_id UUID NULL CONSTRAINT customers_user_id_fkey REFERENCES users(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at)),
  CONSTRAINT customers_email_canonical CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT customers_phone_e164 CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$')
);
CREATE UNIQUE INDEX customers_user_id_key ON customers(user_id) WHERE user_id IS NOT NULL;

-- Future foreign keys to customers(id) must use VARCHAR and ON DELETE RESTRICT.
