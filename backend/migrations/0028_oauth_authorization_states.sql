CREATE TABLE oauth_authorization_states (
  state_hash BYTEA PRIMARY KEY CHECK (octet_length(state_hash) = 32),
  purpose TEXT NOT NULL CHECK (purpose IN ('LOGIN', 'ACTIVATION')),
  provider TEXT NOT NULL,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL CHECK (isfinite(expires_at)),
  invitation_hash BYTEA CHECK (octet_length(invitation_hash) = 32),
  invitation_user_id VARCHAR(32),
  CHECK (
    (purpose = 'LOGIN' AND invitation_hash IS NULL AND invitation_user_id IS NULL) OR
    (purpose = 'ACTIVATION' AND invitation_hash IS NOT NULL AND invitation_user_id IS NOT NULL)
  )
);

CREATE INDEX oauth_authorization_states_expiry_idx ON oauth_authorization_states(expires_at);
