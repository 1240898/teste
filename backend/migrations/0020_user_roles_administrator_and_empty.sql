-- AA03: Sprint 2 role model (Table 1). Adds ADMINISTRATOR and allows an
-- account to hold no role (0..4 distinct roles). Existing rows (1..3 roles
-- from the old set) remain valid, so no data migration is needed.
-- The initial CUSTOMER role is assigned by the User aggregate, not by a
-- column DEFAULT, so an INSERT without roles still fails (roles NOT NULL).
ALTER TABLE users DROP CONSTRAINT users_roles_valid;

ALTER TABLE users ADD CONSTRAINT users_roles_valid CHECK (
  cardinality(roles) BETWEEN 0 AND 4
  AND (cardinality(roles) = 0 OR (array_ndims(roles) = 1 AND array_lower(roles, 1) = 1))
  AND array_position(roles, NULL) IS NULL
  AND roles <@ ARRAY['ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER']::text[]
  AND cardinality(roles) =
    ('ADMINISTRATOR' = ANY(roles))::int + ('MANAGER' = ANY(roles))::int
    + ('EMPLOYEE' = ANY(roles))::int + ('CUSTOMER' = ANY(roles))::int
);