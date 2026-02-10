
-- Create storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('recitation-audio', 'recitation-audio', true);

-- Allow authenticated users to upload audio
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recitation-audio');

-- Allow authenticated users to read audio
CREATE POLICY "Anyone can read audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'recitation-audio');

-- Allow authenticated users to delete their audio
CREATE POLICY "Authenticated users can delete audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recitation-audio');
