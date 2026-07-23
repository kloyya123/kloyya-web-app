-- Supabase Auth replaces Better Auth: drop its four identity tables. CASCADE
-- also removes the users.id -> user.id foreign key, so the explicit DROP
-- CONSTRAINT below uses IF EXISTS to stay a safe no-op after the cascade.
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "verification" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "full_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text DEFAULT '' NOT NULL;