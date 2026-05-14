CREATE TABLE IF NOT EXISTS "user_preferences" (
  "uid" text PRIMARY KEY NOT NULL,
  "language" text DEFAULT 'pt-PT' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
