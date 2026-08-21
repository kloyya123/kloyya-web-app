CREATE TABLE "meeting_briefings" (
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" text NOT NULL,
	"headline" text NOT NULL,
	"objective" text NOT NULL,
	"talking_points" text[] DEFAULT '{}'::text[] NOT NULL,
	"risks" text[] DEFAULT '{}'::text[] NOT NULL,
	"confidence" integer NOT NULL,
	"evidence" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_briefings_workspace_id_meeting_id_pk" PRIMARY KEY("workspace_id","meeting_id")
);
--> statement-breakpoint
ALTER TABLE "meeting_briefings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meeting_briefings" ADD CONSTRAINT "meeting_briefings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_briefings" ADD CONSTRAINT "meeting_briefings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_briefings_organization_id_idx" ON "meeting_briefings" USING btree ("organization_id");