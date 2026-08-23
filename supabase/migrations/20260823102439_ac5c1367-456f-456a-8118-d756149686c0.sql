CREATE TABLE public.permissions_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  performed_by UUID REFERENCES auth.users,
  performed_by_name TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'auto',
  added_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  links_created INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.permissions_sync_log TO authenticated;
GRANT ALL ON public.permissions_sync_log TO service_role;

ALTER TABLE public.permissions_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_sync_log_select" ON public.permissions_sync_log
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_permissions'));

CREATE POLICY "permissions_sync_log_insert" ON public.permissions_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'manage_permissions') AND performed_by = auth.uid());

CREATE INDEX idx_permissions_sync_log_created_at ON public.permissions_sync_log (created_at DESC);