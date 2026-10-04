CREATE TABLE `coupon_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_redemptions_unique` ON `coupon_redemptions` (`coupon_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`days` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`max_uses` integer DEFAULT 0 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`winback` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`member_id` text,
	`email` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`invite_hash` text,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_members_owner_idx` ON `team_members` (`owner_id`);--> statement-breakpoint
CREATE INDEX `team_members_member_idx` ON `team_members` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_owner_email_unique` ON `team_members` (`owner_id`,`email`);--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `clients_portal_token_unique` ON `clients` (`portal_token`);--> statement-breakpoint
ALTER TABLE `quotes` ADD `contract_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `workspace_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `trial_ends_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `das_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `contract_template` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `checkout_coupon` text DEFAULT '' NOT NULL;