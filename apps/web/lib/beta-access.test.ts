import { afterEach, describe, expect, it, vi } from 'vitest';
import { betaAllowlist, describeAllowlist, isBetaAllowed } from './beta-access';

/**
 * The gate itself. The one failure mode worth naming up front: an earlier
 * version of this gate refused an address that WAS on the list, and the cause
 * was never established because nothing about the check was observable — see
 * describeAllowlist's own tests below for why that can't happen silently again.
 */
describe('isBetaAllowed', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is open when the allowlist is unset — a missing variable must not lock everyone out', () => {
    vi.stubEnv('BETA_ALLOWED_EMAILS', '');
    expect(isBetaAllowed('anyone@example.com')).toBe(true);
    expect(isBetaAllowed(undefined)).toBe(true);
  });

  it('allows exactly the configured addresses and no others', () => {
    vi.stubEnv('BETA_ALLOWED_EMAILS', 'whelmanny@gmail.com,whelmank@gmail.com');
    expect(isBetaAllowed('whelmanny@gmail.com')).toBe(true);
    expect(isBetaAllowed('whelmank@gmail.com')).toBe(true);
    expect(isBetaAllowed('someone.else@gmail.com')).toBe(false);
  });

  it('compares case-insensitively', () => {
    vi.stubEnv('BETA_ALLOWED_EMAILS', 'whelmank@gmail.com');
    expect(isBetaAllowed('WhelmanK@Gmail.com')).toBe(true);
  });

  it('tolerates whitespace around entries in the env var', () => {
    vi.stubEnv('BETA_ALLOWED_EMAILS', ' whelmanny@gmail.com , whelmank@gmail.com ');
    expect(isBetaAllowed('whelmank@gmail.com')).toBe(true);
    expect(betaAllowlist()).toHaveLength(2);
  });

  it('refuses a session with no email once the gate is on', () => {
    vi.stubEnv('BETA_ALLOWED_EMAILS', 'whelmank@gmail.com');
    expect(isBetaAllowed(null)).toBe(false);
    expect(isBetaAllowed(undefined)).toBe(false);
  });
});

describe('describeAllowlist', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('never contains an actual address', () => {
    vi.stubEnv('BETA_ALLOWED_EMAILS', 'whelmanny@gmail.com,whelmank@gmail.com');
    const description = describeAllowlist();
    expect(description).not.toContain('@');
    expect(description).not.toContain('whelmanny');
  });

  it('reports off when unset, on with a count and lengths otherwise', () => {
    vi.stubEnv('BETA_ALLOWED_EMAILS', '');
    expect(describeAllowlist()).toBe('off:0');

    vi.stubEnv('BETA_ALLOWED_EMAILS', 'whelmanny@gmail.com,whelmank@gmail.com');
    // Lengths, not addresses — enough to catch a stray quote or trailing space
    // without ever publishing who is on the list.
    expect(describeAllowlist()).toBe('on:2:19,18');
  });
});
