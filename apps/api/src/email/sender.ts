/**
 * Email, behind an interface.
 *
 * Auth needs to send mail; tests must never actually send any. So everything
 * goes through this one seam: production passes the Resend sender, tests pass a
 * recorder they can assert against, and dev without an API key passes a logger.
 * Nothing in the auth layer knows which it got.
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
 *
 * It logs the body deliberately — a verification code you cannot read is a
 * verification flow you cannot test locally. This is only ever selected when no
 * RESEND_API_KEY is configured, which production refuses to boot without.
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
