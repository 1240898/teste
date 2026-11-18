CREATE SEQUENCE pizza_size_id_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE TABLE pizza_sizes (
  id VARCHAR(32) PRIMARY KEY CHECK (id ~ '^PSIZE-[0-9]{4,}$'),
  name VARCHAR(50) NOT NULL CHECK (length(name) BETWEEN 1 AND 50 AND name = btrim(name)),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at))
);

CREATE UNIQUE INDEX pizza_sizes_name_key ON pizza_sizes (lower(name));

-- Future foreign keys to pizza_sizes(id) must use VARCHAR and ON DELETE RESTRICT.
