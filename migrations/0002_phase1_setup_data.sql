CREATE TABLE `discount_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`percent_bps` integer,
	`amount_cents` integer,
	`reduces_commission` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discount_types_version` ON `discount_types` (`version`);--> statement-breakpoint
CREATE TABLE `event_staff` (
	`event_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`working` integer NOT NULL,
	`hourly_cents` integer,
	`commission_bps` integer,
	`tip_share_bps` integer,
	`note` text,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`event_id`, `staff_id`)
);
--> statement-breakpoint
CREATE INDEX `event_staff_version` ON `event_staff` (`version`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`tax_rate_bps` integer NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_version` ON `events` (`version`);--> statement-breakpoint
CREATE INDEX `events_start` ON `events` (`start_date`);--> statement-breakpoint
CREATE TABLE `pay_profiles` (
	`staff_id` text PRIMARY KEY NOT NULL,
	`hourly_cents` integer NOT NULL,
	`commission_bps` integer NOT NULL,
	`tip_share_bps` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pay_profiles_version` ON `pay_profiles` (`version`);