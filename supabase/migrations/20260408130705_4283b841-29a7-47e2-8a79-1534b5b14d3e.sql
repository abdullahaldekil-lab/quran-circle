-- Add file columns to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Create documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Authenticated can view documents files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Manager can upload documents files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents' AND get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Manager can delete documents files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND get_staff_role(auth.uid()) = 'manager');

-- Add whatsapp_phone to notification preferences
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;