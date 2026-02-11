
-- Add birth date columns to students table
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS birth_date_gregorian DATE,
  ADD COLUMN IF NOT EXISTS birth_date_hijri TEXT;
