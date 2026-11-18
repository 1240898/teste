-- BCK02 x BCK04: allergen related to a customer's dietary restriction.
-- Name and description stay in customers.dietary_restrictions (JSON, which also keeps
-- allergenId for reading). A JSON column cannot hold a foreign key, so this table
-- mirrors the allergen links and protects allergens used by customers with a real
-- foreign key (BCK04 AC6 / BR3 / BR5).
-- CustomerRepository.save rewrites the links in the same transaction as the customer row.
CREATE TABLE customer_dietary_restriction_allergens (
  -- 0002 convention: foreign keys to customers(id) use VARCHAR and ON DELETE RESTRICT.
  customer_id VARCHAR NOT NULL
    CONSTRAINT customer_dietary_restriction_allergens_customer_id_fkey
    REFERENCES customers(id) ON DELETE RESTRICT,
  restriction VARCHAR(100) NOT NULL CHECK (length(restriction) > 0),
  allergen_id SMALLINT NOT NULL
    CONSTRAINT customer_dietary_restriction_allergens_allergen_id_fkey
    REFERENCES allergens(id) ON DELETE RESTRICT,
  PRIMARY KEY (customer_id, restriction)
);

-- Supports BCK04's "is the allergen referenced?" check.
CREATE INDEX customer_dietary_restriction_allergens_allergen_id_idx
  ON customer_dietary_restriction_allergens (allergen_id);