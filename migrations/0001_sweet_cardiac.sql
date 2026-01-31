CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`permissions` text NOT NULL,
	`rate_limit` integer DEFAULT 100 NOT NULL,
	`requests_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`event_type` text NOT NULL,
	`user_id` text,
	`api_key_id` text,
	`ip_address` text,
	`user_agent` text,
	`resource` text,
	`action` text,
	`success` integer NOT NULL,
	`details` text,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `batch_extraction_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_documents` integer DEFAULT 0 NOT NULL,
	`documents_processed` integer DEFAULT 0 NOT NULL,
	`documents_failed` integer DEFAULT 0 NOT NULL,
	`total_entities` integer DEFAULT 0 NOT NULL,
	`total_relationships` integer DEFAULT 0 NOT NULL,
	`avg_confidence` text,
	`error_message` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`canonical_name` text NOT NULL,
	`names` text NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`dates` text,
	`confidence` text DEFAULT '0.5' NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text DEFAULT 'ai' NOT NULL,
	`verified_by` text,
	`verified_at` text
);
--> statement-breakpoint
CREATE TABLE `extraction_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`translation_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`entities_extracted` integer DEFAULT 0 NOT NULL,
	`relationships_extracted` integer DEFAULT 0 NOT NULL,
	`confidence_avg` text,
	`error_message` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `translations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lineages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tibetan_name` text,
	`lineage_type` text NOT NULL,
	`tradition` text,
	`teaching` text,
	`origin_text_id` text,
	`origin_date` text,
	`chain` text DEFAULT '[]' NOT NULL,
	`branches` text DEFAULT '[]',
	`sources` text DEFAULT '[]',
	`confidence` text DEFAULT '0.5' NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`origin_text_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`predicate` text NOT NULL,
	`object_id` text NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL,
	`confidence` text DEFAULT '0.5' NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`source_document_id` integer,
	`source_page` text,
	`source_quote` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text DEFAULT 'ai' NOT NULL,
	`verified_by` text,
	`verified_at` text,
	FOREIGN KEY (`subject_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`object_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_document_id`) REFERENCES `translations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `translation_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`translation_id` text,
	`session_id` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`confidence_score` text NOT NULL,
	`quality_score` text,
	`model_agreement` text,
	`format_score` text,
	`processing_time_ms` integer NOT NULL,
	`tokens_processed` integer,
	`api_latency_ms` integer,
	`model_used` text NOT NULL,
	`iterations_used` integer NOT NULL,
	`retries_needed` integer NOT NULL,
	`helper_models_used` text,
	`gates_passed` integer DEFAULT 1 NOT NULL,
	`gate_results` text,
	`failed_gates` text,
	`page_number` integer,
	`document_id` text,
	`text_length` integer NOT NULL,
	`chunk_count` integer,
	`error_occurred` integer DEFAULT 0 NOT NULL,
	`error_type` text,
	`error_message` text
);
