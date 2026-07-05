CREATE TABLE IF NOT EXISTS "quran_ayah_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_version_id" uuid NOT NULL,
	"surah_number" integer NOT NULL,
	"ayah_number" integer NOT NULL,
	"word_index" integer NOT NULL,
	"display_text" text NOT NULL,
	"normalized_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quran_translation_ayat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"translation_version_id" uuid NOT NULL,
	"surah_number" integer NOT NULL,
	"ayah_number" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "translation_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"source_name" text NOT NULL,
	"license_name" text NOT NULL,
	"license_url" text,
	"license_status" text DEFAULT 'blocked_non_commercial' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quran_content_versions" ALTER COLUMN "review_status" SET DEFAULT 'imported';--> statement-breakpoint
ALTER TABLE "quran_content_versions" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "quran_content_versions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reciter_audio" ADD COLUMN "is_placeholder" text DEFAULT 'false' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quran_ayah_words" ADD CONSTRAINT "quran_ayah_words_content_version_id_quran_content_versions_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."quran_content_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quran_translation_ayat" ADD CONSTRAINT "quran_translation_ayat_translation_version_id_translation_versions_id_fk" FOREIGN KEY ("translation_version_id") REFERENCES "public"."translation_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quran_ayah_words_version_location_idx" ON "quran_ayah_words" USING btree ("content_version_id","surah_number","ayah_number","word_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quran_translation_ayat_version_location_idx" ON "quran_translation_ayat" USING btree ("translation_version_id","surah_number","ayah_number");