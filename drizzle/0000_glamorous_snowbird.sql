CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`set_id` text,
	`player_id` text,
	`type` text NOT NULL,
	`result` text NOT NULL,
	`zone_from` integer,
	`zone_to` integer,
	`rally_id` text,
	`rotation` integer,
	`opponent_player` integer,
	`video_time_sec` integer,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`set_id`) REFERENCES `sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `actions_match_idx` ON `actions` (`match_id`);--> statement-breakpoint
CREATE INDEX `actions_player_idx` ON `actions` (`player_id`);--> statement-breakpoint
CREATE INDEX `actions_type_idx` ON `actions` (`type`);--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklist_match_idx` ON `checklist_items` (`match_id`);--> statement-breakpoint
CREATE TABLE `lineups` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`rotation` integer DEFAULT 1 NOT NULL,
	`p1` text,
	`p2` text,
	`p3` text,
	`p4` text,
	`p5` text,
	`p6` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`p1`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`p2`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`p3`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`p4`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`p5`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`p6`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lineups_match_idx` ON `lineups` (`match_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`opponent` text NOT NULL,
	`date` integer NOT NULL,
	`venue` text DEFAULT 'home' NOT NULL,
	`competition` text,
	`sets_won` integer DEFAULT 0 NOT NULL,
	`sets_lost` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`video_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matches_team_idx` ON `matches` (`team_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`uid` text NOT NULL,
	`role` text DEFAULT 'coach' NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memberships_team_idx` ON `memberships` (`team_id`);--> statement-breakpoint
CREATE INDEX `memberships_uid_idx` ON `memberships` (`uid`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`number` integer NOT NULL,
	`position` text NOT NULL,
	`height_cm` integer,
	`dominant_hand` text,
	`birth_date` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_team_idx` ON `players` (`team_id`);--> statement-breakpoint
CREATE TABLE `scouting_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`opponent` text NOT NULL,
	`match_ids` text NOT NULL,
	`patterns_json` text NOT NULL,
	`summary_md` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_team_idx` ON `scouting_reports` (`team_id`);--> statement-breakpoint
CREATE TABLE `sets` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`number` integer NOT NULL,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sets_match_idx` ON `sets` (`match_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plan` text DEFAULT 'basic' NOT NULL,
	`owner_uid` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`rec_json` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_player_idx` ON `training_logs` (`player_id`);