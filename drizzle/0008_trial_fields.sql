ALTER TABLE "teams"
  ADD COLUMN "trial_ends_at" timestamp,
  ADD COLUMN "subscribed_at" timestamp;

-- Equipas já existentes: dar-lhes 7 dias de trial a partir de agora
UPDATE "teams"
SET "trial_ends_at" = NOW() + INTERVAL '7 days'
WHERE "trial_ends_at" IS NULL;
