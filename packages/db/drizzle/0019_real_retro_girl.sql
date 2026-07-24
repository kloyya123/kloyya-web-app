CREATE TYPE "public"."priority_level" AS ENUM('Critical', 'High', 'Medium', 'Low', 'Background');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'at_risk', 'paused', 'complete');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'blocked', 'done');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"owner_id" uuid,
	"progress" integer DEFAULT 0 NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"health_score" integer DEFAULT 100 NOT NULL,
	"deadline" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "priority_level" DEFAULT 'Medium' NOT NULL,
	"owner_id" uuid,
	"project_id" uuid,
	"due_at" timestamp with time zone,
	"ai_priority_score" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_id_idx" ON "tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tasks_organization_id_idx" ON "tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");