CREATE SEQUENCE pizza_component_type_id_seq START WITH 5;

CREATE TABLE pizza_component_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0 AND name = btrim(name)),
  assembly_order INTEGER NOT NULL UNIQUE CHECK (assembly_order > 0),
  min_quantity INTEGER NOT NULL CHECK (min_quantity >= 0),
  max_quantity INTEGER,
  CONSTRAINT pizza_component_types_max_quantity_check
    CHECK (max_quantity IS NULL OR max_quantity >= min_quantity)
);

CREATE UNIQUE INDEX pizza_component_types_name_ci_key
  ON pizza_component_types (lower(name));

INSERT INTO pizza_component_types
  (id, name, assembly_order, min_quantity, max_quantity)
VALUES
  ('type-01', 'Base Dough', 1, 1, 1),
  ('type-02', 'Base Sauce', 2, 0, 1),
  ('type-03', 'Cheese', 3, 0, 1),
  ('type-04', 'Topping', 4, 0, NULL);
