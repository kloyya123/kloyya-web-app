-- Tenant isolation for documents.
--
-- Same shape as every other tenant table (0001/0003/0005/0007/0010/0012): grant
-- the app_tenant role, FORCE RLS so the policy applies, and scope every row to
-- the app-set org id. NULLIF turns a forgotten scope into an empty result.
--
-- Documents hold whatever a customer uploaded — contracts, notes, financials.
-- An unscoped read here would hand one workspace another's files verbatim, the
-- same class of leak the sync_records policy guards for connected data.

GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO app_tenant;
--> statement-breakpoint
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY documents_tenant_isolation ON documents FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
