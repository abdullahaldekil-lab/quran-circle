
-- Index RecitationRecord on (halaqa_id, record_date)
CREATE INDEX IF NOT EXISTS idx_recitation_records_halaqa_date ON public.recitation_records (halaqa_id, record_date);

-- Index Student on (halaqa_id)
CREATE INDEX IF NOT EXISTS idx_students_halaqa_id ON public.students (halaqa_id);

-- Index Attendance on (halaqa_id, attendance_date)
CREATE INDEX IF NOT EXISTS idx_attendance_halaqa_date ON public.attendance (halaqa_id, attendance_date);

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_recitation_records_student_date ON public.recitation_records (student_id, record_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance (student_id);
