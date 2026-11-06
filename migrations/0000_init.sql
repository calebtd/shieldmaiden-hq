CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mutation_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`mutation` text NOT NULL,
	`args` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_at` ON `audit_log` (`at`);--> statement-breakpoint
CREATE TABLE `mutations_applied` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`staff_id` text NOT NULL,
	`client_created_at` integer NOT NULL,
	`applied_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `server_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`email` text,
	`phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_email_unique` ON `staff` (`email`) WHERE email is not null;--> statement-breakpoint
CREATE INDEX `staff_version` ON `staff` (`version`);--> statement-breakpoint
CREATE TABLE `sync_counter` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
