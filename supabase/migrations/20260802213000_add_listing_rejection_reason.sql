-- Existing projects may already have moderation_status without the rejection detail column.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.listings
  ALTER COLUMN moderation_status SET DEFAULT 'pending';
