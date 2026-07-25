# KLOYYA APPLICATION REBUILD

This is NOT a feature request.

This is a product-wide refactor and rebuild.

You have permission to modify, remove, reorganize, rename, replace, or rebuild any frontend or backend code necessary to make the application consistent with the updated product specification.

Do NOT preserve existing architecture simply because it already exists.

If a feature, page, database schema, API, component, route, navigation flow, or backend service no longer fits the product vision, rebuild it correctly.

## Objective

The frontend and backend must evolve together.

Never update one without updating the other.

Every change must be reflected across:

- UI
- Components
- Navigation
- Routing
- Database
- Drizzle schema
- Migrations
- Supabase
- Authentication
- Authorization
- RLS
- APIs
- Server Actions
- Services
- Business logic
- Validation
- Search
- Memory
- AI
- State management
- Analytics
- Documentation

The application should always remain deployable.

---

# Rebuild Philosophy

Do NOT patch the existing application.

Refactor the application where necessary.

If rebuilding a module is cleaner than modifying it, rebuild it.

Code quality is more important than preserving old code.

Never keep dead code.

Never keep unused components.

Never keep duplicate logic.

Never keep obsolete database tables.

Never keep obsolete API routes.

Never keep obsolete navigation.

Everything should reflect the current product vision.

---

# Work Feature-by-Feature

For every feature:

1. Remove obsolete implementation.
2. Update database schema.
3. Generate migrations.
4. Update backend services.
5. Update API routes.
6. Update frontend pages.
7. Update components.
8. Update hooks.
9. Update state management.
10. Update permissions.
11. Update RLS.
12. Update analytics.
13. Update tests.
14. Update documentation.

Only after the entire feature is complete may you continue.

---

# If a Change Affects Onboarding

Rebuild the entire onboarding flow.

Do not attempt partial updates.

Update:

- Authentication
- Routing
- Database
- User model
- Workspace creation
- Connected tools
- AI personalization
- Initial sync
- Dashboard entry

Every screen and API involved must match the new flow.

---

# If Navigation Changes

Update:

- Sidebar
- Routes
- Permissions
- Breadcrumbs
- Mobile navigation
- Desktop navigation
- Deep links
- Redirects

Do not leave orphaned pages.

---

# If Data Models Change

Update:

- Drizzle schema
- Migrations
- TypeScript types
- Services
- APIs
- Queries
- Mutations
- RLS
- Validation

Do not keep compatibility code unless explicitly required.

---

# If UI Changes

Update:

- Components
- Layouts
- Pages
- Forms
- Loading states
- Error states
- Empty states

Do not leave placeholder components.

---

# Codebase Consistency

At the end of every feature:

- Remove unused code.
- Remove dead imports.
- Remove obsolete files.
- Remove duplicate logic.
- Ensure type safety.
- Ensure lint passes.
- Ensure build passes.

---

# Final Goal

By the end of this implementation, the codebase should look like it was designed from scratch around the current Kloyya product—not like an old application with new features added onto it.

Refactor aggressively where appropriate.

Prioritize clean architecture, maintainability, consistency, and production readiness over preserving existing implementations.