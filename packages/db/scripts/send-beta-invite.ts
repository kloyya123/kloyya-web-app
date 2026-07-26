/**
 * Invite people into the private beta.
 *
 * Two things have to be true for someone to get in, and this handles the second:
 *
 *   1. Their address is in BETA_ALLOWED_EMAILS on Vercel. That is the gate
 *      middleware enforces, and it is set by hand — this script does NOT change
 *      it, because granting access should be a deliberate act, not a side effect
 *      of sending mail.
 *   2. They know where the door is. There is no sign-in link on the marketing
 *      site during the private beta, so this email is how a tester finds it.
 *
 * The script refuses to mail anyone who is not already on the allowlist. Sending
 * "you're in" to someone the gate will turn away is the worst possible message,
 * and it is an easy mistake to make when the two lists are maintained
 * separately.
 *
 * Marks waitlist.invited_at when the address is on the waiting list, so a second
 * run does not invite the same person twice. Addresses that were allowlisted
 * directly (never on the waitlist) have no row to mark — passing --force is how
 * you re-send to those.
 *
 * Usage:
 *   tsx scripts/send-beta-invite.ts a@example.com b@example.com
 *   tsx scripts/send-beta-invite.ts --all-waiting        (everyone not yet invited)
 *   tsx scripts/send-beta-invite.ts --dry-run a@example.com
 */
import postgres from 'postgres';
import { Resend } from 'resend';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const allWaiting = args.includes('--all-waiting');
const explicit = args.filter((a) => !a.startsWith('--')).map((a) => a.trim().toLowerCase());

const connectionString = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
const resendKey = process.env['RESEND_API_KEY'];
const from = process.env['EMAIL_FROM'] ?? 'Kloyya <contactsupport@kloyya.com>';
const siteUrl = (process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://www.kloyya.com').replace(/\/$/, '');
const allowlist = (process.env['BETA_ALLOWED_EMAILS'] ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

if (!connectionString) {
  console.error('Set DIRECT_URL or DATABASE_URL.');
  process.exit(1);
}
if (!resendKey && !dryRun) {
  console.error('Set RESEND_API_KEY (or pass --dry-run).');
  process.exit(1);
}
if (explicit.length === 0 && !allWaiting) {
  console.error('Pass one or more email addresses, or --all-waiting.');
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

/**
 * Duplicated from apps/web/server/email/templates.ts rather than imported.
 *
 * This script lives in @kloyya/db and runs under tsx; importing across the
 * workspace into the Next app would drag `server-only` and the app's path
 * aliases into a standalone script. The copy is small and its only job is to
 * render one message — if the wording diverges, the app's version is canonical.
 */
function invitation(signInUrl: string): { subject: string; html: string; text: string } {
  const text = [
    "You're in. Kloyya is ready for you.",
    '',
    `Sign in: ${signInUrl}`,
    '',
    'Use the address this email was sent to. First time in, Kloyya will ask a few',
    'questions to set itself up, then invite you to connect Gmail, Google Calendar,',
    'Google Drive or Notion. Connect at least one and it will start reading.',
    '',
    'Read access only. Kloyya drafts replies but never sends anything without your',
    'approval, and you can disconnect a tool in one click.',
    '',
    'This is an early build and we want to hear what breaks.',
  ].join('\n');

  const html = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;',
    'font-size:15px;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">',
    "<p style=\"font-size:17px;font-weight:600;margin:0 0 16px\">You're in.</p>",
    '<p>Kloyya is ready for you. Sign in with the address this email was sent to.</p>',
    `<p style="margin:24px 0"><a href="${signInUrl}" `,
    'style="background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;',
    'text-decoration:none;display:inline-block">Sign in to Kloyya</a></p>',
    '<p>First time in, Kloyya asks a few questions to set itself up, then invites you ',
    'to connect Gmail, Google Calendar, Google Drive or Notion. Connect at least one ',
    'and it will start reading.</p>',
    '<p style="color:#6b6b6b">Read access only. Kloyya drafts replies but never sends ',
    'anything without your approval, and you can disconnect a tool in one click.</p>',
    '<p style="color:#6b6b6b">This is an early build and we want to hear what breaks.</p>',
    '<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;',
    'font-size:13px;color:#6b6b6b">Kloyya — the intelligence behind every decision.</p>',
    '</div>',
  ].join('');

  return { subject: "You're in — your Kloyya access is ready", html, text };
}

async function main(): Promise<void> {
  let targets = explicit;

  if (allWaiting) {
    const rows = await sql<{ email: string }[]>`
      SELECT email FROM waitlist WHERE invited_at IS NULL ORDER BY created_at
    `;
    targets = [...new Set([...targets, ...rows.map((r) => r.email)])];
  }

  if (targets.length === 0) {
    console.log('Nobody to invite.');
    await sql.end();
    return;
  }

  const signInUrl = `${siteUrl}/login`;
  const message = invitation(signInUrl);
  const resend = resendKey ? new Resend(resendKey) : null;

  console.log(`\nSign-in URL: ${signInUrl}`);
  console.log(`From:        ${from}`);
  console.log(`Allowlist:   ${allowlist.length} address(es)\n`);

  let sent = 0;
  let skipped = 0;

  for (const email of targets) {
    // The gate and the mailing list are maintained separately, so this is the
    // one check that stops us telling someone they are in when they are not.
    if (!allowlist.includes(email)) {
      console.log(`  SKIP  ${email} — not in BETA_ALLOWED_EMAILS, the gate would refuse them`);
      skipped += 1;
      continue;
    }

    const [waiting] = await sql<{ invited_at: Date | null }[]>`
      SELECT invited_at FROM waitlist WHERE email = ${email}
    `;
    if (waiting?.invited_at && !force) {
      console.log(`  SKIP  ${email} — already invited ${waiting.invited_at.toISOString()}`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  DRY   ${email}`);
      sent += 1;
      continue;
    }

    const { error } = await resend!.emails.send({
      from,
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (error) {
      console.log(`  FAIL  ${email} — ${error.name}: ${error.message}`);
      continue;
    }

    // Only stamped after a confirmed send, so a failure can be retried.
    await sql`UPDATE waitlist SET invited_at = now(), updated_at = now() WHERE email = ${email}`;
    console.log(`  SENT  ${email}`);
    sent += 1;
  }

  console.log(`\n${sent} sent${dryRun ? ' (dry run)' : ''}, ${skipped} skipped.\n`);
  await sql.end();
}

main().catch(async (error: unknown) => {
  console.error('Failed:', error);
  await sql.end();
  process.exit(1);
});
