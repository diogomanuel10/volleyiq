ALTER TABLE "teams" ADD COLUMN "invite_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_invite_code_idx" ON "teams" ("invite_code");
