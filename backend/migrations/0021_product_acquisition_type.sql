-- BCK05 Product Management: record whether each product is produced or purchased.
-- Existing Products have no recorded acquisition type. Do not guess whether
-- they were PRODUCED or PURCHASED; the NOT NULL addition intentionally requires
-- existing rows to be classified before this migration is applied.
ALTER TABLE products
  ADD COLUMN acquisition_type VARCHAR(16) NOT NULL
    CHECK (acquisition_type IN ('PRODUCED', 'PURCHASED'));
