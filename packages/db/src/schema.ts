import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Kloyya database schema — Phase 3, core tenancy.
 *
 * Derived field-for-field from the frontend's domain model
 * (apps/web/types/domain.ts + apps/web/services/auth/types.ts) so the API returns
 * these shapes without translation drift.
 *
 * Conventions:
 *   • snake_case columns/tables (Postgres/Supabase idiom), camelCase in TS.
 *   • Every table carries audit columns (created/updated/deleted_at, version),
 *     per KDA "Every table includes … Soft Delete Flag, Version".
 *   • RLS is ENABLED on every table here (`.enableRLS()`), a deny-by-default
 *     posture. Our server connects as the table-owning role, which bypasses
 *     ENABLE'd (not FORCE'd) RLS, so the API and Better Auth work normally;
 *     unprivileged Supabase roles are denied. The per-tenant policies land in
 *     Phase 5 and read an app-set GUC — `current_setting('app.current_org_id')`
 *     — since Better Auth (not Supabase Auth) owns identity, there is no
 *     `auth.uid()` to key off.
 *   • Identity lives in Better Auth's own tables (`user`/`session`/`account`/
 *     `verification`), defined below and driven by its Drizzle adapter. Our
 *     `users` table is the domain profile, linked 1:1: `users.id` is a FK to
 *     `user.id`. Auth fields (email, name, image) live on `user`, never
 *     duplicated here.
 */

// ---------------------------------------------------------------------------
// Enums — the closed sets the frontend already defines
// ---------------------------------------------------------------------------

export const plan = pgEnum('plan', ['starter', 'growth', 'enterprise']);

/**
 * Beta subscription tier on the (internal) organization. Free and Pro only — no
 * Max during the private beta. Distinct from the legacy `plan` enum above, which
 * is the pre-beta billing tier and will be retired in the cleanup phase.
 */
export const subscriptionTier = pgEnum('subscription_tier', ['free', 'pro']);

/** How assertive Kloyya should be, chosen at onboarding. */
export const proactiveness = pgEnum('proactiveness', [
  'minimal',
  'balanced',
  'highly_proactive',
]);

/** What a draft is — the kinds the beta supports. */
export const draftType = pgEnum('draft_type', [
  'email',
  'note',
  'report',
  'document',
  'meeting_summary',
]);

/** A draft's lifecycle. `archived` is "organized away", not deleted. */
export const draftStatus = pgEnum('draft_status', ['active', 'archived']);

/**
 * Where an uploaded document is in its pipeline. `processing` while text is
 * being extracted, `ready` once it's searchable, `failed` if extraction died
 * (the file is still stored and can be re-tried).
 */
export const documentStatus = pgEnum('document_status', ['processing', 'ready', 'failed']);

/** What a piece of beta feedback is. */
export const feedbackType = pgEnum('feedback_type', ['feature_request', 'bug', 'general']);

/** Which area a feature request or bug is about (from the settings spec). */
export const feedbackCategory = pgEnum('feedback_category', [
  'ai',
  'search',
  'workspace',
  'tasks',
  'projects',
  'documents',
  'integrations',
  'mobile',
  'performance',
  'design',
  'other',
]);

/** KESM RBAC roles, including the machine principals — an agent is authorized
 *  and audited like any user. */
export const membershipRole = pgEnum('membership_role', [
  'owner',
  'administrator',
  'executive',
  'manager',
  'team_lead',
  'employee',
  'contractor',
  'guest',
  'auditor',
  'support',
  'ai_service',
  'automation_service',
]);

export const workStyle = pgEnum('work_style', ['deep_focus', 'collaborative', 'reactive']);

export const notificationLevel = pgEnum('notification_level', [
  'everything',
  'important_only',
  'critical_only',
]);

export const goal = pgEnum('goal', [
  'reduce_meeting_load',
  'stay_on_top_of_email',
  'track_project_risk',
  'prepare_for_meetings',
  'organize_knowledge',
  'make_faster_decisions',
]);

// ---------------------------------------------------------------------------
// Shared audit columns — KDA mandates these on every table.
// ---------------------------------------------------------------------------

const audit = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
};

