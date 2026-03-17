
-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, name),
  UNIQUE(event_id, join_code)
);

-- Update participants table
ALTER TABLE public.participants 
ADD COLUMN phone_number TEXT,
ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
ADD COLUMN team_role TEXT NOT NULL DEFAULT 'member';

-- Create policy for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL TO authenticated USING (public.is_event_admin(auth.uid(), event_id));

-- Update confirm_attendance function to handle teams
CREATE OR REPLACE FUNCTION public.confirm_attendance(
  _event_code TEXT, 
  _email TEXT, 
  _name TEXT, 
  _phone_number TEXT DEFAULT NULL,
  _team_name TEXT DEFAULT NULL,
  _team_join_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
  _participant RECORD;
  _team_id UUID;
  _schedule JSONB;
  _new_join_code TEXT;
BEGIN
  -- Find event
  SELECT id, schedule INTO _event_id, _schedule FROM public.events WHERE event_code = _event_code;
  IF _event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Handle Team Logic
  IF _team_name IS NOT NULL AND _team_name <> '' THEN
    -- Check if team exists
    SELECT id, join_code INTO _team_id, _new_join_code FROM public.teams WHERE event_id = _event_id AND LOWER(name) = LOWER(_team_name);
    
    IF _team_id IS NOT NULL THEN
      -- Team exists, check join code
      IF _team_join_code IS NULL OR _team_join_code <> _new_join_code THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid team join code');
      END IF;
    ELSE
      -- Create new team
      _new_join_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
      INSERT INTO public.teams (event_id, name, join_code)
      VALUES (_event_id, _team_name, _new_join_code)
      RETURNING id INTO _team_id;
    END IF;
  END IF;

  -- Find or Upsert participant
  -- Note: We use lower(email) for uniqueness as per existing schema
  SELECT * INTO _participant FROM public.participants
    WHERE event_id = _event_id AND LOWER(email) = LOWER(_email);
  
  IF _participant IS NOT NULL THEN
    -- Update existing
    UPDATE public.participants
    SET 
      attendance_confirmed = true, 
      confirmed_at = now(),
      name = _name,
      phone_number = COALESCE(_phone_number, phone_number),
      team_id = COALESCE(_team_id, team_id)
    WHERE id = _participant.id;
  ELSE
    -- If participant list was restricted, we'd fail here. 
    -- But if we want to allow new joins (common for some events):
    INSERT INTO public.participants (event_id, name, email, attendance_confirmed, confirmed_at, phone_number, team_id)
    VALUES (_event_id, _name, _email, true, now(), _phone_number, _team_id)
    RETURNING * INTO _participant;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'participant_id', _participant.id,
    'event_id', _event_id,
    'event_name', (SELECT event_name FROM public.events WHERE id = _event_id),
    'team_name', _team_name,
    'team_join_code', _new_join_code,
    'schedule', _schedule
  );
END;
$$;
