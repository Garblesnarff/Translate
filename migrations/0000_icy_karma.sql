CREATE TABLE `batch_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_files` integer NOT NULL,
	`processed_files` integer DEFAULT 0 NOT NULL,
	`failed_files` integer DEFAULT 0 NOT NULL,
	`translation_ids` text,
	`original_file_name` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `dictionary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tibetan` text NOT NULL,
	`english` text NOT NULL,
	`context` text
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_text` text NOT NULL,
	`translated_text` text NOT NULL,
	`confidence` text NOT NULL,
	`source_file_name` text,
	`page_count` integer,
	`text_length` integer,
	`processing_time` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
