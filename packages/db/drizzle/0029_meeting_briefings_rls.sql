-- Tenant isolation for meeting_briefings.
--
-- Same shape as every other tenant table (0001/0003/0005/0007/0010/0012/0014/0016/0020/0027):
-- grant the app_tenant role, FORCE RLS so the policy applies, and scope every row
-- to the app-set org id. NULLIF turns a forgotten scope into an empty result.

GRANT SELECT, INSERT, UPDATE, DELETE ON meeting_briefings TO app_tenant;
--> statement-breakpoint
ALTER TABLE meeting_briefings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY meeting_briefings_tenant_isolation ON meeting_briefings FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
