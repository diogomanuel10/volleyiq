-- Limpa a equipa demo criada pelo bootstrap antes de adicionar colunas NOT NULL.
-- Cascateia para memberships / players / matches / sets / lineups / actions
-- via ON DELETE CASCADE. Esta migração corre numa DB ainda sem dados reais
-- (transição demo -> onboarding), por isso a perda é aceitável e intencional.
DELETE FROM `teams`;--> statement-breakpoint
ALTER TABLE `teams` ADD `club` text NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `category` text NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `season` text;--> statement-breakpoint
ALTER TABLE `teams` ADD `division` text;--> statement-breakpoint
ALTER TABLE `teams` ADD `primary_color` text;
