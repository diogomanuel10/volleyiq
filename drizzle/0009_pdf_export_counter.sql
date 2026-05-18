ALTER TABLE "teams"
  ADD COLUMN IF NOT EXISTS "pdf_exports_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pdf_exports_month" text NOT NULL DEFAULT '';
