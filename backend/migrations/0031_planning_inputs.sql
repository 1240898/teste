-- AI06 input retention is planning data, separate from operational stock/orders.
CREATE TABLE planning_product_settings (
  product_id text PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  stock_unit text NOT NULL CHECK (length(trim(stock_unit)) > 0),
  stock_units_per_sale bigint CHECK (stock_units_per_sale >= 0 AND stock_units_per_sale <= 9007199254740991)
);

CREATE TABLE planning_input_runs (
  execution_id uuid PRIMARY KEY,
  selection jsonb NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  expires_at timestamptz NOT NULL,
  snapshot_id uuid UNIQUE,
  document jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((snapshot_id IS NULL) = (document IS NULL))
);
