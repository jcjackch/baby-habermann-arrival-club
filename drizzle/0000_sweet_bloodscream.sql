CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`participant_hash` text NOT NULL,
	`predicted_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_name_key_unique` ON `entries` (`name_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `entries_participant_unique` ON `entries` (`participant_hash`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` integer PRIMARY KEY NOT NULL,
	`arrival_date` text NOT NULL,
	`arrival_at` text NOT NULL
);
