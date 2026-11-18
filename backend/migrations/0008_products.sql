-- BCK05 Product Management (ARC04).
-- Must run after 0003 (product_categories), 0004 (allergens) and 0007
-- (pizza_component_types), and before 0009 (BCK09 stock_information -> products).
-- Business identifiers are "PROD-" + zero-padded sequence value (e.g. PROD-00123),
-- allocated by the database so that concurrent requests can never collide.
CREATE SEQUENCE product_id_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE TABLE products (
  id VARCHAR(32) PRIMARY KEY CHECK (id ~ '^PROD-[0-9]{5,}$'),
  -- BR2: names are mandatory but NOT unique (client clarification).
  name VARCHAR(100) NOT NULL
    CHECK (length(name) BETWEEN 1 AND 100 AND name = btrim(name)),
  description VARCHAR(500) NOT NULL
    CHECK (length(description) BETWEEN 1 AND 500 AND description = btrim(description)),
  -- BR3: exactly one existing Product Category (BCK03).
  category_id VARCHAR(32) NOT NULL
    REFERENCES product_categories(id) ON DELETE RESTRICT,
  is_sellable BOOLEAN NOT NULL DEFAULT FALSE,
  is_pizza_component BOOLEAN NOT NULL DEFAULT FALSE,
  -- Stock quantities live in BCK09 (stock_information); only the flag is stored here.
  is_stock_controlled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- BR5: Pizza Component Type (BCK07).
  pizza_component_type_id VARCHAR(32)
    REFERENCES pizza_component_types(id) ON DELETE RESTRICT,
  pricing_mode VARCHAR(32),
  base_price_amount NUMERIC(10,2) CHECK (base_price_amount >= 0),
  base_price_currency CHAR(3) CHECK (base_price_currency = 'EUR'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at)),
  -- BR4: Sellable and/or Pizza Component; never "only stock controlled".
  CONSTRAINT products_type_check CHECK (is_sellable OR is_pizza_component),
  -- BR5: component <=> exactly one component type.
  CONSTRAINT products_component_type_check
    CHECK (is_pizza_component = (pizza_component_type_id IS NOT NULL)),
  -- BR6: non-sellable -> no pricing; FIXED -> EUR price >= 0;
  -- COMPONENT_BASED (BCK10 predefined pizzas) -> no base price and not a component.
  CONSTRAINT products_pricing_check CHECK (
    (NOT is_sellable AND pricing_mode IS NULL
      AND base_price_amount IS NULL AND base_price_currency IS NULL)
    OR (is_sellable AND pricing_mode = 'FIXED'
      AND base_price_amount IS NOT NULL AND base_price_currency = 'EUR')
    OR (is_sellable AND NOT is_pizza_component AND pricing_mode = 'COMPONENT_BASED'
      AND base_price_amount IS NULL AND base_price_currency IS NULL)
  )
);

CREATE INDEX products_category_id_idx ON products (category_id);
CREATE INDEX products_pizza_component_type_id_idx ON products (pizza_component_type_id);

-- BR7: zero or more allergens per product, without duplicates (primary key).
-- Allergen links belong to the Product aggregate; allergens themselves are protected
-- by ON DELETE RESTRICT (BCK04 relies on this).
CREATE TABLE product_allergens (
  product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  allergen_id SMALLINT NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, allergen_id)
);

-- Supports BCK04's "is the allergen referenced?" check and BR8 allergen exclusion.
CREATE INDEX product_allergens_allergen_id_idx ON product_allergens (allergen_id);