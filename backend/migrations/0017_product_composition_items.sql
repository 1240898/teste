-- Product composition belongs to the Product aggregate. Existing BCK10 default
-- component links are migrated as one unit per component; size-specific consumed
-- quantities remain owned by BCK08.
CREATE TABLE product_composition_items (
  parent_product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  child_product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  CONSTRAINT product_composition_items_pk PRIMARY KEY (parent_product_id, child_product_id),
  CONSTRAINT product_composition_items_no_self_reference CHECK (parent_product_id <> child_product_id)
);

CREATE INDEX product_composition_items_child_idx
  ON product_composition_items (child_product_id);

CREATE FUNCTION prevent_product_composition_cycle() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('laprizza.product_composition_graph'));
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF EXISTS (
    WITH RECURSIVE descendants(product_id) AS (
      SELECT NEW.child_product_id
      UNION
      SELECT item.child_product_id
        FROM product_composition_items item
        JOIN descendants parent ON item.parent_product_id = parent.product_id
       WHERE TG_OP <> 'UPDATE'
          OR item.parent_product_id <> OLD.parent_product_id
          OR item.child_product_id <> OLD.child_product_id
    )
    SELECT 1 FROM descendants WHERE product_id = NEW.parent_product_id
  ) THEN
    RAISE EXCEPTION 'Product composition cannot contain a cycle'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_composition_no_cycle
  BEFORE INSERT OR UPDATE OR DELETE ON product_composition_items
  FOR EACH ROW EXECUTE FUNCTION prevent_product_composition_cycle();

-- Legacy BCK10 links did not carry a quantity. Preserve them as quantity 1.
INSERT INTO product_composition_items (parent_product_id, child_product_id, quantity)
SELECT pizza.product_id, component.component_product_id, 1
  FROM predefined_pizzas pizza
  JOIN predefined_pizza_components component
    ON component.predefined_pizza_storage_id = pizza.storage_id
ON CONFLICT (parent_product_id, child_product_id) DO NOTHING;

DROP TABLE predefined_pizza_components;
DROP TABLE predefined_pizzas;
