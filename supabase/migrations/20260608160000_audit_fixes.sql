-- Add token_version for session revocation support
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
