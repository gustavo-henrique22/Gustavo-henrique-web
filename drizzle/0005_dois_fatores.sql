ALTER TABLE `login_challenges` ADD `method` text DEFAULT 'senha' NOT NULL;--> statement-breakpoint
ALTER TABLE `login_challenges` ADD `next` text DEFAULT '' NOT NULL;