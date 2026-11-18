-- BCK10-owned tables. Product references use BCK05 business keys (VARCHAR(32));
-- database-only UUIDs identify rows owned by this module.
CREATE TABLE predefined_pizzas (
  storage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predefined_pizza_id VARCHAR NOT NULL UNIQUE
    CHECK (predefined_pizza_id ~ '^PIZZA-[0-9]{5,}$'),
  product_id VARCHAR(32) NOT NULL UNIQUE
    REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE predefined_pizza_components (
  predefined_pizza_storage_id UUID NOT NULL
    REFERENCES predefined_pizzas(storage_id) ON DELETE CASCADE,
  component_product_id VARCHAR(32) NOT NULL
    REFERENCES products(id) ON DELETE RESTRICT,
  PRIMARY KEY (predefined_pizza_storage_id, component_product_id)
);

CREATE INDEX predefined_pizza_components_product_id_idx
  ON predefined_pizza_components (component_product_id);
