CREATE TABLE consumption_forecasts (
  id text PRIMARY KEY,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  archived boolean NOT NULL DEFAULT false
);
CREATE TABLE consumption_forecast_versions (
  forecast_id text NOT NULL REFERENCES consumption_forecasts(id),
  version integer NOT NULL CHECK (version > 0),
  document jsonb NOT NULL,
  PRIMARY KEY (forecast_id, version)
);
CREATE TABLE forecast_creation_receipts (
  actor_id text NOT NULL,
  request_id uuid NOT NULL,
  forecast_id text NOT NULL REFERENCES consumption_forecasts(id),
  PRIMARY KEY (actor_id, request_id)
);
CREATE TABLE planning_supplier_previews (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL,
  document jsonb NOT NULL,
  without_offers jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
