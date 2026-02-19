-- UCanSign Integration Columns
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ucansign_access_token text,
ADD COLUMN IF NOT EXISTS ucansign_refresh_token text,
ADD COLUMN IF NOT EXISTS ucansign_expires_at bigint;

-- Add a comment for clarity
COMMENT ON COLUMN public.profiles.ucansign_expires_at IS 'Token expiration timestamp (milliseconds since epoch)';
