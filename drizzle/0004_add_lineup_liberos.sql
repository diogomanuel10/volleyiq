ALTER TABLE "lineups" ADD COLUMN "libero_reception_id" text;--> statement-breakpoint
ALTER TABLE "lineups" ADD COLUMN "libero_defense_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_libero_reception_id_players_id_fk" FOREIGN KEY ("libero_reception_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_libero_defense_id_players_id_fk" FOREIGN KEY ("libero_defense_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
