CREATE TABLE `email_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_tokens_user_idx` ON `email_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `external_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`event` text NOT NULL,
	`status` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`user_id` text,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`months` integer DEFAULT 0 NOT NULL,
	`handled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_payments_unique` ON `external_payments` (`provider`,`external_id`,`event`);--> statement-breakpoint
CREATE INDEX `external_payments_email_idx` ON `external_payments` (`email`);--> statement-breakpoint
CREATE TABLE `known_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_hash` text NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`last_seen_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `known_devices_unique` ON `known_devices` (`user_id`,`device_hash`);--> statement-breakpoint
CREATE TABLE `login_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nfse_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`invoice_id` text,
	`ref` text NOT NULL,
	`environment` text NOT NULL,
	`status` text NOT NULL,
	`numero` text DEFAULT '' NOT NULL,
	`codigo_verificacao` text DEFAULT '' NOT NULL,
	`pdf_url` text DEFAULT '' NOT NULL,
	`xml_url` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`updated_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nfse_documents_ref_unique` ON `nfse_documents` (`ref`);--> statement-breakpoint
CREATE INDEX `nfse_documents_invoice_idx` ON `nfse_documents` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `nfse_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`layout` text DEFAULT 'nacional' NOT NULL,
	`environment` text DEFAULT 'homologacao' NOT NULL,
	`token` text DEFAULT '' NOT NULL,
	`cnpj` text DEFAULT '' NOT NULL,
	`inscricao_municipal` text DEFAULT '' NOT NULL,
	`codigo_municipio` text DEFAULT '' NOT NULL,
	`regime` text DEFAULT 'mei' NOT NULL,
	`item_lista_servico` text DEFAULT '' NOT NULL,
	`codigo_tributacao` text DEFAULT '' NOT NULL,
	`aliquota_bp` integer DEFAULT 0 NOT NULL,
	`descricao_padrao` text DEFAULT '' NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `referral_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`referrer_id` text NOT NULL,
	`referred_id` text NOT NULL,
	`months` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_rewards_referred_unique` ON `referral_rewards` (`referred_id`);--> statement-breakpoint
CREATE INDEX `referral_rewards_referrer_idx` ON `referral_rewards` (`referrer_id`);--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`ip` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `security_events_user_idx` ON `security_events` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `link_disabled_at` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `link_disabled_at` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `device_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ip` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_seen_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `referral_code` text;--> statement-breakpoint
ALTER TABLE `users` ADD `referred_by` text;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_dismissed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_recovery_codes` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_referral_code_unique` ON `users` (`referral_code`);--> statement-breakpoint
UPDATE `users` SET `email_verified_at` = `created_at` WHERE `google_sub` IS NOT NULL;
