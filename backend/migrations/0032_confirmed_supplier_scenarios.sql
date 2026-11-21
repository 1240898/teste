CREATE TABLE planning_confirmed_supplier_scenarios (
  scenario_id text NOT NULL,
  version text NOT NULL,
  document jsonb NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, version)
);
