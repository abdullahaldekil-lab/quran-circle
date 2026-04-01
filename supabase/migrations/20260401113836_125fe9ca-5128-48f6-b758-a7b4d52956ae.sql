
-- 1) Add columns to madarij_hizb_exams
ALTER TABLE madarij_hizb_exams
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'official',
  ADD COLUMN IF NOT EXISTS failed_reason TEXT;

-- 2) Add columns to madarij_enrollments
ALTER TABLE madarij_enrollments
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_downgraded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_track_id UUID REFERENCES madarij_tracks(id);

-- 3) Create madarij_level_changes table
CREATE TABLE madarij_level_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  enrollment_id UUID REFERENCES madarij_enrollments(id),
  old_track_id UUID REFERENCES madarij_tracks(id),
  new_track_id UUID REFERENCES madarij_tracks(id),
  reason TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE madarij_level_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage level changes" ON madarij_level_changes
  FOR ALL TO authenticated USING (get_staff_role(auth.uid()) IS NOT NULL)
  WITH CHECK (get_staff_role(auth.uid()) IS NOT NULL);
