CREATE TABLE users (
  id UUID PRIMARY KEY CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  name VARCHAR(100) NOT NULL CHECK (length(btrim(name)) > 0 AND name = btrim(name)),
  email VARCHAR(254) NOT NULL CONSTRAINT users_email_key UNIQUE,
  password_hash TEXT NOT NULL CHECK (password_hash ~ '^\$2[aby]\$(1[0-9]|2[0-9]|3[01])\$[./A-Za-z0-9]{53}$'),
  roles TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent_timestamp TIMESTAMPTZ NOT NULL CHECK (isfinite(marketing_consent_timestamp)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at)),
  CONSTRAINT users_email_canonical CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT users_roles_valid CHECK (
    cardinality(roles) BETWEEN 1 AND 3
    AND array_ndims(roles) = 1 AND array_lower(roles, 1) = 1
    AND array_position(roles, NULL) IS NULL
    AND roles <@ ARRAY['MANAGER', 'EMPLOYEE', 'CUSTOMER']::text[]
    AND cardinality(roles) =
      ('MANAGER' = ANY(roles))::int + ('EMPLOYEE' = ANY(roles))::int + ('CUSTOMER' = ANY(roles))::int
  )
);
