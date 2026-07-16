-- Tenant isolation for sync_records.
--
-- Same shape as every other tenant table (0001/0003/0005): FORCE, a policy on
-- the app-set org id, the app_tenant grant, NULLIF so a forgotten scope is an
-- empty result rather than a crash.
--
-- This is the most sensitive tenant table yet: it holds the raw contents of
-- customers' calendars, and later their mail and files. An unscoped read here
-- would hand one organization the verbatim private data of another. The token
-- encryption two tables over protects the keys to that data; this protects the
-- data itself.

GRANT SELECT, INSERT, UPDATE, DELETE ON sync_records TO app_tenant;
--> statement-breakpoint
ALTER TABLE sync_records FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sync_records_tenant_isolation ON sync_records FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
