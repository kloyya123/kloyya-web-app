-- Row-Level Security: the hard backstop for tenant isolation.
--
-- Phase 3.5 enabled RLS on every table; this adds the policies that give it
-- teeth, plus the role they apply to.
--
-- WHY A ROLE. The API connects as the table-owning role, and an owner bypasses
-- RLS that is merely ENABLE'd — so policies alone would protect nothing from our
-- own queries. Rather than add a second credential, request-scoped code drops
-- into `app_tenant` for the length of a transaction (SET LOCAL ROLE), where it
-- owns nothing and RLS is therefore enforced. Everything that legitimately needs
-- to see across tenants — migrations, sign-up provisioning (which creates the
-- org before any org context exists), and Better Auth's identity lookups (which
-- happen before a session, let alone an org, is known) — stays on the owner
-- path. That split is the whole design.
--
-- WHY current_setting(..., true). The second argument makes a missing setting
-- return NULL instead of raising. Every policy below then compares against NULL,
-- which is never true — so a query that forgets to set the org id sees *nothing*
-- rather than everything. Deny-by-default, including when we make a mistake.
--
-- WHY NULLIF(..., ''). current_setting returns NULL only for a GUC that has never
-- been set on the connection. Once SET LOCAL has set it even once, the value
-- reverts to the EMPTY STRING at the end of that transaction rather than becoming
-- unset again — and ''::uuid raises 22P02. On a pooled connection that means
-- every request after the first would error instead of denying cleanly. NULLIF
-- turns that '' back into NULL, so a forgotten scope is an empty result, exactly
-- like a scope that was never set at all.

CREATE ROLE app_tenant NOLOGIN;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_tenant;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations, workspaces, users, memberships, user_preferences TO app_tenant;
--> statement-breakpoint
-- FORCE, not just ENABLE: without it a table's owner is exempt, and app_tenant
-- must never be exempt even if it should one day come to own something.
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- The organization you are currently acting within.
CREATE POLICY organizations_tenant_isolation ON organizations FOR ALL TO app_tenant USING (id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY workspaces_tenant_isolation ON workspaces FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY users_tenant_isolation ON users FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY memberships_tenant_isolation ON memberships FOR ALL TO app_tenant USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid) WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
--> statement-breakpoint
-- user_preferences carries no organization_id of its own; it is scoped through
-- the profile that owns it. The sub-select is itself subject to the users policy
-- above, so it can only ever resolve within the current organization.
CREATE POLICY user_preferences_tenant_isolation ON user_preferences FOR ALL TO app_tenant USING (user_id IN (SELECT id FROM users WHERE organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)) WITH CHECK (user_id IN (SELECT id FROM users WHERE organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid));
