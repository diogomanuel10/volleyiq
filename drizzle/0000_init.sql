CREATE TABLE IF NOT EXISTS "actions" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"set_id" text,
	"player_id" text,
	"type" text NOT NULL,
	"result" text NOT NULL,
	"zone_from" integer,
	"zone_to" integer,
	"rally_id" text,
	"rotation" integer,
	"opponent_player" integer,
	"video_time_sec" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lineups" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"rotation" integer DEFAULT 1 NOT NULL,
	"p1" text,
	"p2" text,
	"p3" text,
	"p4" text,
	"p5" text,
	"p6" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"opponent" text NOT NULL,
	"date" timestamp NOT NULL,
	"venue" text DEFAULT 'home' NOT NULL,
	"competition" text,
	"sets_won" integer DEFAULT 0 NOT NULL,
	"sets_lost" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"video_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"uid" text NOT NULL,
	"role" text DEFAULT 'coach' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"number" integer NOT NULL,
	"position" text NOT NULL,
	"height_cm" integer,
	"dominant_hand" text,
	"birth_date" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scouting_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"opponent" text NOT NULL,
	"match_ids" text NOT NULL,
	"patterns_json" text NOT NULL,
	"summary_md" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sets" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"number" integer NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"club" text NOT NULL,
	"category" text NOT NULL,
	"season" text,
	"division" text,
	"primary_color" text,
	"plan" text DEFAULT 'basic' NOT NULL,
	"owner_uid" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"rec_json" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actions" ADD CONSTRAINT "actions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actions" ADD CONSTRAINT "actions_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "actions" ADD CONSTRAINT "actions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p1_players_id_fk" FOREIGN KEY ("p1") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p2_players_id_fk" FOREIGN KEY ("p2") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p3_players_id_fk" FOREIGN KEY ("p3") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p4_players_id_fk" FOREIGN KEY ("p4") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p5_players_id_fk" FOREIGN KEY ("p5") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lineups" ADD CONSTRAINT "lineups_p6_players_id_fk" FOREIGN KEY ("p6") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scouting_reports" ADD CONSTRAINT "scouting_reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sets" ADD CONSTRAINT "sets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actions_match_idx" ON "actions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actions_player_idx" ON "actions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actions_type_idx" ON "actions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_match_idx" ON "checklist_items" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lineups_match_idx" ON "lineups" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_team_idx" ON "matches" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_team_idx" ON "memberships" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_uid_idx" ON "memberships" USING btree ("uid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_team_idx" ON "players" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_team_idx" ON "scouting_reports" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sets_match_idx" ON "sets" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_player_idx" ON "training_logs" USING btree ("player_id");