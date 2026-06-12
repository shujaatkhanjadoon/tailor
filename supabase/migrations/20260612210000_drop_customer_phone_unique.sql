-- Allow duplicate phone numbers per shop for customers
-- (family members, drivers etc. can share a phone)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_shop_id_phone_key;
DROP INDEX IF EXISTS customers_shop_id_phone_key;
