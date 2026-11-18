-- BCK03 Product Category Management (ARC04).
-- Business identifiers are "CAT-" + zero-padded sequence value (e.g. CAT-00123),
-- allocated by the database so that concurrent requests can never collide.
CREATE SEQUENCE product_category_id_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE TABLE product_categories (
  id VARCHAR(32) PRIMARY KEY CHECK (id ~ '^CAT-[0-9]{5,}$'),
  name VARCHAR(100) NOT NULL CHECK (length(name) BETWEEN 1 AND 100 AND name = btrim(name)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at))
);

-- BR1/BR5: category names are unique case-insensitively. The display name keeps
-- the manager's capitalisation; the functional index is the last line of defence
-- against concurrent duplicates (mapped to HTTP 409 by the repository).
CREATE UNIQUE INDEX product_categories_name_key ON product_categories (lower(name));

-- BR3/BR5: the products table is introduced by BCK05, whose migration must declare
--   category_id VARCHAR(32) NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT
