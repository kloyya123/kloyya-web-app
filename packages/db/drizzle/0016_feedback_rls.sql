-- Tenant isolation for feedback.
--
-- Same shape as every other tenant table (0001…0014): grant the app_tenant role,
-- FORCE RLS so the policy applies, and scope every row to the app-set org id.
-- NULLIF turns a forgotten scope into an empty result rather than a crash.

GRANT SELECT, INSERT, UPDATE, DELETE ON feedback TO app_tenant;
--> statement-breakpoint
ALTER TABLE feedback FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY feedback_tenant_isolation ON feedback FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
