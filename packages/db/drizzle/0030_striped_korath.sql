ALTER TABLE "documents" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ai_summary_confidence" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ai_summarized_at" timestamp with time zone;