
-- Add Hijri date column to excellence_sessions
ALTER TABLE public.excellence_sessions 
ADD COLUMN IF NOT EXISTS session_hijri_date TEXT;

-- Add track_id to excellence_sessions to link sessions to tracks instead of halaqat
ALTER TABLE public.excellence_sessions 
ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES public.excellence_tracks(id) ON DELETE SET NULL;
