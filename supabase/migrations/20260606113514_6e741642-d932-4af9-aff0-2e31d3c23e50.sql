
-- Explicit RLS policies on server_logs: deny all access to anon/authenticated.
-- service_role bypasses RLS and continues to have full access for backend logging.
CREATE POLICY "Deny select to non-service roles"
  ON public.server_logs FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny insert to non-service roles"
  ON public.server_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny update to non-service roles"
  ON public.server_logs FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny delete to non-service roles"
  ON public.server_logs FOR DELETE
  TO anon, authenticated
  USING (false);
