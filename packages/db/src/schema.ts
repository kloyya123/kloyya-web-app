import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
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

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
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
