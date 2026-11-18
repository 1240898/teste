-- Migration 0023 had to assign TRUE to existing rows to satisfy the active
-- account invariant, but that misclassified inactive legacy registrations.
-- Preserve prior activation when the legacy account has positive evidence of
-- authentication or a post-creation account change. Deactivation updates
-- updated_at, which survives session cleanup. Accounts without any retained
-- evidence remain pending and must prove email ownership through invitation.
UPDATE users AS u
SET ever_activated = (
  u.active
  OR u.updated_at > u.created_at
  OR EXISTS (
    SELECT 1 FROM application_sessions AS s WHERE s.user_id = u.id
  )
  OR EXISTS (
    SELECT 1 FROM user_external_identities AS i WHERE i.user_id = u.id
  )
);

-- New local registrations are pending unless the application explicitly
-- persists an activated account (for example, the initial Administrator).
ALTER TABLE users ALTER COLUMN ever_activated SET DEFAULT FALSE;
