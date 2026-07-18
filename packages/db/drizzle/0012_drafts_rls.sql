-- Tenant isolation for drafts.
--
-- Same shape as every other tenant table (0001/0003/0005/0007/0010): grant the
-- app_tenant role, FORCE RLS so the policy applies, and scope every row to the
-- app-set org id. NULLIF turns a forgotten scope into an empty result, not a leak.
--
-- Drafts hold half-written email and notes — a person's unfinished thinking. An
-- unscoped read would show one workspace another's private drafts.

GRANT SELECT, INSERT, UPDATE, DELETE ON drafts TO app_tenant;
--> statement-breakpoint
ALTER TABLE drafts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY drafts_tenant_isolation ON drafts FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
