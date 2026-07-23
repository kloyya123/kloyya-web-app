import { Resend } from 'resend';
import type { EmailMessage, EmailSender } from './sender';

/**
 * The Resend-backed sender.
 *
 * Resend reports failures in the response body rather than by throwing, so a
 * naive `await send()` succeeds even when nothing was delivered. We surface that
 * as a real error — an email that silently didn't send is a user stuck forever,
 * and we'd never know.
 *
 * The error message deliberately carries Resend's reason but not the recipient's
 * address, so it can be logged without spreading personal data through the logs.
 */
export function createResendSender(apiKey: string, from: string): EmailSender {
  const resend = new Resend(apiKey);

  return {
    async send(message: EmailMessage): Promise<void> {
      const { error } = await resend.emails.send({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      if (error) {
        throw new Error(`Resend refused the message: ${error.name}: ${error.message}`);
      }
    },
  };
}

/**
 * The app's transactional email sender, resolved from config.
 *
 * With a Resend key, mail is delivered; without one, it is logged (dev) — the
 * app never crashes for want of an email provider, because account verification
 * (the one flow that must not silently fail) is handled by Supabase Auth, not
 * this seam.
 */
export function resolveEmailSender(): EmailSender {
  // Imported lazily to keep this module usable in tests that inject a recorder.
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'] ?? 'Kloyya <onboarding@resend.dev>';
  if (apiKey) return createResendSender(apiKey, from);
  return {
    async send(message) {
      console.warn(`[email:dev] to=${message.to} subject=${JSON.stringify(message.subject)}`);
    },
  };
}
