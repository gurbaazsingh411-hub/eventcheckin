-- Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, name)
);

-- Enable RLS for rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Policies for rooms (these might error if they already exist, but Supabase Web UI allows ignoring or we can use DO blocks. But let's just use IF NOT EXISTS for columns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Anyone can view rooms'
  ) THEN
    CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Admins can manage rooms'
  ) THEN
    CREATE POLICY "Admins can manage rooms" ON public.rooms FOR ALL USING (public.is_event_admin(auth.uid(), event_id));
  END IF;
END
$$;

-- Add tracking columns to participants
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS track TEXT,
ADD COLUMN IF NOT EXISTS github_repo TEXT;

-- Grant permissions for new function
-- We will create a security definer function so anonymous users who possess their own participant ID can update these 3 fields
CREATE OR REPLACE FUNCTION public.update_participant_details(
  p_id UUID,
  p_room_id TEXT DEFAULT NULL,
  p_track TEXT DEFAULT NULL,
  p_github_repo TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_room_id UUID := NULL;
  v_team_id UUID;
BEGIN
  -- Convert text UUID to UUID type, handling nulls gracefully
  IF p_room_id IS NOT NULL AND p_room_id != '' THEN
    v_real_room_id := p_room_id::UUID;
  END IF;

  -- Get the team_id of this participant
  SELECT team_id INTO v_team_id FROM public.participants WHERE id = p_id;

  -- Update this participant
  UPDATE public.participants
  SET 
    room_id = v_real_room_id,
    track = p_track,
    github_repo = p_github_repo
  WHERE id = p_id;

  -- If they are in a team, update the rest of the team
  IF v_team_id IS NOT NULL THEN
    UPDATE public.participants
    SET 
      room_id = v_real_room_id,
      track = p_track,
      github_repo = p_github_repo
    WHERE team_id = v_team_id AND id != p_id;
  END IF;
END;
$$;
