
-- Add marked_at timestamp to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP WITH TIME ZONE;
