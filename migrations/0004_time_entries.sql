CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`kind` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer,
	`replaces_id` text,
	`reason` text,
	`created_by` text NOT NULL,
	`voided_at` integer,
	`voided_by` text,
	`void_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `time_entries_version` ON `time_entries` (`version`);--> statement-breakpoint
CREATE INDEX `time_entries_staff` ON `time_entries` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `time_entries_event` ON `time_entries` (`event_id`);