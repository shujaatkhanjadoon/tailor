-- Make karigar phone globally unique (not just per-shop)
DROP INDEX IF EXISTS team_members_phone_unique;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_shop_id_phone_key;
ALTER TABLE team_members ADD CONSTRAINT team_members_phone_global_unique UNIQUE (phone);

-- Make shop owner phone globally unique
ALTER TABLE shops ADD CONSTRAINT shops_owner_phone_unique UNIQUE (owner_phone);
