ALTER TABLE stock_information
  ADD COLUMN tracking_status VARCHAR(16) NOT NULL DEFAULT 'CURRENT';

ALTER TABLE stock_information
  ADD CONSTRAINT stock_information_tracking_status_check
    CHECK (tracking_status IN ('CURRENT', 'HISTORICAL'));

ALTER TABLE stock_information
  DROP CONSTRAINT stock_information_product_id_key;

UPDATE stock_information AS stock
SET tracking_status = 'HISTORICAL'
FROM products AS product
WHERE product.id = stock.product_id
  AND product.is_stock_controlled = false;

CREATE UNIQUE INDEX stock_information_one_current_per_product_key
  ON stock_information (product_id)
  WHERE tracking_status = 'CURRENT';
