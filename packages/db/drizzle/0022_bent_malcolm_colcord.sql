CREATE TABLE "rate_limits" (
	"subject" text NOT NULL,
	"window_start" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_subject_window_start_pk" PRIMARY KEY("subject","window_start")
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;