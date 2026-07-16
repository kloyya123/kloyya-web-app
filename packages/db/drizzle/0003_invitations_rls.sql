-- Tenant isolation for invitations.
--
-- 0002 created the table with RLS ENABLE'd, which by itself protects nothing:
-- our server connects as the owner and owners are exempt. This gives it the same
-- teeth every other tenant table has — FORCE, a policy keyed on the app-set org
-- id, and the grant the tenant role needs to use it.
--
-- Same NULLIF(..., '') as 0001: once SET LOCAL has set a GUC, it reverts to the
-- empty string rather than becoming unset, and ''::uuid raises. NULLIF turns a
-- forgotten scope back into an empty result instead of a crash.
--
-- Invitations are worth isolating precisely because they are credentials: an
-- unscoped read here would leak every pending token hash in every organization.

GRANT SELECT, INSERT, UPDATE, DELETE ON invitations TO app_tenant;
--> statement-breakpoint
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY invitations_tenant_isolation ON invitations FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
