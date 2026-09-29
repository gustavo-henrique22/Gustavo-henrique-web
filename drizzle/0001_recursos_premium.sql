CREATE TABLE `invoice_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_reminders_unique` ON `invoice_reminders` (`invoice_id`,`kind`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'mercadopago' NOT NULL,
	`status` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`months` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_items_quote_idx` ON `quote_items` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text,
	`project_id` text,
	`invoice_id` text,
	`number` integer NOT NULL,
	`public_token` text NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`issue_date` text NOT NULL,
	`valid_until` text NOT NULL,
	`payment_term_days` integer DEFAULT 7 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`decided_at` text,
	`decision_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quotes_user_idx` ON `quotes` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_token_unique` ON `quotes` (`public_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_user_number_unique` ON `quotes` (`user_id`,`number`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `attachment_key` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `attachment_name` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `attachment_type` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `attachment_size` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `google_sub` text;--> statement-breakpoint
ALTER TABLE `users` ADD `auto_reminders` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `logo_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);