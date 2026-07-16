import { Resend } from 'resend';
import type { EmailMessage, EmailSender } from './sender.js';

/**
 * The Resend-backed sender.
 *
 * Resend reports failures in the response body rather than by throwing, so a
 * naive `await send()` succeeds even when nothing was delivered. We surface that
 * as a real error — a verification email that silently didn't send is a user
 * stuck on a screen forever, and we'd never know.
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
