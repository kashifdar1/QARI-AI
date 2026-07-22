ALTER TABLE "evaluation_results" ADD COLUMN "status" text NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation_results" ADD COLUMN "audio_quality_failure_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation_results" ADD COLUMN "audio_quality_duration_seconds" real NOT NULL;