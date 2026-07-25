import { redirect } from 'next/navigation';

/**
 * The paywall is switched off.
 *
 * No payment processor accepts Zambian cards yet, so there is nothing to sell
 * and nothing to charge; asking for a card here would collect details we cannot
 * act on. Anyone who reaches this URL — an old bookmark, a stale link — is sent
 * on to the next real step instead of a dead end.
 *
 * The `Paywall` component still exists and is still tested. Restore this page to
 * `return <Paywall />` when billing is live.
 */
export default function PaywallPage(): never {
  redirect('/onboarding/connect-tools');
}
