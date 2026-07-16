import type { EmailMessage } from './sender.js';

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
