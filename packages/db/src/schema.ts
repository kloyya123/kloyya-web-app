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
 * (kloyya-web/types/domain.ts + services/auth/types.ts) so the API returns
 * these shapes without translation drift.
 *
 * Conventions:
 *   • snake_case columns/tables (Postgres/Supabase idiom), camelCase in TS.
 *   • Every table carries audit columns (created/updated/deleted_at, version),
 *     per KDA "Every table includes … Soft Delete Flag, Version".
 *   • RLS is ENABLED on every tenant table here (`.enableRLS()`), a deny-by-
 *     default posture. The service_role the API uses bypasses RLS; the actual
 *     per-tenant policies (which need Supabase's auth.uid()) land with Phase 4/5.
 *   • Identity lives in Supabase's auth.users. `users` here is the profile;
 *     users.id mirrors auth.users.id, FK wired in Phase 4.
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
// Tables
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
    /** Mirrors auth.users.id (Supabase Auth owns identity). FK wired in Phase 4. */
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    jobTitle: text('job_title').notNull().default(''),
    avatarUrl: text('avatar_url'),
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
