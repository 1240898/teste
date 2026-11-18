CREATE TABLE component_size_configurations (
  product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  size_id VARCHAR(32) NOT NULL REFERENCES pizza_sizes(id) ON DELETE RESTRICT,
  price_amount NUMERIC NOT NULL
    CHECK (price_amount >= 0 AND price_amount = trunc(price_amount, 2)),
  price_currency TEXT NOT NULL CHECK (price_currency = 'EUR'),
  stock_units_consumed INTEGER,
  PRIMARY KEY (product_id, size_id),
  CONSTRAINT component_size_configurations_stock_units_check
    CHECK (stock_units_consumed IS NULL OR stock_units_consumed >= 0)
);
