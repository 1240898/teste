CREATE TABLE password_recovery_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(32) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at TIMESTAMPTZ NOT NULL CHECK (isfinite(expires_at)),
  consumed_at TIMESTAMPTZ CHECK (consumed_at IS NULL OR isfinite(consumed_at)),
  invalidated_at TIMESTAMPTZ CHECK (invalidated_at IS NULL OR isfinite(invalidated_at)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  CONSTRAINT password_recovery_expiry_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT password_recovery_consumed_after_creation
    CHECK (consumed_at IS NULL OR consumed_at >= created_at),
  CONSTRAINT password_recovery_invalidated_after_creation
    CHECK (invalidated_at IS NULL OR invalidated_at >= created_at),
  CONSTRAINT password_recovery_single_terminal_state
    CHECK (consumed_at IS NULL OR invalidated_at IS NULL)
);

CREATE UNIQUE INDEX password_recovery_one_open_token_per_user
  ON password_recovery_tokens(user_id)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;
