CREATE SEQUENCE stock_information_id_seq START WITH 1;

CREATE TABLE stock_information (
  id UUID PRIMARY KEY,
  stock_code VARCHAR NOT NULL,
  product_id VARCHAR(32) NOT NULL,
  available_units INTEGER NOT NULL,
  CONSTRAINT stock_information_stock_code_key UNIQUE (stock_code),
  CONSTRAINT stock_information_stock_code_format_check
    CHECK (stock_code ~ '^STOCK-[0-9]{5,}$'),
  CONSTRAINT stock_information_product_id_key UNIQUE (product_id),
  CONSTRAINT stock_information_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT stock_information_available_units_check CHECK (available_units >= 0)
);
