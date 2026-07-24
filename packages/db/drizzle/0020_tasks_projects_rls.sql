-- Tenant isolation for projects and tasks.
--
-- Same shape as every other tenant table (0001/0003/0005/0007/0010/0012/0014/0016):
-- grant the app_tenant role, FORCE RLS so the policy applies, and scope every row
-- to the app-set org id. NULLIF turns a forgotten scope into an empty result.

GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO app_tenant;
--> statement-breakpoint
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY projects_tenant_isolation ON projects FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO app_tenant;
--> statement-breakpoint
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tasks_tenant_isolation ON tasks FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
