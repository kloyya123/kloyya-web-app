CREATE TABLE "ask_usage" (
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_usage_workspace_id_day_pk" PRIMARY KEY("workspace_id","day")
);
--> statement-breakpoint
ALTER TABLE "ask_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ask_usage" ADD CONSTRAINT "ask_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_usage" ADD CONSTRAINT "ask_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_usage_organization_id_idx" ON "ask_usage" USING btree ("organization_id");