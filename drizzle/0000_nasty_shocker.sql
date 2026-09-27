CREATE TABLE `demos` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demo_id` text NOT NULL,
	`branch` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real NOT NULL,
	`minimum` real NOT NULL,
	`price` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_items_demo_branch_name` ON `items` (`demo_id`,`branch`,`name`);--> statement-breakpoint
CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demo_id` text NOT NULL,
	`branch` text NOT NULL,
	`item` text NOT NULL,
	`delta` real NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demo_id` text NOT NULL,
	`order_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`name` text NOT NULL,
	`quantity` real NOT NULL,
	`price` real NOT NULL,
	`received` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demo_id` text NOT NULL,
	`branch` text NOT NULL,
	`supplier` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
