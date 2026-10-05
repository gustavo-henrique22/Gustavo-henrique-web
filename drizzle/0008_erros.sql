CREATE TABLE `error_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`path` text DEFAULT '' NOT NULL,
	`digest` text DEFAULT '' NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `error_logs_created_idx` ON `error_logs` (`created_at`);