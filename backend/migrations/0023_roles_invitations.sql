ALTER TABLE users ADD COLUMN ever_activated BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD CONSTRAINT users_activation_state_valid
  CHECK (NOT active OR ever_activated);

CREATE TABLE role_change_records (
  id UUID PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL CHECK (isfinite(changed_at)),
  previous_roles TEXT[] NOT NULL,
  new_roles TEXT[] NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ADMINISTRATOR', 'SYSTEM_PROCESS')),
  actor_user_id VARCHAR(32) REFERENCES users(id) ON DELETE RESTRICT,
  system_process TEXT,
  CHECK ((actor_type = 'ADMINISTRATOR' AND actor_user_id IS NOT NULL AND system_process IS NULL)
      OR (actor_type = 'SYSTEM_PROCESS' AND actor_user_id IS NULL AND system_process IS NOT NULL)),
  CHECK (previous_roles <@ ARRAY['ADMINISTRATOR','MANAGER','EMPLOYEE','CUSTOMER']::text[]),
  CHECK (new_roles <@ ARRAY['ADMINISTRATOR','MANAGER','EMPLOYEE','CUSTOMER']::text[])
);
CREATE INDEX role_change_records_user_changed_idx
  ON role_change_records(user_id, changed_at DESC);

CREATE TABLE activation_invitations (
  token_hash BYTEA PRIMARY KEY CHECK (octet_length(token_hash) = 32),
  user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  intended_email VARCHAR(254) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL CHECK (isfinite(expires_at)),
  status TEXT NOT NULL CHECK (status IN ('PENDING','USED','EXPIRED','INVALIDATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at))
);
CREATE UNIQUE INDEX activation_invitations_one_pending_per_user
  ON activation_invitations(user_id) WHERE status = 'PENDING';
CREATE INDEX activation_invitations_expiry_idx
  ON activation_invitations(expires_at) WHERE status = 'PENDING';
