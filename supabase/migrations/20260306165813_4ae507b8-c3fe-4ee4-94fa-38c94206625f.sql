
-- Drop overly permissive policies
DROP POLICY "System can insert event admins" ON public.event_admins;
DROP POLICY "Anyone can confirm attendance" ON public.participants;

-- More restrictive: only allow inserting yourself as admin (for event creation or invite acceptance)
CREATE POLICY "Users can add themselves as admin" ON public.event_admins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Participants confirmation: only allow updating attendance_confirmed and confirmed_at fields
-- Use a function to restrict what can be updated
CREATE OR REPLACE FUNCTION public.confirm_attendance(_event_code TEXT, _email TEXT, _name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
  _participant RECORD;
  _schedule JSONB;
BEGIN
  -- Find event by code
  SELECT id, schedule INTO _event_id, _schedule FROM public.events WHERE event_code = _event_code;
  IF _event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Find participant
  SELECT * INTO _participant FROM public.participants
    WHERE event_id = _event_id AND LOWER(email) = LOWER(_email);
  
  IF _participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Participant not found in the event list. Please contact the organizer.');
  END IF;

  -- Confirm attendance
  UPDATE public.participants
    SET attendance_confirmed = true, confirmed_at = now()
    WHERE id = _participant.id;

  RETURN jsonb_build_object('success', true, 'schedule', _schedule, 'event_name', (SELECT event_name FROM public.events WHERE id = _event_id));
END;
$$;
