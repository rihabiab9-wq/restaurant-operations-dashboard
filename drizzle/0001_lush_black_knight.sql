CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demo_id` text NOT NULL,
	`branch` text NOT NULL,
	`order_id` integer NOT NULL,
	`summary` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `items` ADD `storage` text DEFAULT 'Dry store' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `kind` text DEFAULT 'adjustment' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `unit_cost` real DEFAULT 0 NOT NULL;