// ---------------------------------------------------------------------------
// Better Auth — identity tables
//
// Field shapes are exactly what better-auth@1.x's Drizzle adapter expects
// (verified against `getAuthTables()`); the TS property names must match its
// field names (`emailVerified`, `createdAt`, …) so the adapter maps correctly,
// while the DB columns stay snake_case per our convention. Ids are UUIDs minted
// by Postgres — Better Auth is configured with `generateId: false` so it defers
// id creation to the database, keeping identity ids consistent with the rest of
// the schema. These are managed by the auth layer; app code never writes them.
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}).enableRLS();

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
).enableRLS();

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    /** For the email/password provider: the hashed password. Never returned. */
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
).enableRLS();

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
).enableRLS();

// ---------------------------------------------------------------------------
// Tenant tables
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  logoUrl: text('logo_url'),
  plan: plan('plan').notNull().default('starter'),
  /** Beta subscription tier, chosen on the onboarding plan step. Free by default. */
  subscriptionTier: subscriptionTier('subscription_tier').notNull().default('free'),
  ...audit,
}).enableRLS();

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** DCTF Trust Score, 0–100. Surfaced on the dashboard. */
    trustScore: integer('trust_score').notNull().default(0),
    ...audit,
  },
  (t) => [index('workspaces_organization_id_idx').on(t.organizationId)],
).enableRLS();

export const users = pgTable(
  'users',
  {
    /** The domain profile for a Better Auth user — 1:1, sharing the auth user's
     *  id. Auth fields (email, name, image) live on `user`, never duplicated
     *  here; the API composes the domain `User` DTO by joining the two. */
    id: uuid('id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    jobTitle: text('job_title').notNull().default(''),
    timezone: text('timezone').notNull().default('UTC'),
    /** False until onboarding completes. Gates the dashboard. */
    hasCompletedOnboarding: boolean('has_completed_onboarding').notNull().default(false),
    /** Which workspace the user currently has open (they may belong to several). */
    activeWorkspaceId: uuid('active_workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    ...audit,
  },
  (t) => [index('users_organization_id_idx').on(t.organizationId)],
).enableRLS();

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The user's role IN THIS WORKSPACE. The frontend's flat `user.role` is the
     *  role from the active workspace's membership. */
    role: membershipRole('role').notNull().default('employee'),
    ...audit,
  },
  (t) => [
    uniqueIndex('memberships_user_id_workspace_id_uq').on(t.userId, t.workspaceId),
    index('memberships_workspace_id_idx').on(t.workspaceId),
    index('memberships_organization_id_idx').on(t.organizationId),
  ],
).enableRLS();

/**
 * Pending invitations into a workspace.
 *
 * `tokenHash` holds a SHA-256 of the token we emailed, never the token itself —
 * the same reason `account.password` is a hash. An invitation is a credential:
 * whoever holds the token can join the organization, so a leaked database must
 * not hand out working invites.
 *
 * Status is derived, not stored: pending means not accepted, not revoked, and
 * not past `expiresAt`. A status column would be a second source of truth that
 * can disagree with the timestamps.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Stored lowercased; addresses are compared case-insensitively. */
    email: text('email').notNull(),
    /** The role the invitee gets on acceptance. */
    role: membershipRole('role').notNull().default('employee'),
    /** Kept for the audit trail; survives the inviter leaving. */
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...audit,
  },
  (t) => [
    index('invitations_organization_id_idx').on(t.organizationId),
    index('invitations_workspace_id_idx').on(t.workspaceId),
    index('invitations_email_idx').on(t.email),
  ],
).enableRLS();

/** The connection lifecycle the frontend's IntegrationsService already models. */
export const connectionStatus = pgEnum('connection_status', [
  'not_connected',
  'connecting',
  'syncing',
  'connected',
  'paused',
  'error',
]);

/**
 * A workspace's connection to a third-party tool.
 *
 * The catalogue (what CAN be connected, and the permissions each card promises)
 * is static config in @kloyya/core — only the live connection state lives here,
 * keyed by that catalogue's `integrationId`. There is deliberately no foreign key
 * to a providers table: the catalogue is code, reviewed and deployed, not rows a
 * bug could invent.
 *
 * The tokens are the customer's access to their own Gmail, Calendar and Drive.
 * They are stored ONLY as ciphertext (AES-256-GCM, see api/src/crypto/tokens.ts)
 * and are never selected into any response — no endpoint returns them, and the
 * connection DTO the API sends has no field to put them in.
 */
