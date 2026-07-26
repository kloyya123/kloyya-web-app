-- The private-beta waiting list.
--
-- Deliberately outside the tenant model. Someone on this list has no account,
-- no organization, and no workspace — that is precisely what puts them on it —
-- so there is no organization_id to scope by and no `app_tenant` policy that
-- could be written.
--
-- RLS is ENABLED with no policy. For anon and authenticated that is a complete
-- denial (a role with no matching policy sees nothing), which is the point: the
-- list of people who asked for access is not public. It is deliberately NOT
-- forced, because the only legitimate reader is the table owner — the API route
-- that inserts, and whoever later queries it to send invitations. Forcing RLS
-- on a table with no policies locks out the owner too, i.e. everyone.
--
-- Grants are NOT issued to anon or authenticated: migration 0023 revoked them
-- across the schema and set ALTER DEFAULT PRIVILEGES so new tables cannot
-- inherit them. This table is therefore unreachable over PostgREST with the
-- public anon key, which is the second layer behind RLS.
--
-- email is the primary key rather than a surrogate id: asking twice is not an
-- error, it is the same person being keen, so the API upserts on the address
-- and needs no uniqueness check of its own.

CREATE TABLE IF NOT EXISTS "waitlist" (
  "email"       text PRIMARY KEY NOT NULL,
  "source"      text NOT NULL DEFAULT 'landing',
  "invited_at"  timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- "Who signed up, oldest first" is the one query this table exists to serve.
CREATE INDEX IF NOT EXISTS "waitlist_created_at_idx" ON "waitlist" ("created_at");
