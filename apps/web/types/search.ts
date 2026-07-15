/**
 * Re-export of the shared contract from @kloyya/core.
 *
 * The canonical definitions live once in packages/core; this barrel keeps the
 * app's `@/types/search` import path stable while the API and web share one source.
 */
export * from '@kloyya/core/search';
