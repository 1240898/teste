CREATE TABLE application_sessions (
  id uuid PRIMARY KEY,
  user_id varchar(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_hash bytea NOT NULL UNIQUE CHECK (octet_length(credential_hash) = 32),
  csrf_token bytea NOT NULL CHECK (octet_length(csrf_token) = 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_activity_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idle_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (isfinite(created_at)),
  CHECK (isfinite(last_activity_at)),
  CHECK (isfinite(idle_expires_at)),
  CHECK (idle_expires_at > last_activity_at),
  CHECK (revoked_at IS NULL OR (isfinite(revoked_at) AND revoked_at >= created_at))
);

CREATE INDEX application_sessions_user_id_idx ON application_sessions(user_id);
CREATE INDEX application_sessions_retention_idx ON application_sessions(idle_expires_at, revoked_at);
