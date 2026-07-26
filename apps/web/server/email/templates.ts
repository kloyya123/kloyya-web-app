import type { EmailMessage } from './sender';

/**
 * Transactional email templates.
 *
 * Plain, quiet, and specific — the same voice the interface uses. No marketing,
 * no images, no tracking. Each one says what happened, what to do, and what to
 * do if it wasn't you; the last part is what makes an unexpected code
 * actionable rather than alarming.
 *
 * Deliberately inline-styled and table-free: these must survive Gmail, Outlook
 * and Apple Mail, none of which can be relied on for a stylesheet.
 */

/** Escapes text interpolated into HTML. Names come from user input. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(bodyHtml: string): string {
  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;',
    'font-size:15px;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">',
    bodyHtml,
    '<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;',
    'font-size:13px;color:#6b6b6b">Kloyya — the intelligence behind every decision.</p>',
    '</div>',
  ].join('');
}

const MINUTES = 10;

export function verificationCodeEmail(params: { code: string; name?: string }): EmailMessage {
  const greeting = params.name ? `Hi ${params.name},` : 'Hi,';
  const code = params.code;

  const text = [
    greeting,
    '',
    `Your Kloyya verification code is ${code}.`,
    `It expires in ${MINUTES} minutes.`,
    '',
    "If you didn't create a Kloyya account, you can ignore this email — nothing will happen.",
  ].join('\n');

  const html = shell(
    [
      `<p>${escapeHtml(greeting)}</p>`,
      '<p>Your Kloyya verification code is:</p>',
      `<p style="font-size:30px;font-weight:600;letter-spacing:6px;margin:24px 0">${escapeHtml(code)}</p>`,
      `<p style="color:#6b6b6b">It expires in ${MINUTES} minutes.</p>`,
      "<p style=\"color:#6b6b6b\">If you didn't create a Kloyya account, you can ignore this email — nothing will happen.</p>",
    ].join(''),
  );

  return { to: '', subject: `${code} is your Kloyya verification code`, html, text };
}

export function passwordResetCodeEmail(params: { code: string; name?: string }): EmailMessage {
  const greeting = params.name ? `Hi ${params.name},` : 'Hi,';
  const code = params.code;

  const text = [
    greeting,
    '',
    `Use ${code} to reset your Kloyya password.`,
    `It expires in ${MINUTES} minutes.`,
    '',
    "If you didn't ask to reset your password, ignore this email — your password stays as it is.",
  ].join('\n');

  const html = shell(
    [
      `<p>${escapeHtml(greeting)}</p>`,
      '<p>Use this code to reset your Kloyya password:</p>',
      `<p style="font-size:30px;font-weight:600;letter-spacing:6px;margin:24px 0">${escapeHtml(code)}</p>`,
      `<p style="color:#6b6b6b">It expires in ${MINUTES} minutes.</p>`,
      "<p style=\"color:#6b6b6b\">If you didn't ask to reset your password, ignore this email — your password stays as it is.</p>",
    ].join(''),
  );

  return { to: '', subject: 'Reset your Kloyya password', html, text };
}

/** Expiry the auth layer configures, kept next to the copy that promises it. */
export const OTP_EXPIRY_SECONDS = MINUTES * 60;

/**
 * An invitation into a workspace.
 *
 * Names who invited you and where — an invitation from nobody in particular is
 * indistinguishable from phishing, which is exactly what we're asking the
 * recipient to click through.
 */