export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Matches IntegrationDefinition.id in the shared catalogue, e.g. 'gmail'. */
    integrationId: text('integration_id').notNull(),
    status: connectionStatus('status').notNull().default('not_connected'),
    /** Ciphertext. Never plaintext, never returned. */
    accessTokenEnc: text('access_token_enc'),
    refreshTokenEnc: text('refresh_token_enc'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    /** The scopes the provider actually granted — which can be less than we asked. */
    grantedScopes: text('granted_scopes').array().notNull().default(sql`'{}'::text[]`),
    /** Who connected it; kept for the audit trail. */
    connectedByUserId: uuid('connected_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    /**
     * Where the last incremental sync got to, per resource.
     *
     * A map because one connection has many streams — Google Calendar issues a
     * separate syncToken per calendar, so a single cursor column would silently
     * only ever sync one of them. Opaque provider values; we store and return
     * them, never parse them.
     */
    syncCursors: jsonb('sync_cursors').notNull().default(sql`'{}'::jsonb`),
    /** Human-readable, shown with a Reconnect action. Present only on 'error'. */
    errorReason: text('error_reason'),
    ...audit,
  },
  (t) => [
    // One connection per tool per workspace: connecting Gmail twice is a bug, not
    // a feature, and two live token pairs for one provider is a sync race.
    uniqueIndex('connections_workspace_id_integration_id_uq').on(t.workspaceId, t.integrationId),
    index('connections_organization_id_idx').on(t.organizationId),
  ],
).enableRLS();

/**
 * Raw provider data, exactly as the provider gave it.
 *
 * Connectors land; the pipeline interprets. Nothing in this table has been
 * reshaped, renamed, scored or summarised — `payload` is verbatim provider JSON.
 * That separation is what makes the pipeline re-runnable: when the way we read a
 * calendar event changes, we re-read what Google already told us instead of
 * asking Google again. Re-fetching everyone's history to fix our own bug is a
 * rate limit, a bill, and an outage.
 *
 * One row per provider object per connection, holding its latest raw form.
 * `contentHash` is what makes a re-sync cheap: an unchanged payload is skipped
 * rather than re-processed downstream.
 *
 * Provider deletions are tombstoned (`deletedAtSource`) rather than deleted:
 * "this meeting was cancelled" is intelligence, and a row that vanishes cannot
 * tell the pipeline anything.
 */
export const syncRecords = pgTable(
  'sync_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Disconnecting a tool takes its landed data with it. */
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    /** Denormalized from the connection so the pipeline can filter without a join. */
    integrationId: text('integration_id').notNull(),
    /** What kind of thing this is: 'calendar_event', 'message', 'file'. */
    resourceType: text('resource_type').notNull(),
    /** The provider's own id. Stable across syncs; ours is not. */
    externalId: text('external_id').notNull(),
    /** Verbatim provider JSON. Never edited, never interpreted here. */
    payload: jsonb('payload').notNull(),
    /** SHA-256 of the payload — an unchanged object is skipped, not reprocessed. */
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when the provider says it's gone. A tombstone, not a delete. */
    deletedAtSource: timestamp('deleted_at_source', { withTimezone: true }),
    ...audit,
  },
  (t) => [
    uniqueIndex('sync_records_connection_resource_external_uq').on(
      t.connectionId,
      t.resourceType,
      t.externalId,
    ),
    index('sync_records_workspace_resource_idx').on(t.workspaceId, t.resourceType),
    index('sync_records_organization_id_idx').on(t.organizationId),
  ],
).enableRLS();

/**
 * Ask Kloyya usage, one row per workspace per day.
 *
 * The Free plan caps questions per day (see @kloyya/core entitlements); this is
 * the counter that cap reads and increments. Keyed by (workspace, day) so a
 * day rolls over on its own — no cleanup job, just a new row. Kept tiny on
 * purpose: it counts, it does not log what was asked.
 */
export const askUsage = pgTable(
  'ask_usage',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** The UTC calendar day this count is for. */
    day: date('day').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.day] }),
    index('ask_usage_organization_id_idx').on(t.organizationId),
  ],
).enableRLS();

/**
 * Drafts — the things a person is writing but hasn't sent or filed.
 *
 * Email replies, notes, reports, documents, meeting summaries. Kloyya can create
 * one ("draft this"), and the editor auto-saves as you type, so a draft is never
 * a thing you can lose. Workspace-scoped and RLS-isolated like everything else;
 * `archived` organizes a draft away without deleting it, and a real delete is a
 * soft delete (deletedAt) so "I didn't mean to" is recoverable.
 */
