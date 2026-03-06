-- Migration to backfill profiles with real data from auth.users
-- This ensures that placeholder emails and missing names are replaced with actual user data

-- Update existing profiles with real emails and names from auth.users
UPDATE public.profiles p
SET 
  email = u.email,
  name = COALESCE(
    u.raw_user_meta_data->>'full_name', 
    u.raw_user_meta_data->>'name', 
    p.name
  ),
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id;

-- Ensure all users have a profile (even if they didn't go through the signup trigger)
INSERT INTO public.profiles (id, name, email)
SELECT 
  u.id, 
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(EXCLUDED.name, public.profiles.name);
