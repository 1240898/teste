UPDATE activation_invitations AS invitation
SET activation_method = NULL
FROM users AS account, public.schema_migrations AS migration
WHERE migration.name = '0025_activation_invitation_method.sql'
  AND migration.checksum IN (
    'b93a66775fbdbe0e960c44dbe8a670ebbff5bbb1bd3c9dcf7f2e4e95aa2836b8',
    '01cef7cb13a561bb14128d42d073cfd3d7b949942acc2c5bc6883ec3c21c05fa'
  )
  AND invitation.created_at <= migration.applied_at
  AND invitation.user_id = account.id
  AND invitation.activation_method = 'LOCAL'
  AND (account.password_hash IS NULL OR account.ever_activated);
