-- Give the connecting role permission to SET ROLE app_tenant.
--
-- WHY. `withTenantScope` does `SET LOCAL ROLE app_tenant` to drop into the
-- RLS-enforced role for the length of a request. On PostgreSQL 16+ (Supabase is
-- PG17) role *membership* no longer implies the ability to SET that role — the
-- membership needs `WITH SET TRUE`. Supabase auto-grants new roles to `postgres`
-- with admin but NOT set, so `SET ROLE app_tenant` is denied (42501) and every
-- tenant-scoped query fails. This grants the missing SET option.
--
-- Guarded and swallowed so it is a no-op where it isn't needed: on PostgreSQL
-- < 16 the syntax doesn't exist, and on a superuser connection (PGLite in tests)
-- SET ROLE already works regardless. Neither case should abort the migration.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 160000 THEN
    EXECUTE 'GRANT app_tenant TO CURRENT_USER WITH SET TRUE';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
