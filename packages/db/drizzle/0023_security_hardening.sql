-- Security hardening: close the gaps a live audit of the running database found.
--
-- Three unrelated problems, all verified against production rather than inferred
-- from the migration history.
--
--
-- 1. POSTGREST REACHABILITY  (was: HIGH)
--
-- Supabase serves every table in `public` over PostgREST, and the anon key that
-- authorises those requests ships inside the browser bundle — it is not a secret.
-- The audit found `anon` and `authenticated` holding the full
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER set on all fifteen
-- application tables, inherited from Supabase's default grants on `public`.
--
-- A probe with that key confirmed no rows actually come back: RLS is enabled and
-- forced everywhere, the policies name `app_tenant` only, and a role with no
-- matching policy is denied by default. So nothing is leaking today.
--
-- It is one mistake away from leaking, though. Any future `CREATE POLICY ... TO
-- authenticated`, any `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` run to debug
-- something, and these grants turn instantly into public read/write on the whole
-- database. Defence in depth means RLS should not be the only thing holding.
--
-- After this, an anon request gets `permission denied for table users` — a 401
-- at the privilege layer, before RLS is ever consulted.
--
-- This does NOT affect the application: it connects over DATABASE_URL as the
-- table owner, never through PostgREST. The only supabase-js clients in the
-- codebase are used for Auth and Storage, and neither touches `.from()`.
--
--
-- 2. UNINDEXED FOREIGN KEYS  (was: MEDIUM)
--
-- Twelve foreign keys had no index with the FK column in the leading position.
-- Postgres does not create one automatically, so every DELETE or key-UPDATE on
-- the parent has to sequentially scan the child to check the constraint. All
-- twelve point at `users` or `workspaces` — precisely the rows deleted when an
-- account or workspace is removed, which is the operation that would time out.
--
--
-- 3. LEGACY BETTER AUTH TABLES  (was: LOW)
--
-- `user`, `session`, `account` and `verification` are left over from Better
-- Auth, retired when the project moved to Supabase Auth. They are unreferenced
-- by the Drizzle schema and by application code, and `account` was built to hold
-- OAuth access and refresh tokens. Dead tables holding stale credentials are
-- pure liability, so they go.

-- ---------------------------------------------------------------------------
-- 1. Revoke the PostgREST-reachable grants.
-- ---------------------------------------------------------------------------

-- `anon` and `authenticated` are created by Supabase, not by Postgres. The test
-- suite runs these same migrations against an in-memory PGLite database where
-- neither role exists, and a REVOKE naming a missing role raises 42704 and takes
-- the whole migration down. Guarding on pg_roles keeps one migration correct on
-- both, rather than maintaining a separate dialect for tests — which would mean
-- the thing under test was no longer the thing that ships.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    -- Supabase's default privileges re-grant to these roles on every table
    -- created afterwards. Without this, the next CREATE TABLE silently reopens
    -- exactly the hole closed above.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
  END IF;
END
$$;
--> statement-breakpoint

-- app_tenant's grants were issued per-table and are unaffected by the blanket
-- revokes above, but re-assert them so this migration is self-contained and the
-- tenant path cannot be broken by a future reordering.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, workspaces, users, memberships, user_preferences,
  invitations, connections, sync_records, ask_usage,
  drafts, documents, projects, tasks, feedback
TO app_tenant;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Index every foreign key.
--
-- CONCURRENTLY is deliberately NOT used: it cannot run inside a transaction, and
-- the migration runner wraps each file in one. These tables are small at beta
-- scale, so a brief ACCESS EXCLUSIVE lock is the cheaper trade against splitting
-- the migration into a non-transactional special case.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS connections_connected_by_user_id_idx ON connections (connected_by_user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS documents_uploaded_by_user_id_idx ON documents (uploaded_by_user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS drafts_author_id_idx ON drafts (author_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback (user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invitations_invited_by_user_id_idx ON invitations (invited_by_user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects (created_by);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects (owner_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS projects_updated_by_idx ON projects (updated_by);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON tasks (created_by);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_owner_id_idx ON tasks (owner_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_updated_by_idx ON tasks (updated_by);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS users_active_workspace_id_idx ON users (active_workspace_id);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Drop the retired Better Auth tables.
--
-- CASCADE because `session` and `account` carry foreign keys to `user`; the
-- dependent constraints go with them and nothing in the live schema references
-- any of the four.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "session" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "account" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "verification" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user" CASCADE;
