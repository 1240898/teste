-- BCK04 Allergen Management (ARC04).
-- Identifiers are the official EU Regulation No. 1169/2011 numbers (1..14) 
CREATE TABLE allergens (
  id SMALLINT PRIMARY KEY CHECK (id BETWEEN 1 AND 14),
  name VARCHAR(100) NOT NULL CHECK (length(name) BETWEEN 1 AND 100 AND name = btrim(name)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at))
);

-- BR1/BR5: names are unique case-insensitively. The functional index is the last line
-- of defence against concurrent duplicates (mapped to HTTP 409 by the repository).
CREATE UNIQUE INDEX allergens_name_key ON allergens (lower(name));

-- BR3/BR5: tables that reference allergens are introduced by other user stories and
-- must declare their foreign key as
--   allergen_id SMALLINT NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT
-- BCK05: product_allergens (product_id, allergen_id)
-- BCK02: customer_dietary_restriction_allergens (customer_id, restriction, allergen_id)