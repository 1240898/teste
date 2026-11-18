ALTER TABLE stock_information
  ADD COLUMN started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN ended_at TIMESTAMPTZ;

-- The previous schema had no period timestamps. Preserve each row and use
-- the migration instant as the best available boundary for legacy snapshots.
UPDATE stock_information
SET ended_at = started_at
WHERE tracking_status = 'HISTORICAL';

DROP INDEX stock_information_one_current_per_product_key;
ALTER TABLE stock_information
  DROP CONSTRAINT stock_information_tracking_status_check,
  DROP COLUMN tracking_status;

ALTER TABLE stock_information
  ADD CONSTRAINT stock_information_period_bounds_check
    CHECK (ended_at IS NULL OR ended_at >= started_at);

CREATE UNIQUE INDEX stock_information_one_current_per_product_key
  ON stock_information (product_id)
  WHERE ended_at IS NULL;
