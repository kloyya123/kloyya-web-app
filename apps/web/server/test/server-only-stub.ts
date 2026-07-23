/**
 * Vitest stands in for the `server-only` package with this empty module.
 *
 * `server-only` throws when imported outside a React Server Components graph —
 * exactly right in the app, wrong in a node test runner. The vitest config
 * aliases it here for the server project only.
 */
export {};
