/**
 * Email, behind an interface.
 *
 * Invitation email needs to send mail; tests must never actually send any. So
 * everything goes through this one seam: production passes the Resend sender,
 * tests pass a recorder they can assert against, and dev without an API key
 * passes a logger. (Account verification email is now Supabase's own, configured
 * in the dashboard — this seam carries the app's own transactional mail:
 * invitations.)
 */
export interface EmailMessage {
  to: string;
  subject: string;
  /** Always provide both: some clients refuse HTML, and text/plain is not optional. */
  html: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * The dev/no-key sender: writes the message where you can see it instead of
 * pretending to deliver it.
 */
export function createLoggingSender(log: (message: string) => void): EmailSender {
  return {
    async send(message) {
      log(
        `[email:dev] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
      );
    },
  };
}
