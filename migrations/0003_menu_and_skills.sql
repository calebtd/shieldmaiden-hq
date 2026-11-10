CREATE TABLE `event_menu` (
	`event_id` text NOT NULL,
	`menu_item_id` text NOT NULL,
	`price_cents` integer,
	`offered` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`event_id`, `menu_item_id`)
);
--> statement-breakpoint
CREATE INDEX `event_menu_version` ON `event_menu` (`version`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`open_price` integer DEFAULT false NOT NULL,
	`minutes` integer,
	`description` text,
	`skill_ids` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `menu_items_version` ON `menu_items` (`version`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `skills_version` ON `skills` (`version`);--> statement-breakpoint
CREATE TABLE `staff_skills` (
	`staff_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`has` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`staff_id`, `skill_id`)
);
--> statement-breakpoint
CREATE INDEX `staff_skills_version` ON `staff_skills` (`version`);