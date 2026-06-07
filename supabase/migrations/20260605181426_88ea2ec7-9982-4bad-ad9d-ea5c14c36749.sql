CREATE TABLE public.server_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  level text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX server_logs_request_id_idx ON public.server_logs (request_id);
CREATE INDEX server_logs_created_at_idx ON public.server_logs (created_at DESC);

GRANT ALL ON public.server_logs TO service_role;

ALTER TABLE public.server_logs ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (which bypasses RLS) can access.

CREATE OR REPLACE FUNCTION public.prune_server_logs(retention_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.server_logs
  WHERE created_at < now() - make_interval(days => retention_days);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;