-- Create or replace confirm_attendance function to refine team join logic
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
  _participant_count INTEGER;
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
      -- Team exists, check if any participants are already in it
      SELECT count(*) INTO _participant_count FROM public.participants WHERE team_id = _team_id;
      
      IF _participant_count > 0 THEN
        -- Team has members, check join code
        IF _team_join_code IS NULL OR _team_join_code <> _new_join_code THEN
          RETURN jsonb_build_object('success', false, 'error', 'This team already has members. Please enter the correct join code.');
        END IF;
      END IF;
    ELSE
      -- Team does not exist
      RETURN jsonb_build_object('success', false, 'error', 'Team does not exist. Please check the team name.');
    END IF;
  END IF;

  -- Atomic Find or Upsert participant
  INSERT INTO public.participants (event_id, name, email, attendance_confirmed, confirmed_at, phone_number, team_id)
  VALUES (_event_id, _name, _email, false, NULL, _phone_number, _team_id)
  ON CONFLICT (event_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone_number = COALESCE(EXCLUDED.phone_number, participants.phone_number),
    team_id = COALESCE(EXCLUDED.team_id, participants.team_id)
  RETURNING * INTO _participant;

  RETURN jsonb_build_object(
    'success', true, 
    'id', _participant.id,
    'event_id', _event_id,
    'event_name', (SELECT event_name FROM public.events WHERE id = _event_id),
    'team_name', (SELECT name FROM public.teams WHERE id = _participant.team_id),
    'team_join_code', (SELECT join_code FROM public.teams WHERE id = _participant.team_id),
    'attendance_confirmed', _participant.attendance_confirmed,
    'schedule', _schedule
  );
END;
$$;
