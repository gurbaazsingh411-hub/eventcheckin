-- Migration to fix relationship between event_admins and profiles
-- This allows Supabase to automatically resolve the join used in AdminDashboard.tsx

-- First, ensure all existing user_ids in event_admins have corresponding profiles
-- (The trigger handle_new_user should handle new ones, but this fixes existing data)
INSERT INTO public.profiles (id, email)
SELECT DISTINCT user_id, 'placeholder@example.com' -- Email is NOT NULL in some logic, but here we just need the relation
FROM public.event_admins
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = public.event_admins.user_id)
ON CONFLICT (id) DO NOTHING;

-- Add foreign key constraint
ALTER TABLE public.event_admins
ADD CONSTRAINT fk_event_admins_profile
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;
