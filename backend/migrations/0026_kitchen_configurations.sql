-- WEB06 Kitchen Configuration and 3D Integration Page (ARC04, ADR-010).
-- Kitchen configurations and the kitchen asset catalogue live in the existing
-- PostgreSQL database. The validated layout is one JSONB document (D12); every
-- value the system queries or protects is a normal column with constraints.

-- Read-only asset catalogue (D8), loaded by `npm run db:seed` from
-- backend/assets/kitchen/manifest.json. Sizes and embedded_texture_set are
-- computed from the glTF file by GltfModelInspector (D19, D20).
CREATE TABLE kitchen_assets (
  id VARCHAR(64) PRIMARY KEY CHECK (id ~ '^AST-[A-Z0-9-]{1,60}$'),
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('MODEL', 'TEXTURE')),
  format VARCHAR(16) NOT NULL CHECK (format ~ '^[a-z0-9]{2,8}$'),
  path VARCHAR(255) NOT NULL UNIQUE
    CHECK (path ~ '^[a-z0-9][a-z0-9._/-]*$' AND path NOT LIKE '%..%'),
  description VARCHAR(200) NOT NULL DEFAULT ''
    CHECK (description = btrim(description)),
  size_x NUMERIC(7,3),
  size_y NUMERIC(7,3),
  size_z NUMERIC(7,3),
  embedded_texture_set BOOLEAN,
  CONSTRAINT kitchen_assets_model_check CHECK (
    kind <> 'MODEL' OR (
      format IN ('glb', 'gltf')
      AND size_x > 0 AND size_y > 0 AND size_z > 0
      AND embedded_texture_set IS NOT NULL
    )
  ),
  CONSTRAINT kitchen_assets_texture_check CHECK (
    kind <> 'TEXTURE' OR (
      size_x IS NULL AND size_y IS NULL AND size_z IS NULL
      AND embedded_texture_set IS NULL
    )
  )
);

-- "KCF-" + zero-padded value, allocated only inside the insert transaction (D1).
CREATE SEQUENCE kitchen_configuration_id_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE TABLE kitchen_configurations (
  id VARCHAR(32) PRIMARY KEY CHECK (id ~ '^KCF-[0-9]{5,}$'),
  name VARCHAR(80) NOT NULL
    CHECK (name = btrim(name) AND length(name) BETWEEN 3 AND 80),
  status VARCHAR(16) NOT NULL DEFAULT 'INACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  element_count INTEGER NOT NULL CHECK (element_count BETWEEN 0 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  created_by VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(updated_at)),
  updated_by VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ CHECK (activated_at IS NULL OR isfinite(activated_at)),
  activated_by VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL
);

-- BR 2: names are unique case-insensitively.
CREATE UNIQUE INDEX kitchen_configurations_name_key
  ON kitchen_configurations (lower(name));

-- AC 5 / BR 8: at most ONE active configuration, even under concurrency.
CREATE UNIQUE INDEX kitchen_configurations_single_active
  ON kitchen_configurations (status) WHERE status = 'ACTIVE';

-- D13: a stored configuration can never point to a removed catalogue entry.
CREATE TABLE kitchen_configuration_assets (
  configuration_id VARCHAR(32) NOT NULL
    REFERENCES kitchen_configurations(id) ON DELETE CASCADE,
  asset_id VARCHAR(64) NOT NULL REFERENCES kitchen_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY (configuration_id, asset_id)
);

CREATE INDEX kitchen_configuration_assets_asset_id_idx
  ON kitchen_configuration_assets (asset_id);