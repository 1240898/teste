-- AA02: accounts created through an external identity provider have no local password.
-- The bcrypt-format CHECK on password_hash still applies to non-null values.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- AA02: link between an internal User and a verified external identity (OIDC "sub").
-- (provider, subject) identifies exactly one User; a User has at most one identity per provider.
-- No external password or provider token is stored.
CREATE TABLE user_external_identities (
  user_id VARCHAR(32) NOT NULL
    CONSTRAINT user_external_identities_user_id_fkey
    REFERENCES users(id) ON DELETE RESTRICT,
  provider VARCHAR(16) NOT NULL
    CONSTRAINT user_external_identities_provider_valid
    CHECK (provider IN ('GOOGLE')),
  subject VARCHAR(255) NOT NULL
    CONSTRAINT user_external_identities_subject_valid
    CHECK (length(subject) BETWEEN 1 AND 255),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    CONSTRAINT user_external_identities_linked_at_valid
    CHECK (isfinite(linked_at)),
  CONSTRAINT user_external_identities_pkey PRIMARY KEY (provider, subject),
  CONSTRAINT user_external_identities_user_provider_key UNIQUE (user_id, provider)
);