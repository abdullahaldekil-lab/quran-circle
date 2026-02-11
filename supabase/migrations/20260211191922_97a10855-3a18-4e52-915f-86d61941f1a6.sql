
-- Documents & Drive Links table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  external_url text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  visibility text NOT NULL DEFAULT 'all',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view documents matching their visibility
CREATE POLICY "Users can view documents by visibility"
ON public.documents FOR SELECT
USING (
  CASE
    WHEN visibility = 'all' THEN true
    WHEN visibility = 'admin_only' THEN get_staff_role(auth.uid()) IN ('manager', 'supervisor', 'assistant_supervisor')
    WHEN visibility = 'teachers' THEN get_staff_role(auth.uid()) IS NOT NULL
    WHEN visibility = 'guardians' THEN EXISTS (SELECT 1 FROM guardian_profiles WHERE id = auth.uid())
    ELSE false
  END
);

-- Only managers can manage documents
CREATE POLICY "Manager can manage documents"
ON public.documents FOR ALL
USING (get_staff_role(auth.uid()) = 'manager')
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

-- Timestamp trigger
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial document
INSERT INTO public.documents (title, description, external_url, category, visibility)
VALUES (
  'ملفات مجمع حويلان الرسمية',
  'مجلد Google Drive الرسمي لمجمع حويلان',
  'https://drive.google.com/drive/folders/1bD2rea7VqmHXOktOvaAxGIC-2331KpAs',
  'general',
  'admin_only'
);
