/**
 * Provider-neutral OAuth pieces.
 *
 * Google, Microsoft and Notion each speak their own dialect of OAuth, but the
 * token-refresh machinery — is this failure permanent or transient, re-encrypt
 * and store — is the same shape for all of them. These are the parts that don't
 * belong to any one provider.
 */

/** The tokens any provider returns from an authorization-code exchange. */
export interface ProviderTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  /** What the provider actually granted — which can be less than we asked. */
  grantedScopes: string[];
  /**
   * Non-secret bookkeeping a provider needs remembered alongside the tokens —
   * e.g. Slack's installed team id, which an incoming webhook event carries but
   * a bare access token does not. Most providers have nothing to put here.
   * Stored in the connection's `syncCursors` JSON (see connect.ts) rather than
   * a new column, the same "opaque provider values" reasoning that column
   * already exists for.
   */
  metadata?: Record<string, string>;
}

/** A new access token, and possibly a rotated refresh token, from a refresh. */
export interface RefreshedToken {
  accessToken: string;
  expiresAt: Date | null;
  /** null means "keep the refresh token we already hold". */
  refreshToken: string | null;
}

/** How a connector refreshes an access token. Each provider supplies its own. */
export type RefreshFn = (params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}) => Promise<RefreshedToken>;

/**
 * The user took the permission back — a permanent failure.
 *
 * Every provider has a way of saying "this grant is dead": Google's
 * invalid_grant, Microsoft's invalid_grant/AADSTS700082, Notion's revoked token.
 * A refresh that raises this must NOT be retried — only a human re-consenting
 * fixes it. Each provider throws a subclass so the token manager can tell "gone
 * for good" from "the provider had a bad minute" without knowing the dialect.
 */
export class AuthRevokedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AuthRevokedError';
  }
}
