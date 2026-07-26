import { afterEach, describe, expect, it } from 'vitest';
import { betaAllowlist, isBetaAllowed } from './beta-access';

/**
 * The beta gate decides who reaches the product, so it is tested like a control
 * rather than a helper — including the cases where someone is trying to get
 * past it with a lookalike address.
 */
const ORIGINAL = process.env['BETA_ALLOWED_EMAILS'];

function setAllowlist(value: string | undefined): void {
  if (value === undefined) delete process.env['BETA_ALLOWED_EMAILS'];
  else process.env['BETA_ALLOWED_EMAILS'] = value;
}

afterEach(() => setAllowlist(ORIGINAL));

describe('betaAllowlist', () => {
  it('parses a comma-separated list', () => {
    setAllowlist('a@example.com,b@example.com');
    expect(betaAllowlist()).toEqual(['a@example.com', 'b@example.com']);
  });

  it('tolerates spacing and casing from a hand-edited env var', () => {
    setAllowlist('  A@Example.COM ,  b@example.com  ');
    expect(betaAllowlist()).toEqual(['a@example.com', 'b@example.com']);
  });

  it('drops empty entries from a trailing or doubled comma', () => {
    setAllowlist('a@example.com,,b@example.com,');
    expect(betaAllowlist()).toEqual(['a@example.com', 'b@example.com']);
  });
});

describe('isBetaAllowed', () => {
  it('admits an address on the list', () => {
    setAllowlist('whelmank@gmail.com,kundamining@gmail.com');
    expect(isBetaAllowed('whelmank@gmail.com')).toBe(true);
    expect(isBetaAllowed('kundamining@gmail.com')).toBe(true);
  });

  it('ignores case, because email addresses do', () => {
    setAllowlist('whelmank@gmail.com');
    expect(isBetaAllowed('WhelmanK@Gmail.com')).toBe(true);
  });

  it('refuses an address that is not on the list', () => {
    setAllowlist('whelmank@gmail.com');
    expect(isBetaAllowed('someone@example.com')).toBe(false);
  });

  it('refuses a missing address', () => {
    setAllowlist('whelmank@gmail.com');
    expect(isBetaAllowed(null)).toBe(false);
    expect(isBetaAllowed(undefined)).toBe(false);
    expect(isBetaAllowed('')).toBe(false);
  });

  it('refuses lookalikes rather than matching loosely', () => {
    setAllowlist('whelmank@gmail.com');
    for (const attempt of [
      'whelmank@gmail.com.evil.com', // suffix
      'evil.com/whelmank@gmail.com', // prefix
      'whelmank@gmail.co', // truncated TLD
      'whelmank+admin@gmail.com', // plus-addressing is a DIFFERENT string
      'whelman@gmail.com', // one character short
    ]) {
      expect(isBetaAllowed(attempt), attempt).toBe(false);
    }
  });

  it('opens the gate when no allowlist is configured', () => {
    // Documented behaviour: an unset or empty variable disables the gate rather
    // than locking everyone out, so a config typo is not a production outage.
    setAllowlist(undefined);
    expect(isBetaAllowed('anyone@example.com')).toBe(true);

    setAllowlist('');
    expect(isBetaAllowed('anyone@example.com')).toBe(true);

    setAllowlist('   ,  ,');
    expect(isBetaAllowed('anyone@example.com')).toBe(true);
  });
});
