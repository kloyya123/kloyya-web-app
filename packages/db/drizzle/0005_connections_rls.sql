-- Tenant isolation for connections.
--
-- The same shape as every other tenant table (see 0001, 0003): FORCE, a policy
-- keyed on the app-set org id, and the grant app_tenant needs to use it. NULLIF
-- because a GUC reverts to '' rather than unset after SET LOCAL, and ''::uuid
-- raises — a forgotten scope must be an empty result, not a crash.
--
-- This table holds customers' encrypted Google tokens. Ciphertext is not a
-- substitute for isolation: an unscoped read would still hand one tenant another
-- tenant's token blobs, and encryption only means the thief needs one more thing.

GRANT SELECT, INSERT, UPDATE, DELETE ON connections TO app_tenant;
--> statement-breakpoint
ALTER TABLE connections FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY connections_tenant_isolation ON connections FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
