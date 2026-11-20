CREATE TABLE security_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL,
  outcome VARCHAR(32) NOT NULL CHECK (
    outcome IN ('UNAUTHENTICATED', 'FORBIDDEN', 'OWNERSHIP_DENIED')
  ),
  method VARCHAR(10) NOT NULL,
  route_template VARCHAR(255) NOT NULL,
  status_code SMALLINT NOT NULL CHECK (status_code IN (401, 403, 404)),
  actor_id VARCHAR(32) NULL,
  actor_roles TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX security_audit_logs_occurred_at_idx
  ON security_audit_logs (occurred_at DESC, id DESC);
CREATE INDEX security_audit_logs_outcome_idx
  ON security_audit_logs (outcome, occurred_at DESC);
CREATE INDEX security_audit_logs_actor_id_idx
  ON security_audit_logs (actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;
