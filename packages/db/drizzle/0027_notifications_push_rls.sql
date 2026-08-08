-- Tenant isolation for notifications and push_subscriptions.
--
-- Same shape as every other tenant table (0001/0003/0005/0007/0010/0012/0014/0016/0020):
-- grant the app_tenant role, FORCE RLS so the policy applies, and scope every row
-- to the app-set org id. NULLIF turns a forgotten scope into an empty result.

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO app_tenant;
--> statement-breakpoint
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notifications_tenant_isolation ON notifications FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO app_tenant;
--> statement-breakpoint
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY push_subscriptions_tenant_isolation ON push_subscriptions FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
