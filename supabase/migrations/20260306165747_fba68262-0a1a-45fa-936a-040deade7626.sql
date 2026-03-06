
-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_code TEXT NOT NULL UNIQUE,
  is_overnight BOOLEAN NOT NULL DEFAULT false,
  schedule JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_admins table
CREATE TABLE public.event_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Create admin_invites table for invite links
CREATE TABLE public.admin_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_by UUID NOT NULL,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create participants table
CREATE TABLE public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  attendance_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  overnight_stay BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, email)
);

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is admin of an event
CREATE OR REPLACE FUNCTION public.is_event_admin(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_admins
    WHERE user_id = _user_id AND event_id = _event_id
  )
$$;

-- Events policies
CREATE POLICY "Anyone can view events by code" ON public.events
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their events" ON public.events
  FOR UPDATE TO authenticated USING (public.is_event_admin(auth.uid(), id));

-- Event admins policies
CREATE POLICY "Admins can view event admins" ON public.event_admins
  FOR SELECT TO authenticated USING (public.is_event_admin(auth.uid(), event_id));

CREATE POLICY "System can insert event admins" ON public.event_admins
  FOR INSERT TO authenticated WITH CHECK (true);

-- Admin invites policies
CREATE POLICY "Admins can view invites" ON public.admin_invites
  FOR SELECT USING (true);

CREATE POLICY "Admins can create invites" ON public.admin_invites
  FOR INSERT TO authenticated WITH CHECK (public.is_event_admin(auth.uid(), event_id));

CREATE POLICY "Authenticated users can use invites" ON public.admin_invites
  FOR UPDATE TO authenticated USING (used_by IS NULL);

-- Participants policies: admins can manage, anyone can read for confirmation
CREATE POLICY "Anyone can view participants for confirmation" ON public.participants
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert participants" ON public.participants
  FOR INSERT TO authenticated WITH CHECK (public.is_event_admin(auth.uid(), event_id));

CREATE POLICY "Admins can update participants" ON public.participants
  FOR UPDATE TO authenticated USING (public.is_event_admin(auth.uid(), event_id));

CREATE POLICY "Anyone can confirm attendance" ON public.participants
  FOR UPDATE USING (true);

CREATE POLICY "Admins can delete participants" ON public.participants
  FOR DELETE TO authenticated USING (public.is_event_admin(auth.uid(), event_id));

-- Enable realtime for participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