export function invitationEmail(params: {
  acceptUrl: string;
  organizationName: string;
  invitedByName: string;
}): EmailMessage {
  const { acceptUrl, organizationName, invitedByName } = params;

  const text = [
    `${invitedByName} has invited you to join ${organizationName} on Kloyya.`,
    '',
    'Accept the invitation:',
    acceptUrl,
    '',
    'The link expires in 7 days.',
    "If you weren't expecting this, you can ignore this email.",
  ].join('\n');

  const html = shell(
    [
      `<p><strong>${escapeHtml(invitedByName)}</strong> has invited you to join `,
      `<strong>${escapeHtml(organizationName)}</strong> on Kloyya.</p>`,
      `<p style="margin:24px 0"><a href="${escapeHtml(acceptUrl)}" `,
      'style="background:#1a1a1a;color:#fff;padding:11px 18px;border-radius:6px;',
      'text-decoration:none;display:inline-block">Accept the invitation</a></p>',
      '<p style="color:#6b6b6b">The link expires in 7 days.</p>',
      "<p style=\"color:#6b6b6b\">If you weren't expecting this, you can ignore this email.</p>",
    ].join(''),
  );

  return {
    to: '',
    subject: `${invitedByName} invited you to ${organizationName} on Kloyya`,
    html,
    text,
  };
}

/**
 * Confirmation that someone is on the private-beta waiting list.
 *
 * Sent once, when the address is first recorded. It exists because a form that
 * says "you're on the list" and then goes quiet is indistinguishable from a
 * form that lost the submission — the email is the receipt.
 *
 * It deliberately promises only what we can keep: that we have the address, and
 * that the next message will be the invitation. No date, because we do not know
 * one, and no newsletter, because they did not ask for one.
 */
export function waitlistConfirmationEmail(): EmailMessage {
  const text = [
    "You're on the list for Kloyya.",
    '',
    'Kloyya is an AI chief of staff: it reads your mail, calendar and documents,',
    'hands you the short list each morning, and drafts your replies for approval.',
    '',
    'We are letting people in a few at a time while the connectors settle. The',
    'next email you get from us will be your invitation — nothing in between.',
    '',
    'If you did not request this, you can ignore this email and we will not',
    'contact you again.',
  ].join('\n');

  const html = shell(
    [
      "<p style=\"font-size:17px;font-weight:600;margin:0 0 16px\">You're on the list.</p>",
      '<p>Kloyya is an AI chief of staff: it reads your mail, calendar and documents, ',
      'hands you the short list each morning, and drafts your replies for approval.</p>',
      '<p>We are letting people in a few at a time while the connectors settle. ',
      '<strong>The next email you get from us will be your invitation</strong> — nothing in between.</p>',
      '<p style="color:#6b6b6b">If you did not request this, ignore this email and we will not contact you again.</p>',
    ].join(''),
  );

  return { to: '', subject: "You're on the list for Kloyya", html, text };
}

/**
 * "You're in" — the invitation that turns a waiting address into a user.
 *
 * The counterpart to `waitlistConfirmationEmail`, which promised that the next
 * message would be this one. It carries the sign-in URL because there is no
 * sign-in link on the marketing site during the private beta: this email IS how
 * a tester finds the door.
 *
 * It says what to do first, because "you have access" without a next step is a
 * link people click once and never return to.
 */
export function betaInvitationEmail(params: { signInUrl: string }): EmailMessage {
  const { signInUrl } = params;

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

  const html = shell(
    [
      "<p style=\"font-size:17px;font-weight:600;margin:0 0 16px\">You're in.</p>",
      '<p>Kloyya is ready for you. Sign in with the address this email was sent to.</p>',
      `<p style="margin:24px 0"><a href="${escapeHtml(signInUrl)}" `,
      'style="background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;',
      'text-decoration:none;display:inline-block">Sign in to Kloyya</a></p>',
      '<p>First time in, Kloyya asks a few questions to set itself up, then invites you ',
      'to connect Gmail, Google Calendar, Google Drive or Notion. Connect at least one ',
      'and it will start reading.</p>',
      '<p style="color:#6b6b6b">Read access only. Kloyya drafts replies but never sends ',
      'anything without your approval, and you can disconnect a tool in one click.</p>',
      '<p style="color:#6b6b6b">This is an early build and we want to hear what breaks.</p>',
    ].join(''),
  );

  return { to: '', subject: "You're in — your Kloyya access is ready", html, text };
}