export const drafts = pgTable(
  'drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Who created it; kept for the audit trail, survives the author leaving. */
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    type: draftType('type').notNull().default('note'),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    status: draftStatus('status').notNull().default('active'),
    ...audit,
  },
  (t) => [
    index('drafts_workspace_id_idx').on(t.workspaceId),
    index('drafts_organization_id_idx').on(t.organizationId),
  ],
).enableRLS();

/**
 * Uploaded documents.
 *
 * A file the user uploaded (or, later, scanned) so Kloyya can search it. The
 * bytes live in object storage; this row holds the metadata and the extracted
 * text — `extractedText` is what full-text search and Ask Kloyya read, so a PDF
 * becomes as searchable as an email. Workspace-scoped and RLS-isolated. Delete is
 * a soft delete so an accidental removal is recoverable (the stored object is
 * cleaned up separately).
 *
 * The Free plan caps how many a workspace may keep (see @kloyya/core
 * entitlements); the upload route counts live rows here against that cap.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** The original filename, shown to the user. */
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Where the bytes live in object storage. Opaque; not a public URL. */
    storagePath: text('storage_path').notNull(),
    /** The searchable text pulled out of the file. Empty until/unless extracted. */
    extractedText: text('extracted_text').notNull().default(''),
    status: documentStatus('status').notNull().default('processing'),
    ...audit,
  },
  (t) => [
    index('documents_workspace_id_idx').on(t.workspaceId),
    index('documents_organization_id_idx').on(t.organizationId),
  ],
).enableRLS();

/**
 * Beta feedback — feature requests, bug reports, and general notes.
 *
 * Kloyya is built alongside its users; this is where their ideas and problems
 * land. One table for all three kinds keeps the "Community & Feedback" screen and
 * its beta-status counters reading from a single place. `details` holds the
 * kind-specific extras (a bug's steps/expected/actual, a request's frequency)
 * rather than a column per rarely-used field. Workspace-scoped and RLS-isolated.
 */
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: feedbackType('type').notNull(),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    /** Present for feature requests and bugs; null for general feedback. */
    category: feedbackCategory('category'),
    /** A 1–5 star rating, on general feedback. Null otherwise. */
    rating: integer('rating'),
    /** Kind-specific extras (steps to reproduce, frequency, …). */
    details: jsonb('details').notNull().default(sql`'{}'::jsonb`),
    ...audit,
  },
  (t) => [
    index('feedback_workspace_id_idx').on(t.workspaceId),
    index('feedback_organization_id_idx').on(t.organizationId),
  ],
).enableRLS();

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** How the user describes their work (onboarding "role"). Free-form so the
   *  "Other" option is real; drives what Kloyya puts first. */
  role: text('role').notNull().default(''),
  /** The user's own words for what matters right now. Free-form, multiple. */
  priorities: text('priorities')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  /** How assertive Kloyya should be. */
  proactiveness: proactiveness('proactiveness').notNull().default('balanced'),
  /** Awkward literal values ('1-10', '06:00') are stored as text and validated
   *  by the app (zod), rather than forced into Postgres enum identifiers. */
  teamSize: text('team_size').notNull().default('51-200'),
  briefingTime: text('briefing_time').notNull().default('07:00'),
  goals: goal('goals')
    .array()
    .notNull()
    .default(sql`'{}'::goal[]`),
  workStyle: workStyle('work_style').notNull().default('deep_focus'),
  notificationLevel: notificationLevel('notification_level').notNull().default('important_only'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}).enableRLS();

// ---------------------------------------------------------------------------
// Relations — for the query builder (db.query.users.findMany({ with: … }))
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ one, many }) => ({
  /** The 1:1 domain profile. */
  profile: one(users, { fields: [user.id], references: [users.id] }),
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  workspaces: many(workspaces),
  users: many(users),
  memberships: many(memberships),
  invitations: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  workspace: one(workspaces, {
    fields: [invitations.workspaceId],
    references: [workspaces.id],
  }),
  invitedBy: one(users, { fields: [invitations.invitedByUserId], references: [users.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workspaces.organizationId],
    references: [organizations.id],
  }),
  memberships: many(memberships),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  /** The Better Auth identity this profile belongs to (1:1, shared id). */
  authUser: one(user, { fields: [users.id], references: [user.id] }),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  activeWorkspace: one(workspaces, {
    fields: [users.activeWorkspaceId],
    references: [workspaces.id],
  }),
  memberships: many(memberships),
  preferences: one(userPreferences),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  workspace: one(workspaces, {
    fields: [memberships.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));
