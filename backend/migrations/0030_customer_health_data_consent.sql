-- GDP01 (gap G1): allergen and dietary-restriction data is data concerning health
-- (GDPR Art. 4(15)) and may only be processed with explicit consent (Art. 9(2)(a)).
-- The decision and its timestamp are kept as proof of consent (Art. 7(1)).
-- Existing records have no evidence of explicit consent.
ALTER TABLE customers
  ADD COLUMN health_data_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN health_data_consent_timestamp TIMESTAMPTZ NULL
    CONSTRAINT customers_health_data_consent_timestamp_finite
    CHECK (health_data_consent_timestamp IS NULL OR isfinite(health_data_consent_timestamp)),
  ADD CONSTRAINT customers_health_data_consent_has_timestamp
    CHECK (NOT health_data_consent_given OR health_data_consent_timestamp IS NOT NULL);

DELETE FROM customer_dietary_restriction_allergens AS link
USING customers AS customer
WHERE link.customer_id = customer.id AND NOT customer.health_data_consent_given;

UPDATE customers
SET dietary_restrictions = '[]'::json
WHERE NOT health_data_consent_given AND json_array_length(dietary_restrictions) > 0;

ALTER TABLE customers
  ADD CONSTRAINT customers_dietary_restrictions_require_consent
    CHECK (health_data_consent_given OR json_array_length(dietary_restrictions) = 0);
