ALTER TABLE activation_invitations
  ADD COLUMN activation_method TEXT;

-- A pending account with a local credential is the available evidence that
-- an existing invitation came from public local registration. Leave other
-- legacy invitation methods unknown for an Administrator to choose later.
UPDATE activation_invitations AS invitation
SET activation_method = 'LOCAL'
FROM users AS account
WHERE invitation.user_id = account.id
  AND account.password_hash IS NOT NULL
  AND account.ever_activated = FALSE;

ALTER TABLE activation_invitations
  ADD CONSTRAINT activation_invitations_method_valid
  CHECK (activation_method IS NULL OR activation_method IN ('LOCAL', 'EXTERNAL'));
