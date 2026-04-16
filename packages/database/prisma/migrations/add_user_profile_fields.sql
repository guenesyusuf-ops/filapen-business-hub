-- Add profile fields for personal settings (first name, last name, phone)
-- avatar_url already exists on the users table.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name varchar(120),
  ADD COLUMN IF NOT EXISTS last_name varchar(120),
  ADD COLUMN IF NOT EXISTS phone varchar(40);
