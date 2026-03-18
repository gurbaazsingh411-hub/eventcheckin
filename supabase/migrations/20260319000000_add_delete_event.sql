-- Enable deleting events for the user who created them
CREATE POLICY "Creators can delete their events" ON public.events
  FOR DELETE TO authenticated USING (auth.uid() = created_by);
