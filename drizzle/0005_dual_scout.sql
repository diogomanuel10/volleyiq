ALTER TABLE "actions" ADD COLUMN "side" text DEFAULT 'home' NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "opponent_player_id" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "match_type" text DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "opponent_team_b_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actions" ADD CONSTRAINT "actions_opponent_player_id_opponent_players_id_fk" FOREIGN KEY ("opponent_player_id") REFERENCES "public"."opponent_players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_opponent_team_b_id_opponent_teams_id_fk" FOREIGN KEY ("opponent_team_b_id") REFERENCES "public"."opponent_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
