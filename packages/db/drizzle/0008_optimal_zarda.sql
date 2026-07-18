CREATE TYPE "public"."proactiveness" AS ENUM('minimal', 'balanced', 'highly_proactive');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'pro');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "role" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "priorities" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "proactiveness" "proactiveness" DEFAULT 'balanced' NOT NULL;