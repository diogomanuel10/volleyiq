ALTER TABLE "teams"
  ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp,
  ADD COLUMN IF NOT EXISTS "subscribed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "easypay_subscription_id" text;

-- Equipas já existentes ganham 7 dias de trial a partir de agora
UPDATE "teams"
SET "trial_ends_at" = NOW() + INTERVAL '7 days'
WHERE "trial_ends_at" IS NULL AND "subscribed_at" IS NULL;
