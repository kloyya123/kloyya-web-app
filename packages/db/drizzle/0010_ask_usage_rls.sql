-- Tenant isolation for ask_usage.
--
-- Same shape as every other tenant table (0001/0003/0005/0007): grant the
-- app_tenant role, FORCE RLS so the policy actually applies, and scope every
-- row to the app-set org id. NULLIF turns a forgotten scope into an empty
-- result rather than a crash.
--
-- This table only counts questions, but the count gates a paid feature — an
-- unscoped write here would let one workspace spend another's daily allowance.

GRANT SELECT, INSERT, UPDATE, DELETE ON ask_usage TO app_tenant;
--> statement-breakpoint
ALTER TABLE ask_usage FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY ask_usage_tenant_isolation ON ask_usage FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
